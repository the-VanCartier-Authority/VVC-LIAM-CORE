# G02 · Diagnóstico del relevo de Service Worker · 2026-11-06

**Producto sin cambios. Pendiente de revisión. No fusionar, desplegar ni avanzar a G03.**

El propietario comunicó APROBABLE CON CONDICIONES de Manus sobre #9@5cb2bf6d6d0d18fbe43cf1a4ad420a149ba0f5bd y #11@036a284fd6f328cb1d1f6f8962797ff1329c64b5. La sincronización fue validada; queda el timeout en notifications-disabled-browser.mjs:188. Main sigue en baf5f8bc5ef5cce1ce80e598cd522f3c8607356d.

## Causa demostrada y límite de atribución

En un worktree limpio del **SHA exacto036a284…**, con instalación congelada y sin editar archivos versionados:

| Prueba | Sin dist/ (antes de build) | Después de npm run build del mismo SHA |
| --- | --- | --- |
| Fixture push individual | Timeout30000ms, línea188, variante built | PASS,8casos |
| Runner completo | Mismo timeout en push; gate FAIL | PASS,6fixtures/45casos |

La instrumentación demuestra la causa local: en la fase built el servidor intenta leer dist/sw.js inexistente, responde **HTTP500/ENOENT**, registration.update rechaza, no aparece un worker nuevo en installing/waiting, y active/controller continúan siendo el legacy. Sus consultas GET_NOTIFICATION_POLICY no responden. La aserción de confirmación falla correctamente; el mensaje de timeout ocultaba el error de preparación.

**No se ha demostrado que Manus omitiera build ni que ésta sea necesariamente su causa exacta.** Sus versiones/comandos y el checkpoint public/built no se aportaron en el mensaje ni en los comentarios consultados de GitHub; se solicitaron al propietario. Si Manus usó un build completo/vigente, su atribución queda pendiente de sus datos. No se declara descartado universalmente un fallo de producto por una ejecución verde.

## Estados, contenido y carreras observadas

[Checkpoints y hashes versionados](evidence/g02/sw-timeout/checkpoints.json). Los logs completos antes/después se entregan en el paquete descargable enlazado desde #2.

- Se registran installing/waiting/active, identidad/estado del controller, updatefound, statechange, controllerchange, register/update y sus errores. Los observadores devuelven las promesas nativas originales: no reintentan registros ni escriben el flag del producto.
- Cada respuesta real de /sw.js,/sw-push.js y Workbox registra fase,archivo,HTTPstatus,longitud,SHA256. Legacy es el script sintético sin ACK. Public sirve public/sw.js ypublic/sw-push.js; built sirve dist/sw.js,dist/sw-push.js ysu dependencia Workbox. El código anterior tomaba la extensión de public incluso al ensayar built; en este árbol ambas copias tienen bytes idénticos,por tanto eso no causaba el fallo reproducido,pero podía ocultar un build obsoleto.
- GET_NOTIFICATION_POLICY se observa por MessageChannel/puertos reales,con identidad,latencia yrevision/enabled del ACK. Una sonda posterior a la aserción original comprueba además la respuesta raw exacta: g02-notifications-disabled-v1,enabled=false. No reemplaza el flag ni hace pasar una aserción fallida.
- Con build válido,update puede resolver mientras el worker aún instala: se conserva la espera del flag. Se observó ACK del controlador nuevo durante activating y también el timeout tardío de una consulta al legacy; el flag del controlador nuevo permaneció true. La protección existente de identidad en confirmController evita que el resultado viejo lo sobrescriba. No se reprodujo una carrera de producto que exigiera modificar lifecycle/clients.claim/worker.
- Ambos workers conservan los cachés centinela y el almacenamiento,pasan navegación offline y los eventos de prueba siguen produciendo showNotification0,timers0,payloads0,openWindow0. Clientes/BYOK/Firebase/proveedores reales no se utilizan.

## Corrección exclusivamente del ensayo

1. waitForFunction recibe **null como segundo argumento y {timeout:10000} como tercero**. Antes el objeto era un argumento de la función y regía el valor por defecto30000ms. No se aumenta el plazo; se aplica el10s ya pretendido. La aserción isDisabledWorkerConfirmed permanece.
2. Preflight antes de abrir Chromium: exige worker público y construido,extensión construida idéntica a la fuente,dependencia Workbox yarchivos de precache existentes. Si faltan archivos o el build es incoherente,falla con NOTIFICATION_FIXTURE_BUILD_REQUIRED/STALE/INVALID y la instrucción npm run build. **No es skip ni PASS.** La falta de build ahora se diagnostica inmediatamente en lugar de convertirse en timeout.
3. El servidor de workers usa las copias reales de cada variante precargadas al inicio; un script desconocido devuelve404 y no HTML de la fixture. La revisión del manifiesto usa el formato generado por la versión fijada en bun.lock; un formato no identificado se rechaza explícitamente.
4. Cinco regresiones Node cubren build ausente,extensión obsoleta,precache incompleto,dependencia ausente yselección correcta de archivos por fase. No se cambian producto,dependencias,workflow ni runner G01.

El preflight detecta esos errores concretos; **no sustituye un build fresco del SHA probado ni certifica por sí solo toda la procedencia de un dist antiguo coherente**. CI ya ejecuta build antes de Chromium. Los nuevos heads requieren sus CI nuevas, no se reutiliza la anterior.

## Entornos comparados

| Aspecto | Local reproducido | CI del SHA revisado | Manus |
| --- | --- | --- | --- |
| Node/Bun |24.19.0/1.4.4,frozen666paquetes|24.19.0/1.4.4,frozen666|No aportado |
| Chromium/Playwright|156.0.8078.4 /1.64.1,revision1248|Mismo Chromium fijado por lock|No aportado |
| SO/Python|Linux6.18.57,glibc2.41,Python3.12.14|Ubuntu24.04.5,Python3.12.3|No aportado |
| Orden/build|Sin build reproduce;build previo pasa|Build antes de instalar/ejecutar Chromium|No aportado |
| Servidor/caché|Loopback HTTP,no-store,updateViaCache:none,contextos nuevos,datos centinela|Misma fixture versionada/contextos nuevos|Log de fase solicitado |

Para repetir la base exacta en un checkout nuevo: instalación congelada; ejecutar individual/runner antes de build para observar el fallo; después npm run build y repetir ambos. No borrar un dist o datos de otro trabajo. Para el ensayo corregido:

```sh
bun install --frozen-lockfile
node --test --test-timeout=15000 tests/notification-worker-assets.test.mjs
npm test
npm run lint
npm run build
node node_modules/playwright-core/cli.js install --with-deps chromium
node tests/notifications-disabled-browser.mjs
npm run test:browser
npm run smoke:production
```

El producto y todos los controles de sincronización/notificaciones/auth/UID/SSRF/D01 permanecen byte a byte iguales a los candidatos revisados; se confirma por diff/árboles. No se prepara un parche de producto porque no hay defecto real de actualización demostrado en el entorno válido observado. La revisión de Manus debe contrastar el nuevo diagnóstico; si persiste con build válido,se investiga y cualquier corrección de producto se separará con regresiones.
