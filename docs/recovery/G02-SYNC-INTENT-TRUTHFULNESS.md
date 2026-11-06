# G02 · Intención de sincronización sin ejecución · 2026-11-06

**PENDIENTE DE REVISIÓN INCREMENTAL. Sin fusión, despliegue ni avance a G03.**

Manus comunicó CAMBIOS NECESARIOS sobre #9@146a4620c788f78aac8675d30c6e0dd5e7a5762f y #11@5068ff973f6baa39dfeffdc1711b6a7eaed0c045. Main sigue en baf5f8bc5ef5cce1ce80e598cd522f3c8607356d. App/parser tienen blobs idénticos en ambos heads anteriores para las rutas examinadas. Los SHA/CI nuevos se registran en #9/#11/#2; la evidencia anterior no acredita el código nuevo.

## Reproducción exacta

Comandos: **sincronizar tareas**, **sincronizar calendario**, **sincronizar con notion**, **sync google**.

Antes de corregir el producto, cada comando devuelve «Sincronización en tiempo real completada con servicios en la nube y calendario», actionDetails «Sincronización Cloud: Google Calendar & Notion en vivo» y triggerThirdPartySync=true, aunque no se invoca un sincronizador. La rama de App sólo añade un tono al tono genérico de intención reconocida: **dos confirmaciones por comando**.

[Node antes](evidence/g02/sync-intent/node-before.txt) · [Node después](evidence/g02/sync-intent/node-after.txt) · [Chromium antes](evidence/g02/sync-intent/browser-before.txt) · [Chromium después](evidence/g02/sync-intent/browser-after.txt).

El rojo se ejecutó sobre el producto146a462… sin modificar: **4/5 Node fallan por aserciones y1control pasa**. Chromium prueba los cuatro comandos para dos identidades y dos controles de creación local (10escenarios): en las8invocaciones de sincronización se observan mensaje falso, trigger activo y dos tonos, con llamadas externas0, efectos de notificación0 y datos intactos.

## Corrección limitada

- La condición que reconoce los comandos y su orden no cambian. La respuesta es **«No se realizó ninguna sincronización externa. Esta función todavía no está disponible.»** y actionDetails declara indisponibilidad/no ejecución, sin presentar Google Calendar/Notion como sincronizados.
- El resultado reutiliza executionOutcome de D01: **unavailable, realExecution=false**. Su implementación compartida permanece intacta. CommandExecutionResult admite ese resultado opcional; no se crean recibos ni se añade estado a tareas o almacenamiento.
- Se retira triggerThirdPartySync de la interfaz, del resultado del parser y del handler inerte de App. No quedan usos en src. No existe una ruta alternativa de sincronización añadida.
- App omite el tono genérico sólo cuando la intención informa outcome.status=unavailable. Las demás intenciones actuales no reciben ese outcome nuevo y conservan su tratamiento. Se elimina el segundo tono del handler retirado.
- Creación local, datos/persistencia de tareas, exportación ICS y otras intenciones mantienen su código. No se cambian reconocimiento/modelo de tareas, flags de sincronización o la política conservadora de etiquetas ya revisada.

No hay nuevas APIs, proveedores, tokens, credenciales, adaptadores o simulaciones de sincronización. Este cambio no realiza sincronización externa.

## Regresiones y conservación de datos

Después **5/5 Node y10/10 escenarios Chromium nuevos pasan**. Las cuatro órdenes siguen reconocidas; texto visible, actionDetails y argumento de speakKokoro corresponden al resultado real del parser. No hay tonos para la operación no disponible, llamadas de sincronización, rutas chat/VAOS/push ni efectos push/locales. La voz y los tonos se capturan en sus fronteras; no se invoca un proveedor ni se prueba audio real.

Se siembra una tarea heredada con campos completos y flags antiguos true, más un evento local. Se comparan tareas y calendario persistidos antes/después de cada orden: permanecen idénticos. El parser recibe entradas congeladas en Node para detectar mutaciones. No hay migración, borrado, normalización, reasignación, reescritura de titularidad ni recibos inventados.

Como control positivo, crear una tarea local conserva prioridad, hora, recurrencia, subtareas y flags false, añade la tarea a la persistencia, mantiene intacto el registro antiguo y emite **una** confirmación legítima. Node también verifica que descargar ICS sigue devolviendo su acción distinta. No se silencian todas las operaciones para ocultar el defecto.

Las fixtures usan App/parser reales y fronteras sintéticas de Firebase/Firestore/backend/proveedores/voz. Chromium bloquea tráfico remoto por routing/proxy y ejecuta sin workers ajenos; las pruebas anteriores de los workers reales se conservan en la suite explícita del runner G01. No se usa ninguna cuenta o credencial de producción.

## Repetición y verificación

```sh
bun install --frozen-lockfile
npm run check:runtime
node --test --test-timeout=15000 tests/sync-intent-truthfulness.test.mjs
npm test
npm run lint
npm run build
node node_modules/playwright-core/cli.js install --with-deps chromium
npm run test:browser
npm run smoke:production
git diff --exit-code -- bun.lock package.json
git diff --check
```

Toolchain: Node24.19.0/Bun1.4.4. Para repetir el rojo, worktree detached en146a462… con instalación congelada y únicamente los dos tests nuevos copiados desde el candidato; ejecutar el test Node y sync-intent-truthfulness-browser.mjs directamente. Ambos deben fallar por las afirmaciones documentadas, sin conexiones reales.

El cambio se incorpora primero a #9 y se propaga por merge local de dependencia a #11, preservando sus heads anteriores; sin force-push ni PR nuevo. Se ejecuta CI nueva por head. JWT/JWKS, VAOS/UID, notificaciones, SSRF, helper D01, runner, dependencias/lock/workflow y todos los tests anteriores permanecen intactos.

## Límites y revisión

La indisponibilidad no equivale a sincronización simulada ni completada. No se acredita ninguna integración real. Los datos heredados y la política de sincronización no verificada del ciclo anterior permanecen; versiones antiguas requieren actualización. Siguen pendientes B05/B02/B04/C01/C02, revocación Firebase, persistencia/backup/multiinstancia y capacidades externas no verificadas. La CI y la comprobación del autor no sustituyen la validación independiente incremental del candidato nuevo.
