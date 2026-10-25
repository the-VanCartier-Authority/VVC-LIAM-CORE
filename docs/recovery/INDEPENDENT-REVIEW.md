# Paquete para revisión independiente · VVC LIAM CORE

2026-10-25 · Issue #2. Preparación documental autorizada. El propietario acepta la consolidación como **evidencia técnica, sin autorizar integración**. No hay aprobación independiente registrada. No se solicita fusionar, desplegar ni utilizar credenciales reales.

La referencia aceptada es **PR #41, draft, `83873585c7f851da9aae435883739d448194a24d`**, código/tests `57fc012f2ed8894313cc7e2770504611a10cb05b`. Se conserva sin modificar. CI [40143730974](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/actions/runs/40143730974): 219/219 tests, Bun1.4.4/Node24.19.0, frozen install, tipos/build/smoke/audit correctos; siete fixtures Chromium locales. Son pruebas del autor y evidencia aceptada, **no una revisión independiente ni CI de futuros grupos**.

Este paquete se publica en una rama documental separada, basada en #41, para mantener inmutables sus resultados y los heads originales. [Consolidación](CONSOLIDATION.md), [snapshot actual](review/pr-snapshot-20261025.json), [grupos y candidatos exactos](review/review-groups.json), [traspaso de resoluciones](review/resolution-handoff.json), [inventario de regresiones](review/retained-test-blobs.json).

## PR prioritarios preparados para revisión

OPEN/UNMERGED y sin reviews ni threads de revisión al consultar el 25 de octubre. Revisores solicitados/equipos: ninguno designado. La disponibilidad para revisión no significa disponibilidad para integración.

| Prioridad de revisión | PR / alcance | Head exacto a revisar | Dependencia técnica disponible en su rama | Estado de evidencia |
|---|---|---|---|---|
| 1 | #3 · N01/F01 | `0be6e86a0099c2c6f4947695b69522a2ba5e864f` | main `2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7` | 63 tests aislados repetidos; 219 conjuntos; revisar endurecimiento IP además del arreglo inicial |
| 2 | #9 · B01 identidad | `f5362170157dd102f890d3378450c7afd46733c9` | #7 E01 ← #5 D01 ← #3 | 89 tests en CI40082333641; cubierto por el conjunto aceptado |
| 2 | #11 · B03 ownership | `6f94b7c61cf45536fd99cbecc8bed5ffcb8fa7af` | #9, UID verificado | 94 tests en CI40082651240; dos UID; conjunto con SQLite I10 |
| 3 | #13 · B02 límites | `2740edda574a6823496b5dd28cd167cde0c44ffa` | #11/#9, identidad y propietario | 101 tests en CI40083272358; conjunto con I10/I11b |
| 4 | #21 · B05 push | `34ce45da31590a8745418ff493d6cd3cd265f536` | #19 inicial; su ascendencia contiene #17/#15/#13/#11/#9 | 125 tests en CI40086045373; conjunto con transporte binario/cancelación |

Los SHA/CI individuales son los de los paquetes publicados, no nuevas ejecuciones individuales de esta etapa. No hay ninguna de estas correcciones integrada en main. #7 parte del D01 inicial `963645202ecd76cac62afd54c8f9cd215b5c29b2`, y #21 del D03 inicial `6aeca68a9ab45ed9c936f2550510b6134bd57070`: las ampliaciones actuales de #5/#19 deben conservarse. El snapshot distingue SHA del ref remoto actual, merge-base real y metadatos devueltos por GitHub; no deben confundirse.

## Encargo de revisión de seguridad

Las siguientes comprobaciones están **pendientes del revisor independiente**. El conjunto aceptado aporta reproducciones; el revisor debe inspeccionar el código y decidir si la cobertura prueba cada garantía. Puede revisar los cinco paquetes de seguridad antes que los demás, aunque la futura integración deba respetar sus dependencias.

### N01 · destinos, secretos y transporte

