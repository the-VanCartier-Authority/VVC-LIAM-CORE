# G02 · Cierre temporal de push, pendiente de revisión incremental

> Registro histórico del cierre **sólo HTTP** del 31 de octubre. Manus lo consideró insuficiente en a34d89e…: cliente y workers seguían emitiendo avisos. La corrección integral vigente y sus límites se documentan en [G02-NOTIFICATIONS-DISABLED.md](G02-NOTIFICATIONS-DISABLED.md). Las cifras y afirmaciones siguientes corresponden a aquel candidato anterior.

Base main esperada e intacta: baf5f8bc5ef5cce1ce80e598cd522f3c8607356d.
B01 anterior revisado: 4f0a8857e6edc21d8b176274afe8b804f6f6d5cd.
Candidato G02 anterior: 20a769151e5930a4f7326f77cb5499344c7af352.

El propietario comunicó el dictamen Manus APROBABLE CON CONDICIONES y confirmó el aislamiento VAOS. La condición exige push efectivamente deshabilitado. La inspección y regresión demuestran que no estaba garantizado: suscribir/eliminar/enviar/programar seguían operativos tras autenticar. Este cambio es código nuevo y **queda pendiente de revisión incremental, sin autorización de fusión**.

## Mecanismo mínimo

- `PUSH_ENABLED=false` es una constante de servidor de este candidato. No hay opción de entorno, body, query o header para reactivarlo. Rehabilitar requiere otro cambio de código revisado y las garantías de B05.
- Un middleware para `/api/push` se ejecuta **después de Firebase auth y antes de JSON/handlers**. Sólo permite las lecturas GET/HEAD de status y vapid-public-key. El resto del namespace, incluidos registro, eliminación, envío inmediato/programado y rutas broadcast, responde **503/PUSH_DISABLED**, success=false, outcome=unavailable y realExecution=false.
- Los handlers existentes no reciben estas operaciones: no se muta el registro, no se recorre la difusión, no se llama a sendNotification ni se programan temporizadores.
- Con push deshabilitado no se leen claves VAPID configuradas, no se generan claves ni se configuran detalles VAPID. Configuración y status declaran enabled=false/hasPushEnabled=false/hasVapidKey=false; la lectura pública de clave devuelve string vacío. Se conserva el200 de las lecturas públicas de B01. No hay cambios de interfaz.
- La autenticación permanece primero: peticiones sin identidad a rutas privadas continúan401/AUTH_REQUIRED. Usuarios autenticados, incluso dos UID distintos, reciben503 para operaciones push.

Este cierre se incorpora a #9 y después se propaga a #11 conservando ambos heads anteriores como ancestros. Así una futura integración #9→#11 no tendría una etapa B01 con push activo. No se fusiona ningún PR en esta preparación.

## Regresión antes/después

`tests/push-disabled.test.mjs` contiene tres pruebas HTTP negativas con dos JWT sintéticos firmados por el harness B01. El preload de ensayo observa generación/configuración VAPID, Map.set/delete para endpoints sintéticos, sendNotification y los temporizadores de envío. El transporte web-push se sustituye antes de arrancar el servidor: ninguna notificación sale a red, incluso al ejecutar el código anterior.

Sobre B01 anterior se reproducen **3/3 fallos**. Las ocho operaciones devuelven200; se observan generación VAPID1, configuración1, registros2, eliminaciones2, envíos simulados8 y temporizadores2. [Log previo](evidence/g02/push-before-gate.txt).

Con el cierre, las ocho operaciones devuelven503 y todos esos contadores son0. Se comprueba también JSON inválido, métodos/casing/trailing slash, ruta broadcast, hints enabled/force y variables de entorno que no pueden reactivarlo. Descubrimiento/status son coherentes y auth sigue401 cuando falta identidad. El smoke productivo añade la verificación503 del envío push con identidad válida.

El helper de observación sólo existe como preload de tests. No se añade modo de bypass al servidor ni se usa cuenta/credencial de producción. `npm test` incluye estas tres regresiones; Chromium continúa como gate explícito de dos fixtures/12casos.

## Alcance y riesgos

No se implementa B05: sin ownership de suscripciones, validación del transporte, audiencias, cuotas ni persistencia nuevas. El código de push antiguo permanece inactivo. **No debe reactivarse antes de implementar/revisar B05 y recibir autorización expresa.** Las suscripciones/permisos locales existentes en navegadores no se revocan ni migran. Tampoco se detiene un despliegue antiguo: este comportamiento sólo corresponde al ejecutar el nuevo SHA; no se despliega nada.

Firebase JWT/JWKS, UID/VAOS, F01/D01, runner, package/lock y workflow conservan su implementación anterior. Persisten los riesgos ya documentados de revocación, B02/B04/C01/C02, memoria volátil y límites del supervisor Linux.

Los SHA nuevos exactos y CI se registran en #9/#11/#2, sin autorreferencia del documento. La revisión incremental debe comparar el nuevo candidato con20a7691…, comprobar que el gate está en #9 desde el primer merge futuro y repetir la regresión/smoke. Aunque CI pase, **G02 no se fusiona hasta que el propietario revise y valide estos cambios**. Main intacta, sin despliegue, protecciones sin cambios y G03 no iniciado.
