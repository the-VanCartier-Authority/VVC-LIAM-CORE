# Consolidación técnica de PR #3, #34, #36, #38 y #40

2026-10-24 · Seguimiento #2. Diagnóstico del autor, **sin aprobación independiente**. No solicita fusionar esta rama de ensayo.

**Resultado: compatibilidad verificada con resoluciones explícitas**, no combinación automática sin conflictos. Instalación limpia congelada, **219/219 pruebas**, TypeScript, build, smoke productivo y siete fixtures Chromium pasan. La solución F01 conserva sus regresiones. No hubo fallos de ejecución en la suite conjunta corregida; los conflictos y las dos regresiones antes/después se detallan abajo. Ningún PR está integrado en main.

## Base y trazabilidad

- `main` remota: `2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7`, intacta.
- Auditoría PR #1: `1f915074d374a8f98421808ede347e241b014114`, informes históricos intactos; F28/F31 siguen siendo lagunas documentales.
- Rama temporal: `verify/pr3-34-36-38-40-20261024`, reconstruida desde main, sin reutilizar como base una combinación local no publicada.
- Resolución funcional final del transporte combinado: `d34ca3d9f62aedaa6fe2e2056c6cafc6092339a3`.
- SHA de código y pruebas conjunto: `57fc012f2ed8894313cc7e2770504611a10cb05b`; tree `8ba6867186a626d76573200adb55cf6e6d12247b`. Los commits posteriores de este diagnóstico añaden documentación/evidencias.
- Evidencia en [evidence/consolidation/](evidence/consolidation/): snapshot de PR, inventario de commits y ascendencia, secuencia de merges locales, logs completos locales y extractos de CI individual. Las comprobaciones GitHub se realizaron antes de publicar este informe; todos los PR objetivo estaban OPEN, no draft, no merged y sin reviews.
- Los cambios locales no publicados de `/workspace/vvc-i11b` se conservaron intactos. Se usó el head **remoto** `5934384e…`, no su antiguo commit local `751de7f…`.

## Matriz de compatibilidad

Los resultados individuales de #34/#36/#38/#40 son la CI existente del **head exacto**, consultada nuevamente y con logs comprobados; no se presentan como una repetición local individual nueva. #3 sí se volvió a comprobar desde otro worktree limpio. En todos los casos, el resultado conjunto procede del SHA `57fc012…` e incluye las demás dependencias enumeradas.