- [ ] Revisar `providerEgress.ts`, los cinco sinks en server.ts y el cruce B05/I11b H05. El cliente autenticado puede controlar providerId/endpoint/BYOK, pero no crear registros administrativos, elegir variables de clave ajenas o ampliar excepciones.
- [ ] Confirmar selección exacta de URL registrada, key env dedicada y allowByok por proveedor; ni clave NVIDIA ni Gemini pasan a destinos custom. Errores/logs no devuelven credenciales ni cuerpos del proveedor.
- [ ] Verificar todos los resultados A/AAAA, alias numéricos IPv4, IPv6/mapped/metadata/redes reservadas y excepciones **providerId+host+puerto+lista exacta de IP**. Sin CIDR privado completo ni opciones de conexión procedentes del cliente.
- [ ] Verificar lookup fijado y peer/puerto reales antes de req.end, TLS/CA/hostname/SNI, ausencia de redirects/pooling/proxy o retries implícitos. Fallback de IP sólo antes de transmitir, dentro del snapshot validado; intentos posteriores vuelven a resolver.
- [ ] Revisar aborto antes/durante DNS/TLS/cuerpo, no iniciar fallback tras abortar y fin normal de request sin falsa cancelación. Mantener las dos regresiones binarias de H05.
- [ ] Distinguir transporte propio fijado de Gemini SDK en origen fijo con TLS normal. No extrapolar pinning, disponibilidad del servicio o custodia zero-knowledge al SDK ni al uso BYOK.

Evidencia: `f01-regression`, `provider-egress`, `provider-http`, `local-exception-review`, `provider-cancellation`, `chat-cancellation-regression`, `egress-combination` y `gemini-compat`.

### B01 · identidad del backend

- [ ] Revisar `firebaseIdentity.ts` y orden del middleware en server.ts: identidad antes de límites, JSON, política y cancelación. Sólo GET config/vapid-public-key/vaos/health son públicos; confirmar que no exponen secretos.
- [ ] Comprobar firma RS256 con JWKS fijo, kid, issuer, audience/proyecto, sub, iat/exp/auth_time, expiración máxima y rechazo de claims/tokens inválidos. Sin bypass de emulador ni UID del body/header alternativo.
- [ ] Rechazar Authorization duplicada/malformada; identidad inmutable; errores 401 sanitizados incluso ante fallo JWKS. Separar ID token Firebase de OAuth Workspace; backendFetch sólo envía ID token al mismo origen.
- [ ] Inspeccionar rotación/cache/deadline de claves y qué ocurre si Google no responde. Las firmas JWT efímeras verifican el algoritmo real; no son cuentas/tokens reales ni prueban revocación administrativa.

Evidencia: `backend-auth`, `backend-auth-regression`, `identity-fixture`, `mock-firebase-jwks`, smoke con identidad ausente/válida. Riesgo abierto: token válido hasta expirar (máximo1h), revocación inmediata y Firebase real no acreditados.

### B02 · cuotas, carga y lifetimes

- [ ] Revisar `backendLimits.ts`, JSON256KiB/campos/messages/modelo/tokens, cuotas por UID, concurrencia global/usuario y Retry-After. Verificar rechazo antes de ejecutar proveedor.
- [ ] Confirmar leases idempotentes y retención ante disconnect hasta deadline acotado; la nueva cancelación no debe permitir liberar/reutilizar cupos mientras quede trabajo activo. La reserva de tokens es conservadora, no medición ni facturación.
- [ ] Revisar I10: tareas admitidas, recuperación, límites activos y presupuesto durable; contrastar el presupuesto SQLite con el contador RAM de otras rutas. No afirmar una cuota agregada/distribuida que no exista.
- [ ] Confirmar SDK/intentos/timeouts acotados; cancelación tardía no inicia otro modelo/proveedor. Documentar capacidad retenida conservadoramente tras desconectar.
- [ ] Valorar protección de infraestructura previa a autenticar; B02 no acredita defensa DDoS ni coordinación entre instancias/reinicios.

Evidencia: `resource-limits`, `resource-limits-regression`, `vaos-durable-unit`, `vaos-recovery-http`, `chat-cancellation-regression` y tests de push/concurrencia.

