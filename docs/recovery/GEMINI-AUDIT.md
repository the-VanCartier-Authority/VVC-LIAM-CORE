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
