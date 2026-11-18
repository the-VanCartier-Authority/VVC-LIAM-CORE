# Auditor Gemini — prueba de acceso y evidencia

La prueba `mode=probe` consulta el catálogo y realiza una sola generación JSON sintética. No lee ni envía archivos del repositorio. El resultado `PROBE_OK` acredita esas dos operaciones y no constituye un dictamen sobre el código.

## Diagnóstico del 17 de noviembre de 2026

- [Auditoría #8](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/actions/runs/43755003753), SHA `c92c595c7b8e010b91a98fd3a70e762580ad92bd`, `architecture`, `gemini-3.8-flash`: generación completada en 136.8 segundos, informe validado y artefacto publicado.
- [Prueba #9](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/actions/runs/44188091994), mismo SHA y modelo: catálogo autenticado correcto en 0.1 segundos. La generación sintética agotó la espera de 45 segundos antes de recibir cabeceras. No emitió auditoría.

Estas corridas muestran que una espera de 45 segundos puede descartar una respuesta que el auditor aceptaría dentro de su presupuesto de generación. No establecen la causa de la latencia del proveedor ni garantizan que otra solicitud termine en 240 segundos.

## Ajuste y uso

El catálogo conserva una espera de 45 segundos. La generación sintética usa los mismos 240 segundos por operación de red que la auditoría. El job conserva su límite total de ocho minutos. No hay reintentos automáticos ni cambio automático de modelo.

La prueba guarda un JSON identificado por SHA del auditor, ID de corrida e intento. Registra por separado estado, tiempo observado y código de error de catálogo y generación. Se publica como artefacto incluso cuando una solicitud o validación falla. El comando conserva código de salida 1 ante un fallo. Una interrupción forzada del runner puede impedir guardar el diagnóstico.

El artefacto contiene metadatos y códigos de error controlados. No contiene claves, encabezados, cuerpos de error del proveedor ni código del repositorio. El resumen de Actions muestra el resultado de ambas etapas.

Para revisar la conexión, ejecutar `Gemini Independent Audit` en `main` con `mode=probe` y el modelo elegido. Para auditar código, usar `mode=live`. La validación B02 requiere además base y candidato con SHA completo y una Recovery CI manual exitosa de ese candidato exacto. Una prueba de conexión o una auditoría general no satisface esos requisitos.

## Referencias y diagnóstico de auditorías

El 18 de noviembre se validó [Recovery CI #60](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/actions/runs/44392053946), manual, intento 1, para el candidato B02 `eeee11ffb656c1fa232493fe5dfc81e08a39b6a1`. Pasaron 157 regresiones, seis fixtures Chromium con 45 escenarios, TypeScript, build, smoke y lock. La definición CI coincide con la de main `d5879e791ce94715d67526c111713be9623ff354`.

- [Gemini #12](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/actions/runs/44393812107), `gemini-3.8-flash`: timeout de 240 s antes de cabeceras. Estado SIN DICTAMEN.
- [Gemini #13](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/actions/runs/44394766377), `gemini-3.5-flash-lite`: respuesta recibida en 3.8 s; rechazada por referencia fuera de archivos o líneas enviados. El log original no identifica la referencia concreta. Estado SIN DICTAMEN.

Ambas solicitudes tenían ocho archivos y 107944 bytes. No produjeron un informe aceptado. No se deduce un dictamen de seguridad del hecho de recibir respuesta.

La corrección del auditor numera cada línea enviada como `N| texto`, incorpora `line_counts` y mantiene intacto el snapshot original para validar. El esquema propone una variante `anyOf` por archivo no vacío, con su ruta exacta y límites mínimo/máximo de líneas. La comprobación local sigue rechazando rutas, rangos invertidos, controles omitidos y referencias sin respaldo. El esquema ayuda a guiar la respuesta; no demuestra la veracidad de un hallazgo.

Los errores de una auditoría generan un artefacto `audit-diagnostic-...` identificado por SHA del auditor, corrida e intento, marcado `is_audit=false` y `status=SIN_DICTAMEN`. Contiene código de error y, si procede, índice de resultado/referencia, ruta perteneciente al alcance y números/límite de línea. Una ruta ajena se registra como `null`. No se guardan el cuerpo del proveedor, las claves, los encabezados ni el texto generado rechazado. El comando mantiene salida 1 y la publicación se intenta aunque el paso de análisis falle.

Se conservan los límites de bytes, archivos, tiempo y salida. No se añaden reintentos, selección automática de otro modelo ni corrección automática de citas. Las llamadas reales #12 y #13 son evidencia del problema anterior. La eficacia de la nueva guía requiere otra ejecución autorizada tras integrar el auditor. B02 conserva su SHA y dictamen NO-GO; esta corrección no modifica su funcionalidad.

Contrato del esquema consultado en [documentación oficial de structured outputs](https://aistudio.google.com/docs/structured-output). La CI manual #60 puede reutilizarse mientras el candidato, sus resultados y la definición CI de confianza sigan coincidiendo; no hace falta modificar B02 para cambiar el formato de entrada del auditor.
