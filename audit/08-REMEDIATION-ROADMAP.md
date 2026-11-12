# Plan de remediación diagnóstico

> Auditoría independiente · 2026-10-23 UTC · `main@2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7` · rama `audit/codex-deep-review`. Evidencia del código fijada a ese SHA; no se cambió código funcional.

No se ha corregido implementación. Las siguientes fases son propuestas revisables basadas en los defectos encontrados, con criterios de cierre. Estimaciones de esfuerzo en días de ingeniería son orientativas; no constituyen compromiso de calendario. No incluyen tiempos de aprobación OAuth ni validación de tiendas.

## Prioridades, impacto y dependencias

| Fase | ID / severidad | Acción a planificar | Impacto | Esfuerzo | Dependencia y criterio de cierre |
|---|---|---|---|---|---|
| P0: límite de confianza | F01 crítica | Eliminar destino arbitrario con claves de servidor; destinos por proveedor, límites de egress y protección DNS/redirect | Exfiltración y SSRF | 1–3 d | Antes de exponer red; tests con IP privada, IPv6, DNS rebinding/redirect y clave ligada a host |
| P0 | F02/F03/F04 altas | Autenticar backend; autorización por usuario/tarea/suscripción; rate limiting, cuotas, topes de texto/tokens/respuesta | Costes, privacidad, spam | 3–6 d | Modelo de identidad definido; dos usuarios no leen/controlan recursos ajenos; anónimos rechazados |
| P0 | F05/F06 altas | Rediseñar custodia de claves y bóveda; exigir contraseña propia, bloqueo real, persistencia y recuperación probada | Protección y pérdida de datos | 3–6 d | Decisión de amenaza/custodia; tests de reload/backup/contraseña errónea/rotación; retirar afirmaciones no sustentadas |
| P0 | F09/F11/F27 altas/medias | Devolver fallo/no ejecutado cuando no hay efecto; diferenciar generado, estimado, mock y verificado | Decisiones basadas en falsos éxitos | 1–3 d | Todos los fallbacks y telemetría con procedencia; cero realExecution sin recibo de efecto |
| P0 | F21 alta contextual | Triage de 11 advisories y dependencias alcanzables; resolver lock reproducible sin esconder npm ci | Riesgo de dependencia | 1–3 d | Decidir npm o Bun; instalación congelada/CI, mitigación de avisos confirmada por pruebas y registro actualizado |
| P1: integridad | F07 alta | Migrar claves vvc_acia a vvc_liam de forma versionada/idempotente con respaldo y rollback | Recuperar datos aparentemente perdidos | 1–2 d | No borrar claves anteriores antes de verificar; tests con 11 claves, corrupción y migración interrumpida |
| P1 | F08/F22 altas/medias | Routing por proveedor explícito, catálogo validado, configuración única/persistencia y procedencia del modelo efectivo | Modelo correcto y coste predecible | 2–4 d | Selección de Gemma no entra en Gemini; reload mantiene preferencias; claves/endpoints no se cruzan |
| P1 | F10/F13 altas | Unificar control de ejecución; no confiar en forcePriority cliente; eliminar inferencias duplicadas | Permisos y consumo | 2–4 d | Un comando produce una decisión y una inferencia autorizada; rechazo impide toda rama |
| P1 | F14/F15 altas | Reconciliación Firestore completa y por cuenta; guardar campos; errores visibles; corregir contrato PhoneContact | Consistencia y privacidad | 3–5 d | Dos clientes y dos usuarios: create/update/delete/empty snapshot/offline/reconnect; contacto importado usable |
| P1 | F16/F17 altas | Validación de intención/negación/ambigüedad, horas/PM/mañana, timezone/DST; scheduler verificable | Evitar acciones y recordatorios erróneos | 3–6 d | Casos adversos del corpus, acciones sensibles confirmadas, alarmas disparan y vencidos se recuperan |
| P1 | F12 alta | Cola durable con ownership, estados, cancelación, límites de concurrencia, idempotencia y recuperación | Operación fiable y escalable | 4–7 d | Reiniciar/reintentar no pierde ni duplica efectos; cancelación y backpressure comprobados |
| P2: capacidades reales | F11 alta | Elegir alcance de agentes; herramientas tipadas con permisos, aprobación, recibos y aislamiento; handoff si es requisito | Autonomía demostrable | 5–12 d | Depende de P0/P1; prompt injection no amplía permisos; cada acción tiene resultado externo verificable |
| P2 | F20 media/alta | Auth Google incremental con expiración/revocación; proyecto/cuentas de prueba; validar scopes y APIs por servicio | Workspace sostenible | 3–6 d + aprobaciones | Matriz real de read/write por servicio sin datos personales; 401/403/429 y consentimiento parcial probados |
| P2 | F26 alta | Conectar contenido generado al editor; distinguir plantilla de documento basado en datos; guardar/exportar con pruebas | Documentos útiles sin cifras inventadas | 2–4 d | La orden abre exactamente el contenido producido; persistencia y export de fixtures verificadas |
| P2 | F18/F19 medias | Nombres de proveedor reales; cancelación de todo pipeline, rate/pitch coherentes, fallback e idiomas explícitos | Voz fiable | 2–5 d | Tests de carrera/cancelación; audio por las seis voces, tiempos y evaluación acústica con muestras suficientes |
| P2 | F23/F25 medias | Unificar SW/manifiesto; offline frío/actualización; responsive, foco, Escape y semántica accesible | Uso móvil y PWA | 2–4 d | Sin overflow a 390px; teclado/lector; update seguro y caché fría/caliente/múltiples navegadores |
| P2/P3: entrega | F24/F30/F31 altas/medias | Fijar Node y modo producción; CI con pruebas; definir si se entrega PWA o apps nativas reales | Reproducibilidad y distribución | 2–4 d web; 5–10 d por plataforma nativa | Artefactos firmados/reproducibles y smoke en dispositivo; no renombrar vite build como build nativo |

