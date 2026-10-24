Recuperación rastreable desde los nueve informes del [PR #1](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/pull/1), `audit/codex-deep-review@1f915074d374a8f98421808ede347e241b014114`. `main` verificada en `2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7`.

El [backlog publicado](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/fix/p0-a-f01-ssrf/docs/recovery/BACKLOG.md) contiene el mapeo N01–N31/F01–F31, dependencias, criterios de cierre y enlaces a los nueve informes. Esta Issue permanece abierta y no autoriza ampliar el PR de F01 a otros trabajos.

- [ ] N01 / P0-A / F01: revisar e integrar el PR independiente de `fix/p0-a-f01-ssrf`. Implementado y verificado localmente; no fusionado ni desplegado.
- [ ] N02–N06: identidad, ownership, push, custodia BYOK y bóveda.
- [ ] N09/N11/N21/N27: resultados verificables, advisories con triage y telemetría con procedencia.
- [ ] N07/N08/N10/N12–N17/N22: migración, routing, política única, cola, sync, contactos, scheduler e intención.
- [ ] N18–N20/N23–N26/N29/N30: capacidades y entrega en PRs posteriores dentro de su autorización.
- [ ] Aclarar F28/F31: lagunas documentales, **sin hallazgos nuevos inventados**.

Evidencia N01: [registro](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/fix/p0-a-f01-ssrf/docs/recovery/VALIDATION.md) y [contrato de egress](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/fix/p0-a-f01-ssrf/docs/recovery/F01-EGRESS.md). Regresiones originales en `ba253050b0972c0683d72658ce503bcf2602fd91`: cinco fallos esperados y seis envíos interceptados con secretos sintéticos. Corrección funcional en `2adf45eb85b39d925b32e7dbbc07beebf9258bc9`: 61/61 tests, TypeScript, build y smoke productivo local pasan; Bun 1.4.4, Node 24.19.0 e instalación congelada. Lock y dependencias sin cambios.

Las cinco salidas usan registro exclusivamente del servidor, claves por proveedor, DNS/IP y conexión fijados, TLS verificado y rechazo de redirecciones. Excepciones locales limitadas a proveedor/host/puerto. Contratos NVIDIA NIM, Gemini, OpenAI-compatible, Ollama y vLLM probados mediante fixtures/mocks; cero inferencia externa o servicios de pago.

Cierre de N01 requiere revisión/integración con la evidencia enlazada. No cierra F02–F06 ni habilita producción global. `main` queda intacta; sin merge automático, credenciales reales, voz nueva, agentes, Google ni cambios de interfaz ajenos a F01.
