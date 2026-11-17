import importlib.util
import io
import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from contextlib import redirect_stderr, redirect_stdout
from unittest.mock import Mock, patch
from urllib.error import HTTPError, URLError


MODULE = Path(__file__).resolve().parents[1] / "scripts" / "gemini_auditor.py"
SPEC = importlib.util.spec_from_file_location("gemini_auditor", MODULE)
auditor = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(auditor)


class ApiDiagnosticsTests(unittest.TestCase):
    def test_gemini_timeout_while_waiting_for_headers_or_body(self):
        url = auditor.GEMINI_MODELS_URL + "test:generateContent"
        for failure in (TimeoutError("private details"), URLError(TimeoutError("private details")), None):
            with self.subTest(error_type=type(failure).__name__), patch.object(auditor, "build_opener") as builder:
                opener = builder.return_value
                if failure is not None:
                    opener.open.side_effect = failure
                else:
                    response = opener.open.return_value.__enter__.return_value
                    response.read.side_effect = TimeoutError("private details")
                phase = "antes de recibir cabeceras" if failure is not None else "al leer el cuerpo"
                with self.assertRaisesRegex(auditor.AuditError, rf"^Gemini: tiempo de espera agotado {phase} \(240 s\)\.$"):
                    auditor.api_json(url, {}, {})
                self.assertEqual(opener.open.call_args.kwargs["timeout"], 240)
                self.assertEqual(opener.open.call_count, 1)

    def test_github_timeout_has_its_own_limit(self):
        with patch.object(auditor, "build_opener") as builder:
            opener = builder.return_value
            opener.open.side_effect = URLError(TimeoutError("private details"))
            with self.assertRaisesRegex(auditor.AuditError, r"^GitHub: tiempo de espera agotado antes de recibir cabeceras \(30 s\)\.$"):
                auditor.api_json("https://github.example.invalid", {})
            self.assertEqual(opener.open.call_args.kwargs["timeout"], 30)

    def test_http_error_and_invalid_json_do_not_leak_details(self):
        url = auditor.GEMINI_MODELS_URL + "test:generateContent"
        with patch.object(auditor, "build_opener") as builder:
            opener = builder.return_value
            opener.open.side_effect = HTTPError(url, 429, "private details", None, None)
            with self.assertRaisesRegex(auditor.AuditError, r"^Gemini: HTTP 429\.$"):
                auditor.api_json(url, {}, {})
            opener.open.side_effect = None
            opener.open.return_value.__enter__.return_value.read.return_value = b"private details"
            with self.assertRaisesRegex(auditor.AuditError, r"^Gemini: cuerpo de respuesta inv.lido\.$"):
                auditor.api_json(url, {}, {})


class ProbeTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.env = {
            "MODEL_NAME": "gemini-3.5-flash-lite", "GEMINI_API_KEY": "masked-fixture",
            "GITHUB_RUN_ID": "999", "GITHUB_RUN_ATTEMPT": "2", "GITHUB_SHA": "a" * 40,
            "RUNNER_TEMP": temp.name, "GITHUB_OUTPUT": str(Path(temp.name, "output")),
            "GITHUB_STEP_SUMMARY": str(Path(temp.name, "summary")), "TARGET_PATH": "private-file.ts",
        }
        self.reply = {"candidates": [{"finishReason": "STOP", "content": {
            "parts": [{"text": '{"ok":true}'}],
        }}]}

    def report(self):
        reports = list(Path(self.env["RUNNER_TEMP"]).glob("probe-*.json"))
        self.assertEqual(len(reports), 1)
        self.assertIn(f"{'a' * 40}-run-999-2", reports[0].name)
        text = reports[0].read_text()
        self.assertNotIn("masked-fixture", text)
        self.assertNotIn("private-file.ts", text)
        report = json.loads(text)
        self.assertFalse(report["is_audit"])
        self.assertEqual(report["auditor_sha"], self.env["GITHUB_SHA"])
        self.assertIn(str(reports[0]), Path(self.env["GITHUB_OUTPUT"]).read_text())
        return report

    def test_probe_checks_catalog_and_sends_only_synthetic_input(self):
        model = self.env["MODEL_NAME"]
        request = Mock(side_effect=[{"name": f"models/{model}"}, self.reply])
        log = io.StringIO()
        with patch.object(auditor, "prepare_audit") as prepare, redirect_stdout(log):
            # Simulate a response above the old 45-second cutoff without sleeping.
            with patch.object(auditor, "monotonic", side_effect=[0, 0.1, 1, 137.8]):
                self.assertEqual(auditor.probe(self.env, request), 0)
            prepare.assert_not_called()
        catalog, generation = request.call_args_list
        self.assertEqual(catalog.args[0], auditor.GEMINI_MODELS_URL + model)
        self.assertEqual(len(catalog.args), 2)
        self.assertEqual(generation.args[0], catalog.args[0] + ":generateContent")
        self.assertEqual(catalog.kwargs["timeout"], 45)
        self.assertEqual(generation.kwargs["timeout"], 240)
        payload = json.dumps(generation.args[2])
        self.assertIn("sint", payload)
        self.assertNotIn("private-file.ts", payload)
        self.assertNotIn("masked-fixture", log.getvalue())
        self.assertIn("Generación JSON sintética — OK", Path(self.env["GITHUB_STEP_SUMMARY"]).read_text())
        report = self.report()
        self.assertEqual(report["status"], "PROBE_OK")
        self.assertEqual(report["stages"]["generation"]["elapsed_seconds"], 136.8)

    def test_catalog_failure_stops_before_generation(self):
        request = Mock(side_effect=auditor.AuditError("Gemini: HTTP 403.", code="http_403"))
        with self.assertRaisesRegex(auditor.AuditError, "HTTP 403"):
            auditor.probe(self.env, request)
        self.assertEqual(request.call_count, 1)
        report = self.report()
        self.assertEqual(report["status"], "SIN_DICTAMEN")
        self.assertEqual(report["stages"]["catalog"]["error_code"], "http_403")
        self.assertEqual(report["stages"]["generation"]["status"], "NO_EJECUTADO")

    def test_generation_timeout_keeps_catalog_evidence_and_fails_the_command(self):
        request = Mock(side_effect=[{"name": f"models/{self.env['MODEL_NAME']}"},
            auditor.AuditError("Gemini: tiempo de espera agotado antes de recibir cabeceras (240 s).",
                               code="timeout_headers")])
        real_probe = auditor.probe
        log = io.StringIO()
        with patch.dict(os.environ, self.env, clear=True), patch.object(auditor.sys, "argv", ["auditor", "--probe"]):
            with patch.object(auditor, "probe", side_effect=lambda env: real_probe(env, request)), redirect_stderr(log):
                self.assertEqual(auditor.main(), 1)
        self.assertEqual(request.call_count, 2)
        report = self.report()
        self.assertEqual(report["status"], "SIN_DICTAMEN")
        self.assertEqual(report["stages"]["catalog"]["status"], "OK")
        self.assertEqual(report["stages"]["generation"]["status"], "SIN_DICTAMEN")
        self.assertEqual(report["stages"]["generation"]["error_code"], "timeout_headers")
        self.assertNotIn("masked-fixture", log.getvalue())

    def test_rejected_synthetic_response_is_preserved_as_a_failure(self):
        self.reply["candidates"][0]["content"]["parts"][0]["text"] = '{"ok":false}'
        request = Mock(side_effect=[{"name": f"models/{self.env['MODEL_NAME']}"}, self.reply])
        with self.assertRaisesRegex(auditor.AuditError, "valor esperado"):
            auditor.probe(self.env, request)
        self.assertEqual(self.report()["stages"]["generation"]["error_code"], "validation_error")

    def test_invalid_run_identity_stops_before_any_api_call(self):
        self.env["GITHUB_RUN_ID"] = "../outside"
        request = Mock()
        with self.assertRaisesRegex(auditor.AuditError, "identidad de Actions"):
            auditor.probe(self.env, request)
        request.assert_not_called()


class AuditTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        previous = Path.cwd()
        os.chdir(temp.name)
        self.addCleanup(os.chdir, previous)
        self.git("init", "-q")
        self.git("config", "user.name", "Synthetic audit")
        self.git("config", "user.email", "audit@example.invalid")
        self.put(auditor.CI_PATH, "name: Recovery CI\n")
        self.put("server.ts", "export const stage = 'base';\n")
        self.put("src/server/backendLimits.ts", "export const limit = 4;\n")
        self.put("src/server/vaosOrchestrator.ts", "export const active = 2;\n")
        self.base = self.commit("Base")
        self.put("server.ts", "export const stage = 'candidate';\n")
        self.candidate = self.commit("Candidate")
        self.git("checkout", "--detach", "-q", self.base)
        self.env = {
            "AUDIT_TYPE": "b02_validation",
            "MODEL_NAME": "gemini-3.8-flash",
            "GITHUB_SHA": self.base,
            "BASE_SHA": self.base,
            "CANDIDATE_SHA": self.candidate,
            "RECOVERY_CI_ID": "123",
            "GITHUB_REPOSITORY": "example/project",
            "AUDIT_GITHUB_TOKEN": "fixture-github-token",
            "GEMINI_API_KEY": "fixture-gemini-key",
            "GITHUB_RUN_ID": "999",
            "GITHUB_RUN_ATTEMPT": "1",
            "RUNNER_TEMP": temp.name,
            "GITHUB_OUTPUT": str(Path(temp.name) / "output"),
            "GITHUB_STEP_SUMMARY": str(Path(temp.name) / "summary"),
        }
        self.calls = []
        self.run = {
            "id": 123, "workflow_id": auditor.CI_WORKFLOW, "path": auditor.CI_PATH,
            "head_sha": self.candidate, "event": "workflow_dispatch",
            "status": "completed", "conclusion": "success", "run_attempt": 2,
        }
        self.job = {
            "id": 456, "run_id": 123, "run_attempt": 2, "name": "verify",
            "head_sha": self.candidate, "status": "completed", "conclusion": "success",
            "steps": [{"name": name, "status": "completed", "conclusion": "success"}
                      for name in auditor.CI_STEPS],
        }
        self.items = [
            {"control": control, "estado": "NO_VERIFICADO", "hallazgo": "Evidencia sintética.",
             "referencias": []}
            for control in auditor.B02_CONTROLS
        ]
        self.finish = "STOP"
        self.gemini_text = None

    def git(self, *args):
        return subprocess.check_output(["git", *args], stderr=subprocess.DEVNULL, text=True).strip()

    def commit(self, message):
        self.git("add", "--all")
        self.git("commit", "-qm", message)
        return self.git("rev-parse", "HEAD")

    def put(self, path, content):
        file = Path(path)
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(content, encoding="utf-8")

    def request(self, url, headers, payload=None):
        self.calls.append(url)
        if url.startswith("https://api.github.com/"):
            self.assertEqual(headers["Authorization"], "Bearer fixture-github-token")
            self.assertNotIn("x-goog-api-key", headers)
            if url.endswith("/jobs?per_page=100"):
                self.assertIn("/attempts/2/jobs?", url)
                return {"jobs": [self.job]}
            self.assertTrue(url.endswith("/runs/123"))
            return self.run
        self.assertTrue(url.startswith("https://generativelanguage.googleapis.com/"))
        self.assertEqual(headers["x-goog-api-key"], "fixture-gemini-key")
        self.assertNotIn("Authorization", headers)
        self.payload = payload
        body = self.gemini_text if self.gemini_text is not None else json.dumps({"resultados": self.items})
        return {"modelVersion": "fixture", "candidates": [
            {"finishReason": self.finish, "content": {"parts": [{"text": body}]}}
        ]}

    def assert_blocked_before_gemini(self, message):
        with self.assertRaisesRegex(auditor.AuditError, message):
            auditor.audit(self.env, self.request)
        self.assertFalse(any("googleapis.com" in url for url in self.calls))

    def test_exact_candidate_and_ci_emit_one_report(self):
        self.items[0].update(estado="VERIFICADO_EN_CODIGO",
                             referencias=[{"path": "server.ts", "start": 1, "end": 1}])
        report = auditor.audit(self.env, self.request)
        auditor.write_report(self.env, report)
        self.assertEqual(len(self.calls), 3)
        sent = json.loads(self.payload["contents"][0]["parts"][0]["text"])
        self.assertIn("stage = 'candidate'", sent["files"]["server.ts"])
        self.assertNotIn("stage = 'base'", sent["files"]["server.ts"])
        self.assertEqual(set(sent["controls"]), set(auditor.B02_CONTROLS))
        self.assertEqual(self.payload["generationConfig"]["responseMimeType"], "application/json")
        self.assertNotIn("thinkingConfig", self.payload["generationConfig"])
        self.assertEqual(report["audited_sha"], self.candidate)
        self.assertEqual(report["auditor_sha"], self.base)
        self.assertEqual(report["recovery_ci"]["attempt"], 2)
        reports = list(Path(self.env["RUNNER_TEMP"]).glob("audit-*.json"))
        self.assertEqual(len(reports), 1)
        self.assertIn(f"{self.candidate}-ci-123-2-run-999-1", reports[0].name)
        self.assertEqual(json.loads(reports[0].read_text()), report)

    def test_diff_empty_fails_without_using_checkout(self):
        self.env["CANDIDATE_SHA"] = self.base
        self.assert_blocked_before_gemini("No hay cambios B02")
        self.assertFalse(self.calls)

    def test_ci_from_different_commit_is_rejected(self):
        self.run["head_sha"] = self.base
        self.assert_blocked_before_gemini("SHA exacto")

    def test_ci_from_different_workflow_is_rejected(self):
        self.run["workflow_id"] += 1
        self.assert_blocked_before_gemini("Recovery CI manual")

    def test_pr_ci_is_not_accepted_by_this_pilot(self):
        self.run["event"] = "pull_request"
        self.assert_blocked_before_gemini("Recovery CI manual")

    def test_required_step_must_pass(self):
        self.job["steps"][0]["conclusion"] = "skipped"
        self.assert_blocked_before_gemini("todos los pasos")

    def test_job_must_be_from_the_verified_attempt(self):
        self.job["run_attempt"] = 1
        self.assert_blocked_before_gemini("todos los pasos")

    def test_ci_definition_must_match_auditor_definition(self):
        self.git("checkout", "--detach", "-q", self.candidate)
        self.put(auditor.CI_PATH, "name: Modified CI\n")
        self.env["CANDIDATE_SHA"] = self.commit("Modified workflow")
        self.git("checkout", "--detach", "-q", self.base)
        self.assert_blocked_before_gemini("versión de confianza")

    def test_abbreviated_candidate_is_rejected(self):
        self.env["CANDIDATE_SHA"] = self.candidate[:7]
        self.assert_blocked_before_gemini("40 caracteres")

    def test_base_must_be_an_ancestor(self):
        self.put("unrelated.md", "Parallel commit\n")
        self.env["BASE_SHA"] = self.commit("Parallel commit")
        self.git("checkout", "--detach", "-q", self.base)
        self.assert_blocked_before_gemini("merge-base")

    def test_invalid_scope_is_rejected_before_any_api_call(self):
        self.env.update(AUDIT_TYPE="architecture", TARGET_PATH="../outside")
        self.assert_blocked_before_gemini("ruta debe ser relativa")
        self.assertFalse(self.calls)

    def test_reads_only_tracked_regular_text_from_the_commit(self):
        self.put("scope/tracked.tsx", "export const original = true;\n")
        self.put("scope/.hidden/local.ts", "hidden")
        Path("scope/link.ts").symlink_to("tracked.tsx")
        self.env["GITHUB_SHA"] = self.commit("Add scoped files")
        self.put("scope/tracked.tsx", "Uncommitted change")
        self.put("scope/untracked.ts", "Untracked file")
        self.env.update(AUDIT_TYPE="architecture", TARGET_PATH="scope/")
        self.items = [self.items[0]]
        auditor.audit(self.env, self.request)
        sent = json.loads(self.payload["contents"][0]["parts"][0]["text"])
        self.assertEqual(sent["files"], {"scope/tracked.tsx": "export const original = true;\n"})
        self.assertEqual(self.payload["generationConfig"]["thinkingConfig"], {"thinkingLevel": "LOW"})

    def test_oversize_is_rejected_before_any_api_call(self):
        self.put("scope/large.ts", "x" * (auditor.MAX_BYTES + 1))
        self.env["GITHUB_SHA"] = self.commit("Add large file")
        self.env.update(AUDIT_TYPE="architecture", TARGET_PATH="scope/")
        self.assert_blocked_before_gemini("presupuesto")
        self.assertFalse(self.calls)

    def test_out_of_scope_reference_is_rejected(self):
        self.items[0]["referencias"] = [{"path": "server.ts", "start": 19, "end": 20}]
        with self.assertRaisesRegex(auditor.AuditError, "fuera de los archivos o líneas"):
            auditor.audit(self.env, self.request)

    def test_unsubstantiated_positive_is_rejected(self):
        self.items[0]["estado"] = "VERIFICADO_EN_CODIGO"
        with self.assertRaisesRegex(auditor.AuditError, "carece de referencia"):
            auditor.audit(self.env, self.request)

    def test_missing_control_is_rejected(self):
        self.items.pop()
        with self.assertRaisesRegex(auditor.AuditError, "todos los controles"):
            auditor.audit(self.env, self.request)

    def test_incomplete_model_result_is_rejected(self):
        self.finish = "MAX_TOKENS"
        with self.assertRaisesRegex(auditor.AuditError, r"respuesta completa \(MAX_TOKENS\)"):
            auditor.audit(self.env, self.request)

    def test_invalid_candidate_text_is_rejected_without_echoing_it(self):
        self.gemini_text = "private details"
        with self.assertRaisesRegex(auditor.AuditError, r"^Gemini: el candidato no contiene un informe JSON v.lido\.$"):
            auditor.audit(self.env, self.request)
