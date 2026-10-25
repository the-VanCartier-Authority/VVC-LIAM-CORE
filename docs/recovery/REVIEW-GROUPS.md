# Grupos pequeños y secuencia de integración futura

2026-10-25 · [Encargo de revisión de seguridad](INDEPENDENT-REVIEW.md). **Preparación, sin autorización para fusionar.** main sigue en `2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7` y #41 permanece draft en `83873585c7f851da9aae435883739d448194a24d`.

Los19PR están OPEN/UNMERGED. Esta tabla fija sus heads observados. Los candidatos de ensayo ya existen como ancestros de #41; no se han creado nuevas integraciones ni ejecutado nuevos checks de cada grupo en esta etapa. Un SHA futuro después de portar/rebasar será distinto y exige CI/revisión propias. El snapshot JSON distingue el ref de base remoto y el merge-base, especialmente #7/D01 y #21/D03 ampliados.

| Grupo | PR y head exacto preparado para revisión | Candidato histórico exacto dentro de #41 | Verificación específica además de CI completa |
|---|---|---|---|
| G01 | [#3](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/pull/3) `0be6e86a0099c2c6f4947695b69522a2ba5e864f`<br>[#5](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/pull/5) `d9df435f0afc34f6064223f962df4858616a2cf0`<br>[#7](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/pull/7) `7f0cffdd39a95eda359b0aebe670ba7405f0955e` | `9908785c79e633628328246f381a91c55d705a58` | F01, excepciones DNS, truthful outcomes, webhooks |
| G02 | [#9](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/pull/9) `f5362170157dd102f890d3378450c7afd46733c9`<br>[#11](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/pull/11) `6f94b7c61cf45536fd99cbecc8bed5ffcb8fa7af` | `45e1771440e341838c8c6d37aac358681424b599` | backend-auth y dos UID VAOS |
| G03 | [#13](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/pull/13) `2740edda574a6823496b5dd28cd167cde0c44ffa` | `645864fb1b27f10282e1a043e52e403347a843e4` | resource-limits y deadlines/leases |
| G04 | [#15](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/pull/15) `72be2a188bade2258ed80305dcc96ef8d1c265e5` | `ac72fd55fb662579e17547975b746d377685b6af` | dependency-compat y audit production |
| G05 | [#17](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/pull/17) `5202f8edc04cbabc8d60a9e33a96b1c07795c924`<br>[#19](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/pull/19) `2957d6cc56612cec33b68e2de3915781de3fb269` | `fe5ceca861e5fc02aa2becfcb9c284a1fcb9cf76` | metric-provenance, privacy/capability Chromium |
| G06 | [#21](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/pull/21) `34ce45da31590a8745418ff493d6cd3cd265f536` | `37e519ef3d696be3fc3588482685aca43047d51b` | push-ownership/delivery/session, transporte binario |
| G07 | [#23](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/pull/23) `710426df0168aa427e50d4420815a282783cf9d4`<br>[#27](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/pull/27) `d5dfa0d9c4a06b20682fc82bf842123f0000db4e` | `c3140d7b49bb3bbe2bf6221bdc55d9aad1041221` | critical-priority, model-routing, selector Chromium |
| G08 | [#29](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/pull/29) `947e0357c56fa66a502bf44248b3afc8f24f174a` | `4337732c656632320e39794dba4e89a69dd4c812` | chat-policy, chat-decision Chromium, auth |
| G09 | [#25](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/pull/25) `2b6cad2c0b287f8d4ac13f400258c924e9bb898e`<br>[#32](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/pull/32) `159817d7eb49b3b8e88256c501097655ed805b23` | `3d2e0272705bad2ffd118c40ffce9978aa86f5cd` | imported-contacts, intent-safety, confirmation Chromium |
| G10 | [#34](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/pull/34) `2e256477e02e255c6664ed660ff055054c7458f9` | `42f781b837b834ecffb145628713021019e8b1d8` | temporal core/adapters/Firestore/Chromium y webhook D01 |
| G11 | [#36](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/pull/36) `7ab086e878e27e53fd58ef0b1280bbcd264deb3d` | `2bc17b4c4c4c2a9662e3018dc76cf9957f15a761` | SQLite permisos/disco/SIGKILL/UID/idempotencia/retry; métricas/polling |
| G12 | [#38](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/pull/38) `a462cfbdee3bda796bb8dca7e65a64f5d3637eae` | `996e6d1ec596d6d560b234925ed9a86a1275ab5c` | gemini-context, parámetros/system, App NVIDIA/Gemini |
| G13 | [#40](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/pull/40) `5934384efab7010bd0d436bb9234df64f1960551` | `57fc012f2ed8894313cc7e2770504611a10cb05b` | provider/chat cancellation + egress-combination + todas las anteriores |

Cada grupo parte del árbol verificado del grupo anterior, con todas sus dependencias realmente presentes. La secuencia elegida reproduce el conjunto aceptado: G01→G02→G03→G04→G05→G06→G07→G08→G09→G10→G11→G12→G13. Es una secuencia conservadora de revisión/integración futura, no una afirmación de dependencia funcional entre todos los pares: #34 es cliente temporal y #36/#38 son ramas hermanas sobre #29. Seguridad N01/B01/B03/B02/B05 se revisa prioritariamente, aunque B05 necesite G04/G05 como base antes de integrar.

## Punto CI obligatorio después de cada grupo

**Los13puntos están pendientes para una futura integración autorizada.** La CI final219/219 de #41 no se asigna a estos13SHA históricos como si cada uno la hubiera ejecutado. #41 no se fusiona en bloque. #3 no tiene workflow propio; G01 agrupa #3/#5/#7 para que el primer candidato ya contenga E01 y pueda tener CI completa antes de considerar ese grupo.

Para cada Gxx:

1. Verificar que main y los heads de entrada no se han movido sin revisión; fijar SHA de base, heads y candidato. El candidato debe descender del grupo previo realmente aprobado, no de una simulación de dependencia satisfecha.
2. Revisar diff propio de1–2PR (G01 excepcionalmente3para bootstrap CI), bases y handoffs H01–H05. Incorporar resoluciones en el PR receptor señalado; registrar SHA nuevo y diff. No aplicar merges de #41 indiscriminadamente.
3. CI del candidato exacto: Node24.19.0/Bun1.4.4, checkout/dependencias limpias, `bun install --frozen-lockfile`, `npm test`, `npm run lint`, `npm run build`, `npm run smoke:production`, lock/package intactos y `git diff --check`. Desde G01 existe check:runtime; desde G04 añadir `bun audit --production` como en E02. No pinnear recuentos individuales históricos como resultado esperado de un grupo combinado.
4. Ejecutar la cobertura específica de la tabla y los fixtures Chromium introducidos hasta ese punto, con red externa bloqueada o fixtures en sus fronteras. Conservar todos los tests de las unidades anteriores. En G13: transportar también egress-combination; el árbol revisado de referencia tiene219casos más7fixtures Chromium.
5. Registrar URL y conclusión CI, SHA exacto probado, reviewer independiente y dictamen. Si hay cambios solicitados o CI roja, corregir el receptor correspondiente y repetir; no continuar al siguiente grupo ocultando la regresión.
6. Confirmar autorización explícita del propietario para una eventual integración de ese grupo. **Este paquete no la concede y no ejecuta ninguna fusión.** Tras cualquier integración futura, verificar el SHA resultante/CI y retargetar las siguientes propuestas sobre la base real; una aprobación anterior no cubre nuevos cambios de base/diff.

Registro mínimo por grupo:

```text
group: Gxx
base_sha: <40hex>
input_pr_heads: <PR:40hex>
resolution_commit: <40hex or none>
candidate_sha: <40hex>
ci_url: <run tied to candidate>
ci_result: pending | success | failure
reviewer: <authorized independent user/team or unassigned>
review_result: pending | changes_requested | approved | blocked
owner_integration_authorization: pending | explicit-reference
resulting_main_sha: not-integrated (until a future authorized integration)
residual_risks: B04/C01/C02 + group-specific risks
```

## Bloqueos actuales

- Revisores independientes sin usuario/equipo autorizado designado. No reviews/aprobaciones registradas; las solicitudes de conversación no equivalen a asignación formal ni aprobación.
- H01–H05 sólo están resueltos en el ensayo; #27/#32/#34/#36/#40 deben incorporarlos en sus propias bases adecuadas y obtener nuevo SHA/CI/review.
- Todos los PR y dependencias siguen sin integrar en main. El resultado aceptado de #41 demuestra compatibilidad de ese árbol, no disponibilidad de correcciones aisladas en main.
- Ningún checkpoint futuro, autorización de integración, despliegue o uso de credenciales reales queda concedido por este documento.
- B04/C01/C02 requieren decisión de custodia/legado sin UID; incluso después de integrar estos grupos siguen abiertos. I10 requiere volumen privado persistente para un despliegue real; revocación Firebase, cuotas distribuidas, push durable, contexto de cliente y streaming no quedan acreditados.
