# Backlog de recuperación autorizada

Base verificada: `main@2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7`. Fuente: los nueve informes de [PR #1](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/pull/1), rama `audit/codex-deep-review`, commit `1f915074d374a8f98421808ede347e241b014114`. No se modifica el dictamen histórico ni su puntuación. La numeración Nxx de esta tabla permite rastrear Fxx; no añade hallazgos.

Estado de N01: implementado y verificado localmente en rama independiente; pendiente revisión/integración. Los demás trabajos están pendientes y sólo se planifican. Este backlog no autoriza implementar voz, agentes, Google o UI en el PR de F01. F28/F31 quedan como aclaraciones documentales, sin vulnerabilidad inventada.

## P0: límites de confianza

| Trabajo | Fuente | Entrega y criterio de cierre | Dependencia / estado |
|---|---|---|---|
| N01 / P0-A | F01 | Registro sólo del servidor; secretos ligados a proveedor; DNS/IP, conexión, TLS, redirects, reintentos y excepciones exactas. Regresiones fallan antes y pasan después; tipos/build/smoke. | Implementado localmente, [evidencia](VALIDATION.md); revisión e integración pendientes. |
| N02 | F02 | Identidad verificada en cada API, límites por usuario/acción, cuotas y topes. Anónimos rechazados y pruebas de agotamiento/abuso. | Diseño de identidad; pendiente. |
| N03 | F03 | Ownership de tareas/telemetría y datos de navegador por cuenta; pruebas con dos usuarios y cambio de sesión. | N02; pendiente. |
| N04 | F04 | Suscripciones push por propietario, destinatario autorizado y validación de egress de web-push. Registro/borrado/envío ajenos rechazados. | N02/N03; pendiente. F01 no cubre web-push. |
| N05 | F05 | Custodia explícita de BYOK y retirada de persistencia insegura/afirmaciones Zero-Knowledge no sustentadas. Pruebas de sesión/rotación/borrado. | Decisión de modelo de amenaza; pendiente. |
| N06 | F06 | Contraseña propia, bloqueo efectivo, persistencia cifrada y recuperación de bóveda; probar recarga/backup/clave incorrecta. | N05; pendiente. |
| N09 | F09 | Errores/fallbacks no afirman efectos que no ocurrieron; procedencia del resultado. Cero éxito ficticio ante fallo de proveedor. | Pendiente; F01 sólo impide fallback después de rechazo de política. |
| N11 | F11 | Quitar `realExecution` sin recibo verificable. Definir por separado alcance futuro de herramientas, antes de implementarlas. | N02/N03/N09; pendiente, sin añadir agentes en F01. |
| N21 | F21 | Triage de los 11 avisos históricos/3 paquetes, alcanzabilidad y remediación probada. Elegir instalación/CI reproducible sin ocultar fallo histórico de npm ci. | Pendiente. Avisos no equivalen a explotación demostrada. |
| N27 | F27 | Separar TPS/duraciones estimadas, constantes y medidas; cada dato con procedencia y pruebas. | N09/N11; pendiente. |

## P1: integridad

| Trabajo | Fuente | Entrega y criterio de cierre | Dependencia / estado |
|---|---|---|---|
| N07 | F07 | Migración versionada/idempotente de 11 claves ACIA→LIAM, con respaldo/rollback, corrupción e interrupción. | Custodia/aislamiento acordados; pendiente. No se afirma borrado físico histórico. |
| N08 | F08 | Routing por proveedor real y procedencia del modelo; Gemma NVIDIA no se sustituye por Gemini Flash. | N01; pendiente. |
| N10 | F10 | Riesgo/prioridad y permisos decididos en servidor; valores inválidos y downgrade cliente rechazados. | N02; pendiente. |
| N12 | F12 | Cola durable con ownership, cancelación, concurrencia, idempotencia y recuperación real tras reinicio. | N02/N03/N10; pendiente. |
| N13 | F13 | Una decisión y una inferencia autorizada por comando; rechazo gobierna todas las ramas. | N08/N10; pendiente. |
| N14 | F14 | Sync por cuenta con create/update/delete/empty snapshot/offline/reconnect; consentimiento y errores efectivos. | N02/N03; pendiente; Google fuera del PR F01. |
| N15 | F15 | Corregir `number`→`phone` y probar contacto importado en consumidores reales. | Contrato PhoneContact; pendiente. |
| N16 | F16 | Scheduler de alarmas/temporizadores con plazos persistidos, timezone/DST y recuperación de vencidos. | N07; pendiente. |
| N17 | F17 | Negación, ambigüedad, fechas inválidas/PM/mañana y confirmación de acciones sensibles. Corpus adverso sin efectos involuntarios. | Modelo de intención/confirmación; pendiente. |
| N22 | F22 | Configuración única, modelo/endpoints/claves coherentes y preferencias conservadas al recargar. | N01/N08; pendiente; UI fuera del PR F01. |

## P2/P3: capacidades y entrega

| Trabajo | Fuente | Entrega y criterio de cierre | Dependencia / estado |
|---|---|---|---|
| N18 | F18 | Identidad de voz acorde al proveedor implementado y límites offline explícitos; cualquier nuevo runtime requiere trabajo propio. | Pendiente; sin voz nueva en F01. |
| N19 | F19 | Cancelar pipeline completo, evitar audio tardío/concurrente y aclarar rate/pitch; pruebas de carrera y audio autorizado. | N18; pendiente. |
| N20 | F20 | OAuth incremental, permisos por servicio, expiración/revocación y pruebas 401/403/429 en proyecto/cuentas desechables autorizados. | N02/N03; pendiente; sin escrituras Google en F01. |
| N23 | F23 | Unificar SW/manifiesto, cachés del producto, lifecycle y offline frío/caliente/update; separar push durable. | N04/N12; pendiente. |
| N24 | F24 | Decidir PWA frente a apps nativas; sólo acreditar nativo con artefactos y smoke de dispositivo. | Definición de producto; pendiente. `vite build` no genera APK/IPA/desktop. |
| N25 | F25 | Responsive y accesibilidad modal: sin overflow a 390px, foco/teclado/Escape/semántica. | Pendiente; no se toca interfaz en F01. |
| N26 | F26 | Conectar contenido al editor, declarar plantillas y verificar persistencia/exportación basada en fixtures. | N09; pendiente. |
| N29 | F29 | Distinguir estado visual de Wi-Fi/BT/brillo y capacidades físicas verificadas; probar sólo en dispositivo autorizado. | N24; pendiente. |
| N30 | F30 | Runtime/modo productivo explícitos y CI con instalación congelada, tests, tipos/build/smoke. | Pendiente. F01 ejecuta estas comprobaciones locales, no cierra toda operación/despliegue. |

## Aclaraciones documentales

| Referencia | Tratamiento |
|---|---|
| N28 / F28 | No hay definición independiente sustentada en los nueve informes. Solicitar aclaración de referencia/evidencia al mantener la auditoría; no inventar síntoma, severidad ni remedio. |
| N31 / F31 | El roadmap agrupa F31 con distribución/runtime, pero no lo define como hallazgo independiente verificable. Conservar como laguna documental; no duplicar F24/F30 ni declarar una vulnerabilidad nueva. |

Los esfuerzos del roadmap son estimaciones agrupadas, no calendario ni autorización para ejecutar todo el backlog. Cierre de cada trabajo: commit/PR independiente, regresión pertinente, evidencia con SHA, límites declarados y revisión. N01 no implica aprobación global para producción; F02–F06 y otros riesgos siguen abiertos.

## Fuentes leídas

Los enlaces quedan fijados al commit de auditoría:

1. [Resumen ejecutivo](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/1f915074d374a8f98421808ede347e241b014114/audit/01-EXECUTIVE-SUMMARY.md).
2. [Arquitectura](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/1f915074d374a8f98421808ede347e241b014114/audit/02-ARCHITECTURE.md).
3. [Motores](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/1f915074d374a8f98421808ede347e241b014114/audit/03-ENGINES.md).
4. [Google](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/1f915074d374a8f98421808ede347e241b014114/audit/04-GOOGLE-INTEGRATIONS.md).
5. [Voz](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/1f915074d374a8f98421808ede347e241b014114/audit/05-VOICE-MULTILINGUAL.md).
6. [Seguridad](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/1f915074d374a8f98421808ede347e241b014114/audit/06-SECURITY.md).
7. [Pruebas históricas](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/1f915074d374a8f98421808ede347e241b014114/audit/07-TEST-RESULTS.md).
8. [Roadmap](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/1f915074d374a8f98421808ede347e241b014114/audit/08-REMEDIATION-ROADMAP.md).
9. [Matriz de capacidades](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/1f915074d374a8f98421808ede347e241b014114/audit/09-FUNCTIONALITY-MATRIX.md).
