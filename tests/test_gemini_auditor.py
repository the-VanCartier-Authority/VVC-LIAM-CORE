import importlib.util
import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path


MODULE = Path(__file__).resolve().parents[1] / "scripts" / "gemini_auditor.py"
SPEC = importlib.util.spec_from_file_location("gemini_auditor", MODULE)
auditor = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(auditor)


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
        body = json.dumps({"resultados": self.items})
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
        with self.assertRaisesRegex(auditor.AuditError, "respuesta completa"):
            auditor.audit(self.env, self.request)