### B03 · propiedad y aislamiento VAOS

- [ ] Revisar orquestador, API y store: ownerUid procede sólo del UID verificado. Filtrar antes de límites/estadísticas; detalle inexistente/ajeno con404 indistinguible; no exponer pruebas de sistema como actividad del usuario.
- [ ] Seguir el propietario a través de admisión, procesamiento, persistencia/reinicio, listado, telemetría, cancelación y retry. Clave idempotente/fingerprint ligados al UID; no reclamar tarea de otra cuenta.
- [ ] Revisar I10/H04: commit antes de ack/proveedor; QUEUED recuperable bajo política actual, PROCESSING interrumpido sin repetición automática; reintento explícito ante entrega incierta.
- [ ] No extender estas garantías a datos de navegador, historial sin UID, bóveda, backups o archivos que B04/C01/C02 aún no protegen.

Evidencia: `vaos-ownership`, `vaos-durable-regression`, `vaos-durable-unit`, `vaos-recovery-http`, `metric-provenance` y `vaos-poll-browser`.

### B05 · audiencia y aislamiento push

- [ ] Revisar `pushDelivery.ts`, endpoints push y transición de identidad del cliente: registrar/contar/enviar/borrar sólo propios, conflicto409 al reclamar ajeno,404 en borrado ajeno. Callback retiene UID y revalida registros tras cada await; una respuesta410 tardía no borra reemplazos.
- [ ] Sólo HTTPS443/hosts exactos administrados, claves P-256/auth válidas, límites de dispositivos/despachos/timers/payload y rutas locales de navegación/iconos. Push no tiene excepciones de red privada.
- [ ] web-push sólo genera ciphertext/VAPID; sender usa postProviderBytes común con DNS/peer/TLS/redirects F01. Revisar H05 sin volver al sender HTTP irrestricto ni perder bytes/headers/Content-Length.
- [ ] Registro HTTP aceptado antes de marcar UID; logout/cambio de cuenta y carreras no restauran credenciales anteriores. Aceptación del servicio no demuestra entrega/visualización; no se puede retirar un push ya transmitido.
- [ ] Declarar registros/VAPID generados/timers volátiles y límites por proceso. El SW, scheduler durable y validación de dispositivos reales siguen fuera de esta evidencia.

Evidencia: `push-ownership`, `push-delivery`, `push-session`, `provider-http`, `provider-cancellation`, `egress-combination` y privacidad Chromium.

## Resoluciones que deben volver a los PR originales

**Bloqueo de integración vigente:** estas cinco resoluciones están en #41, todavía no en los heads originales. Este paquete asigna receptores y conserva el diff revisable. No se ha portado código silenciosamente ni se declara el bloqueo resuelto por publicar documentación.

| Handoff | PR receptor | Resolución del ensayo | Archivos / resultado que debe conservar | Momento de incorporación |
|---|---|---|---|---|
| H01 | **#27** | `c3140d7b49bb3bbe2bf6221bdc55d9aad1041221` | server.ts: imports de pushDelivery + modelRouting | Al actualizar su base sobre el tronco que ya incluya #21; #29 debe conservarlos al añadir chatPolicy |
| H02 | **#32** | `3d2e0272705bad2ffd118c40ffce9978aa86f5cd` | App.tsx: backendFetch/modelRouting junto a actionConfirmation/Dialog | Al rebasar el cliente sobre el tronco protegido #29; conservar backendFetch de #9 y las ampliaciones #5/#19 |
| H03 | **#34** | `42f781b837b834ecffb145628713021019e8b1d8` | App fecha civil+título D03; Calendar estado local; ICS temporal+ExecutionOutcome D01 | Tras resolver H02 y disponer de los heads ampliados de #5/#19 |
| H04 | **#36** | `2bc17b4c4c4c2a9662e3018dc76cf9957f15a761` | Orquestador durable y TelemetryPanel: métricas D02 requeridas/monotónicas, polling de terminales I10, sin recuperar el proceso antiguo de tres modelos | Al actualizar su base con #17 y tronco #29. Mantener B01/B03/B02 y store SQLite |
| H05 | **#40** | `d34ca3d9f62aedaa6fe2e2056c6cafc6092339a3` + test `57fc012f2ed8894313cc7e2770504611a10cb05b` | providerEgress: signal opcional recorre JSON/binario/postEncoded/sendPinned; **traspasar también tests/egress-combination.test.mjs** | Después de #38 sobre base que incluya B05. No copiar cancelación hacia #21 invirtiendo dependencias |

