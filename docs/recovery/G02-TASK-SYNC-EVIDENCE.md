# G02 · Indicadores externos sin evidencia · 2026-11-04

**PENDIENTE DE REVISIÓN INCREMENTAL. No fusionar, desplegar ni avanzar a G03.**

Manus comunicó CAMBIOS NECESARIOS sobre #9@fb248b2704645253db874e33752a543db03a31f8 y el candidato #11@3fa56bcb4be8cf986c9374a54b5772fe5d96ffa6. Main esperada e intacta: baf5f8bc5ef5cce1ce80e598cd522f3c8607356d. Los nuevos SHA y CI se registran en #9/#11/#2; las CI anteriores no validan código nuevo.

## Semántica y lectura conservadora

Se conserva el contrato opcional `TaskItem.syncedToThirdParty` y sus cuatro booleanos; no se añaden integraciones, estados de ejecución ni campos de recibo ficticios.

| Datos encontrados | Interpretación en este candidato | Presentación |
| --- | --- | --- |
| Tarea nueva con false | No existe sincronización externa confirmada | Sincronización externa no verificada |
| Campo ausente / datos antiguos desconocidos | No hay evidencia suficiente | Sincronización externa no verificada |
| true heredado, parcial o aportado por cliente | Dato no acreditado; no prueba una operación | Sincronización externa no verificada |
| Estado pendiente/fallido malformado o supuesto recibo en datos cliente | No se acepta como confirmación | Sincronización externa no verificada |

**Ningún adaptador de sincronización externa de tareas verificado ni canal de recibos autoritativo existe en G02. Por ello no se muestra Google Sync/Notion como éxito para ninguna tarea.** Esto no niega que una tarea pudiera existir externamente; indica que este candidato no puede acreditarlo. Un enlace/exportación ICS, una preferencia de proveedor, un guardado en Firestore, autenticarse con Firebase o la recepción HTTP de un webhook no acreditan una operación completada en Google Calendar/Notion/Todoist/Slack. Un identificador o supuesto recibo guardado por el cliente tampoco basta. Una futura confirmación requiere una operación real y evidencia validada de su resultado, vinculada a tarea/identidad/proveedor, mediante un adaptador revisado; no se implementa ahora.

## Inventario de productores y consumidores

- **rtLiteEngine.ts:** la creación local pasa de cuatro true a cuatro false. Título, prioridad, categoría, fecha/hora, recurrencia, subtareas y respuesta veraz anterior se conservan. Comparación completa del resultado en cuatro prioridades: sólo cambian esos cuatro indicadores.
- **App.tsx:** las tres tareas de ejemplo de una instalación nueva dejan de tener indicadores positivos ficticios. Sólo cambian sus valores de sincronización; no se cambian notificaciones, autenticación o efectos de App. Un registro existente de localStorage sigue leyéndose como antes.
- **CalendarRemindersModal.tsx:** el formulario ya creaba los cuatro valores false; se conserva incluso con las preferencias Google/Notion seleccionadas. La lista era el único consumidor explícito que convertía los indicadores en etiquetas de éxito: se reemplazan ambas por el estado neutral. Los textos del formulario dicen Guardado local/Guardar tarea y la prioridad crítica no promete una notificación inmediata. No cambia el valor de prioridad ni su comportamiento.
- **types/index.ts:** sólo un comentario documenta el límite de los booleanos; la forma del modelo no cambia.
- **Persistencia genérica/local y Firestore:** sin cambios de implementación. No se atribuye sincronización externa de tareas a la persistencia interna de la aplicación. La búsqueda de syncedToThirdParty en src/public identifica estos productores, el tipo y las antiguas dos lecturas de etiquetas; no hay otros consumidores explícitos que acrediten proveedores.

## Política de datos heredados

