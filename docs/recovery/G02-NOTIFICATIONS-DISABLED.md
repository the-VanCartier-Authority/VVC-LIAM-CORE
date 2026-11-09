# G02 · Cierre integral de notificaciones · 2026-11-01

**PENDIENTE DE REVISIÓN INCREMENTAL. No fusionar, desplegar ni avanzar a G03.**

Manus comunicó CAMBIOS NECESARIOS sobre #11@a34d89e5db2ddd023f654261d322da434fdb9890. El cierre HTTP de #9@55bb6500694d189aea6695ad3932d2ed4e590116 era insuficiente: el cliente y los workers aún podían mostrar avisos. Main permanece en baf5f8bc5ef5cce1ce80e598cd522f3c8607356d.

Este cambio va primero en #9 (B01) y se incorpora por merge local de dependencia en #11 (B03), conservando ambos heads anteriores como ancestros. No se crea otro PR ni se importa código de otros grupos. Los SHA definitivos, CI y comparación incremental se publican en #9/#11 y el Issue #2; no se reutiliza la CI del candidato anterior.

## Reproducción independiente de servicios externos

Los ocho casos iniciales de `tests/notifications-disabled.test.mjs` se ejecutaron contra el árbol exacto a34d89e… antes de corregirlo. **0/8 pasan, 8/8 fallan por aserciones**; no por falta de módulos. El helper permite seleccionar ese árbol únicamente en los tests (`VVC_NOTIFICATION_TEST_ROOT`); no existe un override equivalente en el producto.

| Ruta | Antes (a34d89e…) | Después |
| --- | --- | --- |
| Mensaje SCHEDULE al worker público | 1 temporizador | 0 temporizadores, rechazo explícito |
| Mensaje SHOW al worker público | 1 showNotification | 0 |
| Push entrante | 1 lectura del payload, 1 showNotification | 0 lecturas, 0 avisos |
| Servicio cliente: permiso/suscripción/programación/envío/test | 2 permisos, 4 suscripciones, 2 showNotification, 1 mensaje, 9 peticiones en la secuencia sintética | Todos 0; resultados no disponibles |
| Backend mock responde 503 | Suscripción success=true; fallback separado crea 1 Notification tras 503 | success=false; el cliente no inicia ninguna petición/fallback |
| DeviceAdapter | Permiso solicitado, entrega true y 1 showNotification | Sin permiso/entrega, false |
| Settings | Controles habilitar/probar/programar visibles | Aviso de desactivación, sin esos controles |
| Activación de public/sw.js | Borra cachés ajenas/antiguas | Conserva ambas |

[Log rojo](evidence/g02/notifications-before.txt) · [Log verde de 13 regresiones](evidence/g02/notifications-after.txt). El rojo selecciona sólo los ocho casos originales; las cinco comprobaciones adicionales necesitan los nuevos módulos. Las pruebas anteriores HTTP push y UID se conservan sin modificaciones.

## Restricción efectiva y alcance del diff

- `src/shared/notificationPolicy.ts` fija el estado false. El backend conserva auth antes del gate y **503/PUSH_DISABLED**, success=false, outcome=unavailable, realExecution=false, antes de JSON/handlers. No se altera la verificación Firebase ni se implementa ownership B05.
- `pushNotificationService` no solicita permiso, no lee/crea/borrar suscripciones, no programa, no envía mensajes de aviso y no tiene fallback a Notification/showNotification/backend. Las operaciones devuelven indisponibilidad; unsubscribe devuelve false sin borrar datos. El status distingue permiso existente de servicio deshabilitado y suscripción antigua **desconocida (null)**. No afirma que se haya revocado o eliminado.
- `DeviceAdapter` deniega estas dos operaciones sin tocar sus otras capacidades. App no crea el intervalo de notificaciones de tareas, no emite audio/TTS/toast ni webhook de aviso. El ticker del cronómetro conserva su avance y transición de finalización, sin alerta. La agenda y sus datos siguen accesibles. La respuesta a comandos push indica indisponibilidad.
- Settings conserva el acceso a instalación PWA y sustituye sólo la sección de notificaciones por un estado deshabilitado. Se retira el chip de prueba push; se corrigen exclusivamente textos de ayuda/modelos/documentos que ofrecían notificaciones. No hay rediseño ni interruptor UI/query/entorno/localStorage para reactivarlas.
- `public/sw-push.js` es una extensión pasiva compartida por el **worker realmente registrado, public/sw.js**, y el generado por Workbox. Rechaza SHOW/SCHEDULE, no analiza push ni llama showNotification/setTimeout; tampoco abre URLs/ejecuta tareas desde notificaciones antiguas. Contesta con revisión fija a una consulta de política. La concordancia con la constante cliente se comprueba mediante tests.
- `public/sw.js` conserva fetch/cache/offline; se elimina la purga indiscriminada de cachés. Workbox conserva precache/offline, desactiva limpieza de cachés obsoletas y usa activación/claim explícitos. No se borran permisos, suscripciones, localStorage ni otros datos del navegador.