[resolution-handoff.json](review/resolution-handoff.json) contiene heads receptores, blobs de los archivos resueltos y tests que conservar. Los `H*-resolution-review.diff` son salidas de **git show --remerge-diff**, para revisar decisiones de conflicto, no parches para aplicar a ciegas. Los archivos completos del ensayo contienen cambios de otros PR: no sobrescribir los originales con ellos ni cherry-pickear merges completos sin revisar su alcance.

#3/#9/#11/#13/#21 ya contienen sus arreglos propios; no necesitan absorber código de I10/I11 para demostrar esos arreglos. Requieren revisión de las interfaces conjuntas y nuevas bases. #38 no tuvo conflicto, pero debe conservar su contexto/config al recibir #40. Los cinco traspasos necesitan un nuevo SHA receptor, diff acotado, CI y revisión independiente: los SHA actuales dejan de servir como aprobación de un árbol modificado.

## Regresiones que se conservan

No se cambia ningún archivo de tests ni fuente en esta etapa. [retained-test-blobs.json](review/retained-test-blobs.json) fija todas las rutas de tests/fixtures/scripts del ensayo y sus blobs. Las reproducciones históricas permanecen en Git y docs/recovery/evidence/; no se sustituyen por pruebas que sólo describan la implementación.

| Unidad | Commit de reproducción anterior al arreglo | Evidencia que el revisor debe seguir |
|---|---|---|
| N01 | `ba253050b0972c0683d72658ce503bcf2602fd91` y `7d278f8d1ecf4b29875de42dcf6b6117a072c001` | Cinco sinks/secretos sintéticos y ampliación indebida de excepciones DNS |
| B01 | `c4715767278c2b7aef7ecbd39d855001fbd95d64` | Acceso sin token en endpoints sensibles |
| B03 | `c81c6192d4de695fa9993c563f9ecbe43393edf9` | Lectura cruzada entre dos UID |
| B02 | `994dec18987d850eb804e7c6be7265228350a24a` | Ausencia de límites autenticados |
| B05 | `11c073502fb76743a0336b7094171a3ffbf372fc` | Audiencia/registro/borrado ajenos |
| B05 + I11b | baseline `c2d3533c5455fb991933bc03725c85cc2e61ec9e` + test nuevo en `57fc012f2ed8894313cc7e2770504611a10cb05b` | Dos fallos antes y dos pass después; no atribuirlos a #40 aislado, que carece de B05 |

Al actualizar un receptor: conservar las regresiones relevantes anteriores y sumar las de integración; un test deshabilitado/omitido o eliminado invalida el punto de control. Adaptaciones necesarias por un nuevo contrato exigen explicación del caso protegido, no sólo cambiar el valor esperado.

## Secuencia futura y puntos CI

La [secuencia con todos los SHA exactos](REVIEW-GROUPS.md) divide los19PR en13grupos: uno fundacional de3PR para disponer de CI y el resto de1–2PR. Sus candidatos son ancestros **existentes** del ensayo aceptado, no nuevas integraciones. Ningún punto futuro se marca aprobado por la CI final de #41.

Cada grupo requiere, sobre su candidato exacto y base anterior efectivamente autorizada: revisión independiente del diff, resolución de sus handoffs, Node24.19.0/Bun1.4.4, instalación congelada limpia, suite completa presente en ese grupo, tipos/build/smoke, lock intacto y evidencia CI enlazada. Desde G04 se exige también audit production como en E02. Desde cada grupo que introduzca UI se ejecutan sus fixtures de navegador con fronteras externas bloqueadas. G13 debe conservar el mínimo de cobertura219casos de este ensayo o justificar cualquier cambio de composición; **un número de pruebas por sí solo no prueba equivalencia**.