**No hay migración, borrado, normalización ni reasignación automática de datos históricos.** Se conservan flags, títulos, fechas, prioridades, subtareas, IDs, timestamps y campos adicionales existentes. La corrección de los ejemplos del código sólo afecta a la creación inicial cuando no hay datos guardados. El renderizado no modifica datos ni convierte automáticamente true a false. La UI deja de confiar en ellos como evidencia.

Chromium siembra un registro antiguo con cuatro true y un supuesto recibo de cliente. Abre la agenda real, crea una tarea por comando y otra por formulario, recarga y compara el registro antiguo completo: permanece idéntico. Las etiquetas no reaparecen tras la recarga. No se presume titularidad ni se añade UID al legado; B04 sigue abierto.

## Evidencia roja/verde

[Node antes](evidence/g02/task-sync/node-before.txt) · [Node después](evidence/g02/task-sync/node-after.txt) · [Chromium antes](evidence/g02/task-sync/browser-before.txt) · [Chromium después](evidence/g02/task-sync/browser-after.txt).

Antes de corregir el producto se ejecutaron las nuevas fixtures en fb248b2…: **2/6 casos Node pasan,4 fallan por aserciones**. Se observa tarea local con cuatro true, etiquetas Google Sync/Notion para datos heredados y para objetos pendientes/fallidos malformados, con llamadas externas0. Los indicadores false/ausentes ya evitaban las etiquetas. Chromium ejecuta nueve escenarios y detecta siete violaciones: flags nuevos positivos, etiquetas de tarea nueva/heredada, persistencia del falso éxito al recargar (para dos identidades), y ejemplos iniciales ficticiamente sincronizados. El formulario, que ya era conservador, se verifica como control.

Después: **6/6 Node y9/9 escenarios Chromium pasan**. App/parser/agenda reales; sólo las fronteras Firebase/Firestore/backend/proveedores/voz son sintéticas. La fixture sirve UTF-8 para reproducir correctamente los comandos con fecha «mañana». Se prueban formulario con fecha/prioridad/categoría/recurrencia y subtarea, estado local persistido, texto visible y argumento de speakKokoro, conservación de registros heredados y ejemplos nuevos. Cero permisos/suscripciones/showNotification/new Notification/mensajes push; cero peticiones push y proveedores externos. El audio es una captura de la llamada, no una prueba de voz real.

## Reproducción

Node24.19.0 y Bun1.4.4, sin cuentas o credenciales reales:

```sh
bun install --frozen-lockfile
npm run check:runtime
node --test --test-timeout=15000 tests/task-sync-truthfulness.test.mjs
npm test
npm run lint
npm run build
node node_modules/playwright-core/cli.js install --with-deps chromium
npm run test:browser
npm run smoke:production
git diff --exit-code -- bun.lock package.json
git diff --check
```

Para repetir el rojo, crear worktree detached en fb248b2…, instalar con lock congelado y copiar únicamente los dos tests nuevos desde el candidato. Ejecutar el test Node y task-sync-truthfulness-browser.mjs directamente sobre ese producto anterior. El parser/UI son iguales en el candidato3fa56bc… para las rutas examinadas. Los logs muestran fallos de aserción, no errores de instalación o de harness.

## Alcance y riesgos restantes

Autenticación JWT/JWKS, propiedad VAOS/UID, bloqueo HTTP/cliente/workers de notificaciones, SSRF, resultados D01, runner, dependencias/lock y workflow se conservan. El diff de App se limita a los indicadores de los tres ejemplos; no se toca su control de notificaciones. Las pruebas anteriores se mantienen.

Las versiones/clientes/workers anteriores necesitan actualizarse; no se modifica producción ni se desactivan instalaciones antiguas instantáneamente. Permanecen B05/B02/B04/C01/C02, revocación Firebase, persistencia/backup/multiinstancia y capacidades externas no verificadas. Ningún recibo o integración nueva se inventa para cerrar este hallazgo. La CI y las pruebas del autor no sustituyen la comprobación independiente incremental sobre los SHA nuevos.