Los esfuerzos se solapan y no deben sumarse como promesa. No implementar herramientas autónomas antes de cerrar identidad, autorización, validación y trazabilidad.

## Criterios para revisar el dictamen

1. F01 cerrado con pruebas de destinos/secretos; backend no acepta inferencia, lectura VAOS ni push anónimos.
2. Ningún resultado simulado se presenta como ejecución real; proveedores/modelos/errores/tokens tienen procedencia y medición declaradas.
3. Datos, secretos y colas se aíslan por usuario, sobreviven el ciclo de vida acordado y tienen recuperación demostrada.
4. Comandos negados, fechas inválidas, ambigüedad y emergencia informativa no disparan acciones.
5. Instalación congelada, tipos, build, suite automatizada y smoke de producción pasan en CI; advisories con triage cerrado.
6. Google y voz se validan en cuentas/dispositivos de ensayo autorizados. Sólo las plataformas con artefactos y pruebas reciben estado nativo funcional.

Hasta entonces, compilar y renderizar no bastan para READY WITH CONDITIONS. La reevaluación debe fijar un nuevo SHA y conservar resultados fallidos, no reescribir el diagnóstico actual como éxito histórico.

## Respuesta a los diez riesgos solicitados

| Riesgo | Diagnóstico y ubicación |
|---|---|
| 1. Migración ACIA → LIAM | F07: 11 claves renombradas sin migrador, datos antiguos quedan invisibles; SecretsService conserva vvc_secret, pero pierde fallback ACIA. [02](02-ARCHITECTURE.md), [07](07-TEST-RESULTS.md). |
| 2. node server.ts | Pasa Node24; falla Node20; sin engines y npm start no fija production. F30, [07](07-TEST-RESULTS.md). |
| 3. Kokoro declarado | Edge→Gemini→Web Speech, sin Kokoro. F18, [05](05-VOICE-MULTILINGUAL.md). |
| 4. Credenciales navegador | Texto plano; Zero-Knowledge no respaldado para claves/chat. F05, [06](06-SECURITY.md). |
| 5. Tareas críticas por texto | forcePriority y keywords; no autorización real de efectos. F10/F17, [03](03-ENGINES.md). |
| 6. Simulación | Éxitos fijos, docs de plantilla, radio UI, TPS estimados. F09/F11/F26/F27/F29. |
| 7. Reinicios | Map y setTimeout, sin persistencia/recovery. F12, [02](02-ARCHITECTURE.md). |
| 8. Workspace | CRUD parcial con mocks; token sin refresh; varias APIs ausentes. [04](04-GOOGLE-INTEGRATIONS.md). |
| 9. Tres motores | Parser previo a todo; VAOS paralelo, no aislamiento/gateway único. F13, [03](03-ENGINES.md). |
| 10. Telemetría | Duración local sí; TPS boot constantes y caracteres/4; no throughput LLM fiable. F27, [03](03-ENGINES.md). |

Evidencias de migración: padre `109754bd661276f5030a6c42d2db7010814d3b58` contenía vvc_acia_model/cloud_integration/voice/theme/contacts/tasks/events/chat_history/custom_agents/active_agent_id/webhook; el SHA auditado consulta equivalentes vvc_liam, sin referencias vvc_acia en src. [src/App.tsx:189](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7/src/App.tsx#L189), [src/App.tsx:305](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7/src/App.tsx#L305), [src/services/secretsService.ts:125](https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE/blob/2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7/src/services/secretsService.ts#L125). No se afirma borrado físico: la pérdida es aparente por dejar de consultar claves previas.
