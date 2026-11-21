# LIAM CORE — diagnóstico HTTP del auditor Gemini

Fecha: 20 de noviembre de 2026. Trabajo exclusivo de `the-VanCartier-Authority/VVC-LIAM-CORE`. **VVC AGENT AUDIT BRIDGE no fue inspeccionado, modificado ni ejecutado.** Cero solicitudes nuevas a la API Gemini, incluido catálogo y countTokens. La investigación usa Git, artefactos existentes, documentación pública y transporte simulado.

## Resultado y límite de certeza

La causa exacta de #15 y #16 no es recuperable de la evidencia conservada: el manejador de `HTTPError` del auditor integrado descartó el cuerpo y los detalles del error. No hay evidencia suficiente para atribuir el 400 a cuota, credenciales o un parámetro concreto, ni el 503 a un incidente específico del proveedor.

La hipótesis principal del **400** es rechazo de la complejidad de la gramática del esquema, no JSON mal formado: ocho alternativas `anyOf`, cada una con un objeto y límites numéricos propios, dentro de un array de hasta ocho referencias y cinco resultados. El esquema es válido según Draft 2020-12, pero esa validación no reproduce el compilador ni sus límites internos. La documentación oficial describe precisamente el riesgo de multiplicar estados con uniones y límites de arrays/números. La hipótesis está respaldada, **no confirmada**.

La hipótesis principal del **503** es indisponibilidad o saturación del servicio/ruta de inferencia. El código es compatible con esa interpretación, pero falta `UNAVAILABLE`, el motivo y la procedencia de la respuesta para confirmarla. No acredita agotamiento de cuota ni aceptación previa del esquema. Un 503 puede ocurrir antes de validar todos los parámetros.

## Referencias congeladas