| PR / unidad | SHA funcional y head observado | Base de comparación | Dependencias disponibles / ausentes en su propia base | Resultado individual | Resultado conjunto | Conflictos / regresiones | Revisión independiente |
|---|---|---|---|---|---|---|---|
| [#3](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/pull/3) N01/F01 | Inicial `2adf45eb85b39d925b32e7dbbc07beebf9258bc9`; endurecimiento y head `0be6e86a0099c2c6f4947695b69522a2ba5e864f` | main `2ffadf44…` | Unidad fundacional; no contiene B01/B03/E01/E02 | **63/63**, nueva instalación congelada, tipos/build/smoke | **219/219**; sinks, claves, TLS, DNS/IP y excepciones exactas pasan | Su transporte se combina con B05 e I11b; ver resolución d34ca3d | Pendiente; revisión del autor únicamente |
| [#34](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/pull/34) I08 | Funcional y head `2e256477e02e255c6664ed660ff055054c7458f9` | #32 `159817d7eb49b3b8e88256c501097655ed805b23` | #32 ← #25 ← #7 ← #5 ← #3. **No B01/B03/B02/E02**; no son requisitos del cálculo temporal puro, pero esta base por sí sola no ofrece backend protegido | **109/109**, [CI 40120963124](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/actions/runs/40120963124) | **219/219**, Chromium temporal y confirmación pasan con backend protegido presente | App muestra civil/D03; Calendar estado local; ICS temporal + resultados veraces D01 | Pendiente |
| [#36](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/pull/36) I10 | Funcional y head `7ab086e878e27e53fd58ef0b1280bbcd264deb3d` | #29 `947e0357c56fa66a502bf44248b3afc8f24f174a` | #29 ← #27 ← #23 ← #13 ← #11(B03) ← #9(B01) ← #7 ← #5 ← #3. No E02/D02/B05 en su base mínima | **136/136**, [CI 40122938616](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/actions/runs/40122938616) | **219/219**, SIGKILL/reinicio, dos UID, idempotencia, cancelación y fallos de disco pasan | Conflicto D02: orquestador durable + procedencia/medición real; polling terminal I10 + métricas D02 | Pendiente; volumen productivo no acreditado |
| [#38](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/pull/38) I11a | Funcional y head `a462cfbdee3bda796bb8dca7e65a64f5d3637eae` | #29 `947e0357…` | Mismo tronco protegido que #36; no depende de I10. E02/D02/B05 ausentes de su base mínima | **124/124**, [CI 40137005556](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/actions/runs/40137005556) | **219/219**, HTTP de historial/system/config y Chromium NVIDIA/Gemini pasan | Merge automático; SDK recibe contexto/config y después señal I11b. No se mezcló el contrato de tareas VAOS con chat | Pendiente; I11 parcial |
| [#40](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/pull/40) I11b | Funcional `3a04048bf3b2e2a2692c6b61bbc23203daed7d62`; head documental `5934384efab7010bd0d436bb9234df64f1960551` | #38 `a462cfbd…` | #38 y su tronco B01/B03/B02/F01 disponibles; **B05/E02/D02 ausentes** de la base mínima | **133/133**, [CI 40138433344](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/actions/runs/40138433344) | **219/219**, cancelación DNS/TLS/cuerpo/SDK y fallback, más dos regresiones binarias | Conflicto real B05/I11b en providerEgress: signal debe atravesar postEncoded sin perder bytes/headers. Resuelto sólo en esta rama de integración | Pendiente; I11 parcial |

El inventario JSON contiene SHA completos y las bases de comparación exactas.

## Código funcional frente a documentación

- #3: `ba253050…` y `7d278f8d…` son reproducciones; `2adf45eb…` y **`0be6e86a…` cambian código**. `0a25525a406436c177962887eb335fd5d5488df3` es documental. No basta integrar sólo el primer arreglo sin las excepciones IP exactas.
- #34: `699f99e5…` y `905870ff…` son reproducciones; `2e256477…` contiene código, tests y documentación. No hay commit documental separado en este diff.
- #36: `2198ca23…` es reproducción; `7ab086e8…` contiene código, tests y documentación.
- #38: `57c6ba29…` es reproducción; `a462cfbd…` contiene código, tests y documentación.
- #40: `8c2faa7c…` reproduce tres fallos; `3a04048b…` cambia código y pruebas; `5934384e…` añade sólo evidencia/documentación. La CI del head documental también pasa.

## Reconstrucción y resolución de conflictos

Secuencia efectivamente aplicada, con merges **locales en la rama de ensayo**, sin fusionar PR GitHub:

`main → #3 → #5 → #7 → #9 → #11 → #13 → #15 → #17 → #19 → #21 → #23 → #27 → #29 → #25 → #32 → #34 → #36 → #38 → #40`.

Cada head exacto y resultado de merge consta en `merge-sequence.jsonl` y `pr-snapshot.json`. Se incluyeron los heads ampliados de D01 y D03; sus versiones iniciales heredadas por ramas posteriores no sustituyen estas ampliaciones.

| Cruce | Conflicto observado | Resolución y contrato conservado |
|---|---|---|
| #21 + #27 | imports server.ts | Mantener PushDestinations/Registry/Sender y modelRouting; añadir posteriormente chatPolicy sin perderlos |
| Routing/auth + #32 | imports App.tsx | Mantener backendFetch/modelRouting y actionConfirmation/SensitiveActionDialog |
| D03/D01 + #34 | App.tsx, CalendarRemindersModal.tsx, ical.ts | Título de privacidad veraz + fecha civil; estado local sin éxito ficticio; imports temporales junto a ExecutionOutcome del webhook |
| D02 + #36 | vaosOrchestrator.ts, TelemetryPanel.tsx | Proceso durable/commit antes del proveedor, leases, cancelación y taskPollView; conservar métricas con procedencia, reloj monotónico y campos requeridos D02. Descartar el proceso antiguo de tres modelos automáticos |
| B05 + #40 | providerEgress.ts | Mantener API JSON postProvider y API binaria postProviderBytes; añadir signal opcional hasta postEncoded/sendPinned. Conservar Buffer/Content-Length, allowlist de headers, peer IP/puerto, CA/SNI, DNS completo y rechazo de redirects. No introducir un transporte alternativo |

La comparación de App, Calendar, ICS, orquestador y TelemetryPanel con el último conjunto local de I11a (`c2d3533…`) resultó idéntica antes de la adición I11b. Esta reconstrucción hace publicables y revisables las resoluciones previamente sólo locales.

### Regresiones de la combinación B05/I11b

`tests/egress-combination.test.mjs` contiene dos casos: aborto binario previo sin DNS/HTTP, y aborto durante respuesta parcial que mantiene bytes/cabecera exactos y permite peticiones JSON/binarias posteriores independientes. Cifra y autorización son sintéticas; sólo sockets loopback expresamente registrados en fixtures.

- Antes, sobre `c2d3533c5455fb991933bc03725c85cc2e61ec9e` con el test nuevo: **0 pass / 2 fail**, exit 1; señal ignorada y vencimiento como UpstreamError. Esto reproduce la falta de cancelación del transporte binario anterior; no se atribuye a #40 aislado, que no contiene B05.
- Después, resolución `d34ca3d…` + test `57fc012…`: **2 pass / 0 fail**, exit 0.
- Un primer intento sin permiso de red local produjo EPERM al escuchar 127.0.0.1. Es un bloqueo del sandbox, **no evidencia del defecto**. Los logs before/after publicados corresponden a las repeticiones con sockets locales habilitados.
- El conflicto sintáctico inicial de Git no se presenta como una suite ejecutada. La suite sólo se ejecutó después de resolverlo; no tuvo fallos restantes ni pruebas omitidas/canceladas.

## Verificación por subsistema

- **SSRF/F01**: cinco sinks arbitrarios rechazados; registro exclusivo del servidor, selección exacta de endpoint, claves server/BYOK separadas, DNS completo/público o excepción proveedor/host/puerto/IP exacta, peer fijado antes de HTTP, TLS CA/hostname/SNI verificados, redirects rechazados y reintentos acotados. Incluye NIM, Gemini, OpenAI-compatible, Ollama y vLLM mediante fixtures. Gemini usa el SDK en origen fijo y su TLS normal: no se atribuye al SDK el pinning del transporte HTTP propio ni una prueba real de disponibilidad del servicio.
- **Cancelación**: señal antes/durante DNS, rechazo DNS tardío manejado, TLS pendiente sin credenciales HTTP, cuerpo parcial, Gemini SDK y rechazo de fallback tras desconectar. Fin normal del request no cancela la respuesta. B05 conserva envío binario y sus restricciones; no se afirman retiradas de generaciones ya recibidas por un proveedor.
- **Contexto Gemini**: contents user/model e instrucción system nativa; turnos explícitos conservados, duplicados contradictorios 400 antes del SDK, parámetros acotados, fallback sólo autorizado. App aún envía system + turno actual; historial de cliente por identidad/custodia y streaming siguen fuera de este diagnóstico.
- **VAOS**: autenticación Firebase real del verificador con firmas efímeras y JWKS fixture, aislamiento de dos UID, SQLite privado, permisos/esquema/fallos de disco, ack durable, recuperación de QUEUED tras SIGKILL, PROCESSING→INTERRUPTED sin repetición automática, idempotencia y retry explícito. Cancelar chat no cancela tareas durables admitidas: sus contratos/lifetimes son distintos. Persistencia sólo en servidor único/disco local, comandos/resultados sin cifrado de aplicación; no hay prueba de volumen desplegado/HA/backup ni exactly-once remoto.
- **Fechas**: AM/PM/minutos, fecha civil por zona, IANA y DST ambiguo/inexistente, eventos nocturnos/conflictos cruzados, exportación UTC o floating según datos, rechazo explícito de recurrencia/ICS no soportado y proyección temporal Firestore mediante fixture. No implica I05 reconciliación, migración histórica ni scheduler I09.
- **Autenticación y almacenamiento**: middleware B01 antes de límites/JSON/política/cancelación, UID verificado para B03 e I10; clientes autenticados conservados al combinar App. B04/C01/C02 y datos históricos sin UID siguen pendientes de decisión; no se asignaron, migraron ni borraron. Auth no resuelve esa propiedad local. No se acreditó revocación Firebase real.

## Resultados y reproducción

Entorno limpio de dependencias en `/workspace/vvc-consolidation`; Node **24.19.0**, Bun **1.4.4**. Instalación 666 paquetes desde bun.lock intacto. Suite **219 pass / 0 fail / 0 skipped / 0 cancelled**. Tipos/build/smoke y audit production `{}` exit 0. Build mantiene el aviso de tamaño de bundle; no es un fallo de compilación.

Smoke de servidor construido con NODE_ENV=production: HTML/asset/manifest 200; cuatro destinos rechazados con cero llamadas; fixture registrado alcanzado una vez; identidad ausente 401, válida 200; Gemini sin clave 401; externalInferenceCalls=0. Es un smoke local del modo producción, no despliegue productivo remoto.

Siete fixtures Chromium **154.0.8037.57**, todos repetidos en este conjunto: privacy, capability-claims, model-selector, chat-decision (NVIDIA/Gemini), intent-confirmation, temporal y vaos-poll. APIs externas bloqueadas o reemplazadas por fixtures en sus fronteras; ninguna operación Google, push, dispositivo, inferencia o servicio de pago real. Marca/logo/icono conservados.

Desde un checkout nuevo de esta rama (en un entorno con sockets loopback habilitados):

```bash
node --version # v24.19.0
bun --version # 1.4.4
bun install --frozen-lockfile
npm run check:runtime
npm test
npm run lint
npm run build
npm run smoke:production
bun audit --production --json
git diff --exit-code -- bun.lock package.json
git diff --check
```

Navegador opcional reproducible, sin modificar dependencias del producto: instalar `playwright-core@1.64.1` en un prefijo temporal, disponer de Chromium en `/usr/bin/chromium`, establecer PLAYWRIGHT_CORE_PATH al directorio de ese paquete y ejecutar los siete `tests/*-browser.mjs` enumerados. `run-verification.sh` en las evidencias recoge los comandos ejecutados. La CI del PR de diagnóstico repite frozen install/suite/tipos/build/smoke/audit; sus resultados finales se enlazan en #2, separadamente de las pruebas locales.

## Dictamen y orden recomendado

**Apto para revisión independiente de la combinación con las resoluciones documentadas. No aprobado para integración directa ni para producción.** No basta fusionar los cinco PR objetivo: B01/B03 y otras dependencias están disponibles en ramas, no integradas en main. Las bases mínimas omiten E02 y otros parches; esta combinación sí los incluye y se comprobó, sin dar por cerradas las unidades pendientes.

Orden propuesto, siempre con revisión y autorización de integración por el propietario:

1. #3 completo; #5 ampliado y #7; #9 B01, #11 B03 y #13 B02.
2. #15 E02, #17 D02, #19 ampliado D03 y #21 B05, para conservar el estado de seguridad/contratos ensayado.
3. Tronco servidor #23 → #27 → #29, conservando imports de B05. Rama cliente #25 → #32 → #34, manteniendo auth, D01/D03 e I08.
4. #36 con las resoluciones D02/polling aquí identificadas; #38, luego #40 con la resolución binaria B05/I11b y sus regresiones. #36 y #38 comparten base pero no dependen entre sí; este orden reproduce la prueba publicada.
5. Retargetar/rebasar las propuestas según SHA realmente integrados y repetir CI tras cada resolución. Una aprobación individual previa no aprueba automáticamente un árbol nuevo. Este PR temporal puede servir de referencia de resoluciones, no debe fusionarse en bloque eludiendo las revisiones por unidad.

Revisión independiente solicitada por los canales del Issue/PR. No consta revisor humano/equipo designado ni aprobación. Se ha solicitado al propietario el usuario/equipo para asignación formal; no se solicita review al propio autor ni se simula aprobación. El diagnóstico no inicia otra oleada funcional, no cierra N01/I11/Z01–Z03 y no modifica los informes históricos.