**CI roja, SHA/base movidos, handoff pendiente o revisión ausente detienen el siguiente grupo.** Un candidato futuro será un SHA nuevo: no hereda automáticamente los resultados de un ancestro ni del head aceptado. La autorización explícita del propietario para integrar sigue siendo un requisito separado; este documento no concede ninguna.

## Riesgos que seguirán abiertos tras integrar los grupos

| Riesgo pendiente | Lo que estos PR no resuelven | Condición de trabajo posterior |
|---|---|---|
| **B04 · estado local** | B01/B03 no separan por UID todos los datos/historiales del navegador. Los datos antiguos sin UID no tienen propietario acreditado; riesgo de exposición en equipo compartido o asignación errónea | Decisión explícita del propietario sobre cuarentena intacta sin asignación o UID designado; después migración versionada/atómica, cambio de cuenta y dos usuarios. No se han movido/asignado/borrado datos |
| **C01 · bóveda** | No se acredita contraseña propia, bloqueo que impida nuevos usos de secretos, persistencia cifrada/backup/restauración/recuperación correctos. El aislamiento HTTP no prueba cifrado local ni E2EE de extremo a extremo | Modelo de amenaza, diseño de custodia y decisión sobre legado; pruebas de recarga/clave incorrecta/interrupción/backup sin pérdida antes de declarar protección |
| **C02 · credenciales** | N01 restringe destinos pero no elimina nuevas escrituras inseguras ni migra API keys existentes del navegador. BYOK sigue atravesando servidor/proveedor; no es zero-knowledge | Detener escrituras en claro y migrar de forma controlada, recuperable e interrumpible tras decidir legado; bóveda bloqueada debe impedir nuevos usos. Sin claves reales en las pruebas |
| Sesiones/backend | No hay revocación administrativa inmediata ni verificación Firebase real; token válido hasta expirar. No se acredita protección DDoS previa a autenticar | Entorno de ensayo autorizado y política operativa/infraestructura; no usar cuentas reales sin autorización |
| Recursos/almacenamiento | Cuotas RAM por proceso; presupuesto durable I10 no es facturación/cuota distribuida única. SQLite y comandos/resultados sin cifrado de aplicación; no volumen remoto/HA/backup acreditado | Despliegue y custodia propios en otro trabajo autorizado; archivos privados y retención limitada no equivalen a borrado forense |
| Push | Registros, VAPID generado y programación volátiles; aceptación no prueba recepción; nada ya transmitido puede retirarse | Scheduler/SW/recuperación y dispositivos reales siguen pendientes |
| LLM/fechas | I11 parcial: contexto cliente por identidad/custodia, streaming/UI; SDK Gemini sin pinning propio. Fechas no implementan I05/I09 ni migración histórica | Unidades posteriores tras revisión, sin ampliar esta etapa |

F28/F31 siguen siendo lagunas documentales; no se les asignan nuevos hallazgos. Esta revisión no equivale a dictamen global de producción ni cierra Z01–Z03.

## Solicitud y registro de revisión independiente

No se ha proporcionado usuario/equipo autorizado y no hay CODEOWNERS ni review requests que lo identifiquen en el estado consultado. No se pide review al propio autor, no se inventan identidades/aprobaciones y no se considera la aceptación técnica del propietario como permiso de integración. Las solicitudes anteriores de los PR se enlazan en #2; este paquete añade el encargo específico B01/B02/B03/B05.

Cuando el propietario designe usuario/equipo con acceso, solicitar formalmente review en #3/#9/#11/#13/#21 y en los receptores afectados por sus resoluciones, en grupos pequeños. Registrar por cada grupo: identidad del revisor, independencia del autor, head y base exactos, resolución revisada, URL de CI, dictamen (aprobado/cambios solicitados/bloqueado), fecha y riesgos aceptados. Un nuevo commit o resolución requiere revisión del nuevo diff. Hasta entonces: **UNASSIGNED / NOT APPROVED**.