- Auditor y main inspeccionados: `2e4156f92eb4eeeaffce30847a732ade2c8a60de`, árbol `40200909464617f019bcac20bc16134dd0fe481b`.
- Base B02: `d5879e791ce94715d67526c111713be9623ff354`.
- Candidato del PR #47: `eeee11ffb656c1fa232493fe5dfc81e08a39b6a1`, permanece en borrador y NO-GO.
- Recovery CI usada en ambas solicitudes: [#60, ID 44392053946](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/actions/runs/44392053946), intento 1, job `135112025959`. Se volvió a leer la metadata, verificando SHA, nueve pasos requeridos y definición CI idéntica. No se volvió a ejecutar.

## Evidencia histórica inspeccionada

| Corrida | Solicitud y respuesta observadas | Artefacto comprobado |
| --- | --- | --- |
| [Gemini #15](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/actions/runs/44607815583) | `b02_validation`, `gemini-3.5-flash-lite`, 8 archivos, 116840 bytes de alcance. HTTP 400 aproximadamente 1.04 s después de anunciar el envío. | ID `14572330117`, ZIP de 576 bytes, SHA256 `e1be6b2f65e91e0bc45dc496aee8054a9ad784e8d8426d0ff29c9290976d07a7`. |
| [Gemini #16](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/actions/runs/44608658913) | Mismo alcance/base/candidato/CI, `gemini-4-hydrogen`. HTTP 503 aproximadamente 1.83 s después de anunciar el envío. | ID `14572535650`, ZIP de 573 bytes, SHA256 `74ad416a450f9ccf94522b638a08fe2a31cc0eab34067c1c136a7b1058dead92`. |

Los ZIP se descargaron, verificaron por digest y leyeron en memoria, sin extraer cuerpos ni credenciales. Ambos JSON declaran `kind=audit_diagnostic`, `is_audit=false`, `status=SIN_DICTAMEN`, SHA del auditor, base, candidato, CI, modelo, corrida e intento. Sólo registran `http_400` o `http_503`, con referencia nula. Las latencias anteriores proceden de timestamps del log y no equivalen a una medición exacta del servidor.

## Reconstrucción local de la solicitud

Se ejecutó el código de construcción del SHA inspeccionado con un transporte falso que devuelve los metadatos ya leídos de CI #60 e intercepta el POST antes de cualquier conexión. Se usaron los blobs Git originales y el serializador efectivo `json.dumps(payload).encode()`. Los prompts/cuerpos reconstruidos permanecieron en memoria; sólo se registraron estadísticas y hashes.

| Medida | Integrado en main | Corrección propuesta |
| --- | ---: | ---: |
| Alcance JSON numerado UTF-8 | 116840 bytes | 116840 bytes |
| Cuerpo JSON completo serializado, sin encabezados HTTP | 123906 bytes | 122001 bytes |
| Esquema serializado | 2949 bytes | 1044 bytes |
| Nodos con `type` o `anyOf`, conteo estructural local | 40 | 11 |
| Draft 2020-12, esquema y resultado sintético válido | PASS | PASS |
| Alternativas `anyOf` de referencia | 8 | 0 |
| Máximo de tokens de salida | 8192 | 8192 |

El conteo de nodos es descriptivo: **no** mide los estados internos del proveedor. Los dos modelos reciben un cuerpo idéntico, variando únicamente el nombre de modelo en el endpoint. SHA256 reconstruido del cuerpo histórico: `c1aeedc5f3b7e5e7298220a61456d8d439f5b83e406d02104cfa4e00c8c34981`. SHA256 del esquema histórico: `b10f74059602aaaa2f37601dc7749c00334a485ab5ac0a70a443f7b544599df0`.

Para la propuesta, SHA256 del cuerpo `457e5bcaf7174fe9ba037c6c6755d16f2c73163c6eb2841682e74ae7f063b5c9` y esquema `cc8d70c1e9a808e459d01509ad792b6bd5080eb1985910f6172e9a5eb74a677b`. Son hashes de reconstrucción, no una captura de red histórica: la versión integrada no registraba el hash del cuerpo completo.

Ambas configuraciones B02 contienen exactamente `responseMimeType=application/json`, `responseJsonSchema` y `maxOutputTokens=8192`. **No envían thinkingConfig**, temperatura, topP, topK, candidateCount ni herramientas. El ajuste LOW de las auditorías architecture y de probe no intervino en #15/#16.

Las fichas oficiales de ambos modelos indican texto y salida estructurada; 8192 está por debajo de sus 65536 tokens de salida síncrona. `responseJsonSchema` y las palabras clave del esquema figuran en el contrato público v1beta. No se encontró un parámetro manifiestamente incompatible. Ello no demuestra elegibilidad, cuota disponible ni aceptación del compilador para ese proyecto en el momento histórico. El número de bytes no es un recuento de tokens; no se ejecutó tokenización remota ni se estimó una factura.

## Información que faltaba y política de conservación

| Señal | Permite distinguir | Conservación propuesta |
| --- | --- | --- |
| HTTP + estado RPC | `INVALID_ARGUMENT` frente a `FAILED_PRECONDITION`, `RESOURCE_EXHAUSTED` y `UNAVAILABLE` | Entero y enum cerrado; desconocidos como nulos. |
| BadRequest y campo inválido | Esquema frente a límite de salida, thinking, contents o modelo | Tipo conocido y prefijo de campo cerrado; no ruta arbitraria ni descripción. |
| Mensaje del proveedor | Pistas de complejidad, restricción de modelo, cuota o saturación | Sólo etiquetas fijas calculadas en memoria. Nunca mensaje original o parcialmente redactado. |
| QuotaFailure / ErrorInfo | Evidencia explícita de cuota, bloqueo o condición previa | Tipo, cantidad de violaciones y motivo conocido. Se descartan proyectos, sujetos, dimensiones y metadata. |
| RetryInfo / Retry-After | Espera sugerida por el servidor | Segundos numéricos entre 0 y 3600. No reintenta. |
| Identificador de solicitud | Correlación sin publicar el valor recibido | Sólo SHA256 de `x-request-id` acotado; no permite consultar soporte con el valor original. |
| Hashes, bytes, modelo, operación, versión y latencia | Atribuir el fallo a una construcción concreta y comparar solicitudes | Estadísticas controladas y hashes; sin URL completa, encabezados, prompts ni cuerpos. |

El lector de errores consume como máximo 64 KiB más un byte, mantiene la lectura sólo en memoria y descarta el detalle si es truncado, ilegible o no JSON. Los desconocidos nunca se copian como strings libres. Las etiquetas son indicios y pueden ser incompletas; no son un clasificador definitivo del incidente. Ni HTTP 400 ni 503 proporcionan tokens consumidos o costo verificables en los artefactos históricos.

## Corrección mínima y regresiones

1. Sustituir las ocho variantes remotas por un objeto de referencia con enum de rutas y enteros, retirando los límites numéricos y el contador del array interno de la gramática remota. Se mantienen tipos, campos cerrados, estados y cinco resultados B02.
2. Conservar sin cambios `validate_report`, `B02_CONTROLS`, `B02_FILES`, comprobaciones SHA/CI, presupuesto de salida y política sin reintentos. La comprobación AST confirmó que el validador local es idéntico. Sigue rechazando fuera de rango, rangos invertidos, booleanos como líneas, más de ocho referencias, controles ausentes y afirmaciones sin respaldo.
3. Registrar el diagnóstico HTTP acotado y la medida del cuerpo completo; rechazar un cuerpo serializado superior a los 192 KiB existentes antes de abrir conexión. Esto cubre la expansión por escape Unicode que no reflejaba el presupuesto del alcance.

Pruebas locales: **40/40 Python**, sólo Git y transporte sintéticos. Cubren HTTP 400/429/503, un único intento de red simulado, secretos y texto inyectados en mensajes/detalles/headers que no llegan al artefacto ni al log, errores HTML/vacíos/truncados/ilegibles, tamaños exactos, expansión Unicode y publicación SIN_DICTAMEN. Draft 2020-12 validó ambos esquemas y una salida sintética. No se atribuye a estas pruebas aceptación de la API real.

## Validación posterior con consumo mínimo — pendiente de autorización

1. Revisar el diff y las pruebas del PR independiente. La CI del PR sólo ejecuta piloto y regresiones con fixtures; el job Gemini real debe quedar omitido. No fusionar durante este diagnóstico.
2. Si se autoriza una futura prueba de red, preparar una única solicitud sintética con el esquema simplificado de producción y los cinco controles, sin código del repositorio, con máximo 1024 tokens de salida, plazo de 60 s y cero reintentos. Usar un único modelo, inicialmente Flash Lite; registrar diagnóstico sanitizado y usage si el proveedor los entrega. Esta prueba aún no está implementada como modo del workflow ni se ha ejecutado. Debe prepararse y revisarse antes de su autorización operativa; `mode=probe` actual usa otro esquema y no sustituye este ensayo.
3. Si se necesita demostrar que la complejidad causó el 400 histórico, una comparación A/B sintética con el esquema antiguo y nuevo requeriría **otra autorización**, hasta dos inferencias y no garantiza reconstruir el estado pasado. No es necesaria para probar el contrato nuevo; no se propone ejecutarla de oficio.
4. Sólo después de un resultado sintético aceptado, valorar una autorización separada para una auditoría B02 completa. Validar referencias y hallazgos contra el snapshot y #42; ninguna respuesta elimina los bloqueos funcionales ya documentados en PR #47.

No se modificó el candidato B02, no se fusionaron PR, no hubo despliegue ni inicio de G03. El diagnóstico offline está completado; la causa histórica exacta y la compatibilidad efectiva del esquema propuesto permanecen no confirmadas.

## Fuentes primarias consultadas

- [Structured outputs y límites de complejidad](https://aistudio.google.com/docs/structured-output?generate-content=true#simplifying-complex-schemas).
- [Contrato público GenerateContent v1beta](https://github.com/googleapis/googleapis/blob/master/google/ai/generativelanguage/v1beta/generative_service.proto).
- [Gemini 3.5 Flash Lite](https://aistudio.google.com/docs/models/gemini-3.5-flash-lite) y [Gemini 4 Hydrogen](https://aistudio.google.com/docs/models/gemini-4-hydrogen).
- [Troubleshooting](https://aistudio.google.com/docs/troubleshooting) y [tipos Google RPC de diagnóstico](https://github.com/googleapis/googleapis/blob/master/google/rpc/error_details.proto).
