# F01: registro de proveedores y transporte del servidor

Implementación propuesta en `fix/p0-a-f01-ssrf`; no modifica `main`. Base: `2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7`. Diagnóstico original: [PR #1](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/pull/1). Evidencia de ejecución: [VALIDATION.md](VALIDATION.md).

## Contrato de configuración

`LLM_PROVIDERS_JSON` se lee una vez al arrancar, exclusivamente desde el entorno del servidor después de dotenv. JSON inválido, campos desconocidos, duplicados o excepciones inconsistentes impiden el arranque. Nunca incluir esta variable en `VITE_*`, `/api/config` ni almacenamiento del navegador.

Hay dos proveedores incorporados e inmutables:

| ID | Destino | Clave del servidor |
|---|---|---|
| `nvidia` | `https://integrate.api.nvidia.com/v1/chat/completions` | `NVIDIA_API_KEY` |
| `gemini` | SDK GoogleGenAI con origen Google fijo | `GEMINI_API_KEY` |

Ambos admiten BYOK. Los proveedores adicionales requieren `id`, `kind`, `endpoint` completo y `allowByok` booleano. Los tipos adicionales son `nvidia` (NIM administrado), `openai-compatible`, `ollama` y `vllm`. `apiKeyEnv` es opcional y nombra una variable dedicada del servidor; no contiene su valor. Los proveedores adicionales no pueden reutilizar los nombres `NVIDIA_API_KEY` ni `GEMINI_API_KEY`. Sin clave dedicada ni BYOK se omite Authorization, útil para Ollama/vLLM locales. Los placeholders `MY_*_API_KEY` se consideran ausentes.

Ejemplo de configuración administrativa; no realiza inferencia:

```dotenv
LLM_PROVIDERS_JSON='[{"id":"openai-team","kind":"openai-compatible","endpoint":"https://api.openai.com/v1/chat/completions","apiKeyEnv":"TEAM_OPENAI_KEY","allowByok":true},{"id":"ollama-local","kind":"ollama","endpoint":"http://127.0.0.1:11434/v1/chat/completions","allowByok":true,"localException":{"providerId":"ollama-local","hostname":"127.0.0.1","port":11434}},{"id":"vllm-local","kind":"vllm","endpoint":"http://127.0.0.1:8000/v1/chat/completions","allowByok":false,"localException":{"providerId":"vllm-local","hostname":"127.0.0.1","port":8000}}]'
```

Para NIM privado, registrar otro ID con `kind: "nvidia"`, su URL completa y, si necesita clave, una variable dedicada como `PRIVATE_NIM_KEY`. Si resuelve a una red privada, exige la misma excepción exacta. Las claves NVIDIA del proveedor incorporado permanecen ligadas a su origen original.

## Selección desde el cliente

`POST /api/chat/nvidia`, `/api/chat/custom` y `/api/secrets/test` admiten `providerId`. En secrets/test, `provider` sigue siendo `nvidia`, `gemini` o `custom`; `providerId` selecciona la entrada administrativa concreta. Las rutas NVIDIA sólo aceptan proveedores de tipo NVIDIA; custom sólo acepta OpenAI-compatible, Ollama o vLLM.

Para conservar clientes existentes, `endpoint` puede seleccionar una URL completa ya registrada, normalizada mediante URL. Si llegan `providerId` y `endpoint`, deben identificar exactamente la misma entrada, incluyendo protocolo, puerto y ruta. El cliente no registra ni modifica destinos. Una URL custom antes aceptada necesitará registro previo en el servidor; de otro modo obtiene HTTP 400 / `EGRESS_POLICY`. No hay cambios visuales en esta entrega.

```json
{"providerId":"ollama-local","model":"fixture/model","messages":[{"role":"user","content":"fixture"}]}
```

Se conserva el contrato OpenAI `/v1/chat/completions` para Ollama y vLLM; no se añade una API nativa Ollama ni se arranca un modelo local. Gemini conserva su SDK, modelo y formato de respuesta. Su transporte fijo no es uno de los cinco sinks fetch arbitrarios corregidos; el transporte fijado a IP se aplica a esos cinco sinks.

## Controles del transporte

Los cinco sinks (NVIDIA principal y reintento, custom chat, test NVIDIA y test custom) usan `postProvider` en `src/server/providerEgress.ts`.

- URL sin userinfo, query, fragmento, barra inversa o host con punto final. Sólo HTTPS, salvo HTTP local explícito.
- Se validan todas las respuestas DNS A/AAAA; una respuesta privada o reservada invalida el conjunto. Se bloquean loopback, RFC1918, CGNAT, link-local/metadata, multicast, documentación, rangos reservados y formas IPv6 mapeadas/de transición. IPv6 público se limita conservadoramente a unicast global admitido por el código.
- Excepción local exacta `{providerId, hostname, port, addresses}`; `addresses` enumera IP literales, nunca rangos/CIDR. Para hosts que ya son una IP, omitirla equivale sólo a esa IP. Un hostname DNS local debe declararla explícitamente (por ejemplo `"addresses":["127.0.0.1","::1"]` para localhost). No hay wildcard, interruptor global ni excepción enviada por cliente. Cada respuesta privada debe coincidir con una IP enumerada: cambiar DNS a otra IP privada falla. Los rangos loopback/RFC1918/ULA sólo clasifican IP elegibles; no autorizan redes completas. Metadata y link-local siguen prohibidos.
- Una conexión nueva usa únicamente IP validadas y fijadas en su lookup. Comprueba IP y puerto reales antes de escribir encabezados/cuerpo. No hay pooling ni una segunda resolución independiente al conectar.
- Si una IP falla por conectividad antes de enviar HTTP, se puede probar otra del mismo conjunto validado, dentro del plazo original. No se repite una petición transmitida. Cada llamada posterior, incluido el reintento NVIDIA, resuelve y valida DNS otra vez.
- TLS verifica cadena y hostname, conserva Host/SNI y no permite `rejectUnauthorized: false`. Un fallo TLS o de política detiene esa salida.
- Todas las redirecciones HTTP 3xx se rechazan. No se visita Location y no se reenvían claves, ni siquiera al mismo origen. Un rechazo de política también impide el reintento NVIDIA y el fallback.
- DNS tiene hasta 5 s; el plazo total incluye DNS, conexión y lectura completa. NVIDIA conserva 30/60 s y 10 s para su reintento; custom/test usan 45 s. Respuestas limitadas a 4 MiB. Los errores de proveedor no devuelven cuerpos arbitrarios ni mensajes que puedan repetir secretos.

El transporte de estos cinco sinks abre sockets Node directos, sin agentes proxy que vuelvan a resolver el destino. Si el despliegue exige un proxy saliente, necesita un transporte que conserve estas garantías antes de habilitarlo. Los tests aquí usan sólo sockets de fixtures locales. Las defensas se basan en direcciones, no detectan un servicio sensible que el operador haya expuesto en una IP pública; el registro administrativo es parte del límite de confianza.

## Alcance pendiente

F01 tiene evidencia local de corrección; sigue pendiente revisión e integración. F02/F03/F04 (identidad, ownership, cuotas y push) y F05/F06 (custodia en navegador/bóveda) no se cierran con este cambio. Los fallbacks de éxito ficticio de F09 permanecen, excepto que un rechazo de política no puede pasar por ellos. No se modifican voz, agentes, integraciones Google, interfaz ni dependencias.

Los contratos de NVIDIA, Gemini, OpenAI-compatible, Ollama y vLLM están probados con mocks/fixtures. No se afirma disponibilidad de modelos, inferencia real, rendimiento de proveedores ni despliegue productivo remoto. No se usaron credenciales reales ni servicios de pago.
