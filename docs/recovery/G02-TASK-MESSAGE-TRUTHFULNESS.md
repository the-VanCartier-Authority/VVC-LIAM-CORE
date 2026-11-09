# G02 · Veracidad de mensajes de tareas y ayuda · 2026-11-03

**PENDIENTE DE REVISIÓN INCREMENTAL. Sin fusión, despliegue ni avance a G03.**

Manus comunicó una observación posterior sobre #9@0397e774039dc2b870dc19351eebfd61de7f2c9d y #11@3d9cd945bbc47bcf9c488b633256ec94aeaff129. Ambos contienen el mismo blob del parser: 9fae038095a6bd16c5b4fff30df051171fedb2b0. Main sigue en baf5f8bc5ef5cce1ce80e598cd522f3c8607356d.

## Cambio de producto: dos cadenas

- La respuesta al crear una tarea conserva título, prioridad y hora. Sustituye «Notificación en tiempo real y sincronización listas» por «Las notificaciones push y locales están deshabilitadas». No afirma sincronización externa completada.
- La ayuda de RT Lite deja de ofrecer «Probar notificación push en segundo plano» e indica la misma desactivación. Conserva el comando de creación de tareas.

Únicamente cambian esas dos cadenas en src/utils/rtLiteEngine.ts. No cambian App, modelo/datos de tareas, prioridades, autenticación/JWKS, propiedad VAOS/UID, bloqueo HTTP/cliente/workers push, lifecycle, egress, veracidad D01 ni runner. Package/lock/workflow y pruebas anteriores se conservan. La corrección se incorpora primero a #9 y se propaga a #11 por merge local de dependencia; sin force-push ni PR nuevo. Los SHA y las CI definitivos se registran en #9/#11/#2, sin atribuir validez de la CI anterior a los nuevos heads.

## Reproducción y regresiones

[Parser antes](evidence/g02/task-messages/parser-before.txt) · [Parser después](evidence/g02/task-messages/parser-after.txt) · [App/voz antes](evidence/g02/task-messages/browser-before.txt) · [App/voz después](evidence/g02/task-messages/browser-after.txt).

Antes de editar el producto, los cinco casos Node nuevos fallan por aserciones: cuatro prioridades reciben la promesa falsa y la ayuda ofrece push. En Chromium se reproducen seis escenarios con dos identidades sintéticas: creación crítica, creación baja y ayuda por identidad. La consola y la llamada de voz presentan las cadenas incorrectas mientras los efectos de notificación ya son cero. El gate aprobado funciona; el defecto es la afirmación de capacidad disponible.

Después, **5/5 Node y 6/6 escenarios Chromium** pasan. Se verifica que el mensaje del parser coincide exactamente con el texto visible y con el argumento enviado a speakKokoro. La fixture de voz captura la llamada y no produce audio ni invoca un proveedor. La tarea se conserva en el estado/persistencia local: título, prioridad, fecha/hora, recurrencia, categoría, subtareas y demás campos recibidos del parser, más id/timestamps de App. Una comparación completa antes/después con fecha fija confirma igualdad de newTask para alta/critica/baja/media. Los metadatos heredados de sincronización no se modifican ni se utilizan como recibo de una operación externa.

Las fixtures emplean App/parser reales, fronteras Firebase/Firestore/backend/voz sintéticas y tráfico remoto bloqueado mediante routing y proxy loopback cerrado. Se observan cero permisos solicitados, suscripciones, showNotification, new Notification, mensajes de programación o peticiones push. Los tests anteriores del bloqueo y de UID permanecen intactos.

## Repetición

Con Node24.19.0 y Bun1.4.4:

```sh
bun install --frozen-lockfile
npm run check:runtime
node --test --test-timeout=15000 tests/task-message-truthfulness.test.mjs
npm test
npm run lint
npm run build
node node_modules/playwright-core/cli.js install --with-deps chromium
npm run test:browser
npm run smoke:production
git diff --exit-code -- bun.lock package.json
git diff --check
```

Para repetir el rojo, copiar únicamente los dos tests nuevos a un worktree detached en0397e774… con instalación congelada, sin modificar su producto. Ejecutar el test Node y la fixture task-message-truthfulness-browser.mjs directamente: ambos deben fallar por las afirmaciones documentadas. El parser es idéntico al de3d9cd945…; la prueba del cierre anterior no sustituye esta nueva regresión.

## Límites y revisión

La comprobación de texto/dispatch de voz no certifica audio real ni sincronización Firebase/terceros. Se conserva la estrategia y los límites del cierre integral: clientes/workers/deployments antiguos necesitan actualizarse y no se desactivan instantáneamente. No se borran permisos, suscripciones o datos.

Continúan pendientes B05, B02, B04 (legado sin UID), C01/C02, revocación Firebase, persistencia/backup/multiinstancia y capacidades externas no verificadas. Ninguna migración o presunción de titularidad. La CI y las pruebas del autor no constituyen una aprobación independiente de este nuevo candidato.