## Instalaciones con worker anterior

Un único coordinador en `src/services/serviceWorkerLifecycle.ts`, iniciado por `src/main.tsx`, registra **la misma URL /sw.js y scope /** con `updateViaCache:none` y llama update al cargar, volver online o hacerse visible. Se elimina la doble inscripción de index/App/plugin. El worker nuevo usa skipWaiting/clients.claim por su propio código; no se manda SKIP_WAITING a un worker antiguo desconocido.

El cliente sólo confirma la desactivación del worker controlador cuando recibe por MessageChannel la revisión exacta y enabled=false. Un worker antiguo silencioso agota un plazo de 1500ms y no se confirma. Es un plazo de protocolo, **no un temporizador de notificación**. Los puertos se cierran al terminar; un timeout tardío del controlador anterior no sobrescribe la confirmación del nuevo.

Chromium prueba el relevo desde un worker sintético antiguo para ambas variantes reales, confirma el nuevo controlador, inyecta mensajes/push sintéticos en su runtime y observa cero efectos. Comprueba cachés y almacenamiento centinela, además de navegación offline posterior. App/Settings se prueban con dos identidades sintéticas y fronteras Firebase/Firestore/backend/voz mockeadas; el servicio de notificaciones, adaptador, parser, componentes y workers son reales. La cuenta regresiva se inicia por el comando real y se deja vencer sin audio/avisos. No se afirma una integración real Firebase/Google.

**Límites:** el repositorio no detiene instantáneamente instalaciones anteriores. Hasta recibir/activar el worker nuevo y el cliente actualizado, una instalación offline, un despliegue anterior o temporizadores ya creados por código antiguo pueden continuar. No se ha desplegado ni comprobado un navegador de producción del propietario. Un push silencioso puede dar lugar a UI genérica del propio navegador, fuera de showNotification de VVC; los tests prueban cero llamadas de la aplicación, no control absoluto del sistema operativo. Alertas importadas previamente en calendarios externos tampoco se revocan.

## Comandos reproducibles

Requisitos: Node **24.19.0**, Bun **1.4.4**, Linux para el supervisor, Chromium fijado por playwright-core/bun.lock. Sin claves ni cuentas reales.

```sh
bun install --frozen-lockfile
npm run check:runtime
npm test
node --test --test-timeout=15000 tests/notifications-disabled.test.mjs
node --test --test-timeout=15000 tests/backend-auth*.test.mjs tests/push-disabled.test.mjs
# En #11 se añaden las pruebas tests/vaos-ownership*.test.mjs.
node --test --test-timeout=15000 tests/f01-regression.test.mjs tests/local-exception-review.test.mjs tests/provider-egress.test.mjs tests/provider-http.test.mjs tests/truthfulness-http.test.mjs tests/truthfulness-unit.test.mjs tests/webhook-truthfulness.test.mjs
npm run lint
npm run build
node node_modules/playwright-core/cli.js install --with-deps chromium
npm run test:browser
npm run smoke:production
git diff --exit-code -- bun.lock package.json
git diff --check
```

Para repetir el rojo, crear un worktree detached en a34d89e…, instalarlo con lock congelado y ejecutar desde el candidato nuevo:

```sh
VVC_NOTIFICATION_TEST_ROOT=/ruta/al/worktree-a34d89e/ node --test --test-timeout=15000 --test-name-pattern='^(actual |worker activation|client entry|503 |DeviceAdapter)' tests/notifications-disabled.test.mjs
```

El workflow ahora construye **antes de Chromium** para que la nueva fixture ensaye también dist/sw.js del árbol probado. `npm test` sigue siendo exclusivamente Node. Las fixtures de navegador se ejecutan explícitamente mediante el runner G01 sin cambios; no se atribuye cobertura de navegador a npm test. La nueva fixture bloquea tráfico remoto tanto con routing como con un proxy loopback cerrado (también para fetch del worker), y no invoca un proveedor real. El backend HTTP se prueba con dos JWT firmados sintéticos y transporte push observado/mockeado.

## Riesgos abiertos y puerta de revisión

B05 sigue pendiente: sin diseño nuevo de propiedad, audiencias, almacenamiento de endpoints ni habilitación del transporte. Permanecen B02, **B04 (datos heredados sin UID), C01 (bóveda/recuperación), C02 (secretos BYOK)**, revocación Firebase, persistencia/backup/multiinstancia y capacidades externas no verificadas. No se realizan migraciones destructivas ni se presume titularidad de datos heredados. Se conserva el aviso previo del build por tamaño del bundle.

La revisión independiente incremental debe examinar estos cambios de notificaciones y el relevo del worker sobre los dos SHA finales. No se atribuye una aprobación nueva a Manus ni a GitHub. **Pendiente de revisión y decisión expresa del propietario; ningún merge está autorizado en este ciclo.**
