# Evidencia N01 / F01

Fecha: 2026-10-24 UTC. Checkout completo aislado en `/workspace/VVC-LIAM-CORE`; rama `fix/p0-a-f01-ssrf`. No se ha fusionado ni desplegado la corrección. N01 queda implementada y verificada localmente, pendiente de revisión/integración.

## Revisiones verificadas

| Revisión | SHA | Evidencia |
|---|---|---|
| `main` y base auditada | `2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7` | Conector GitHub, clon completo y `git rev-parse origin/main`; coinciden. |
| Nueve informes del PR #1 | `1f915074d374a8f98421808ede347e241b014114` | Leídos en rama `audit/codex-deep-review`; [índice](BACKLOG.md#fuentes-leídas). No se copian ni alteran en este PR. |
| Regresiones antes de corregir producto | `ba253050b0972c0683d72658ce503bcf2602fd91` | Sólo añade tres archivos de test. Cinco fallos esperados; [salida](evidence/before.txt). |
| Implementación y suite completa | `2adf45eb85b39d925b32e7dbbc07beebf9258bc9` | Commit funcional; la entrega posterior añade documentación/evidencia. |

## Reproducción del defecto antes del cambio

`node --test tests/f01-regression.test.mjs` se ejecutó **antes de editar server.ts**. Resultado: exit 1, 5 tests, 0 pass, 5 fail. Las aserciones exigen cero envíos; fallan porque el fetch interceptado registra:

| Sink / caso | Envíos interceptados | Credencial sintética |
|---|---:|---|
| NVIDIA principal | 1 | Servidor |
| NVIDIA con modelo que provoca reintento | 2 | Servidor, en ambos |
| Chat custom | 1 | BYOK |
| Test NVIDIA | 1 | Servidor |
| Test custom | 1 | BYOK |

El preload sustituye todo fetch del proceso hijo. No se envía ninguna credencial a un servicio real. No es una prueba de exfiltración en producción. Después del cambio, esos cinco tests pasan y devuelven 400 / `EGRESS_POLICY` sin envíos.

## Validación después del cambio

Node **24.19.0**, Bun **1.4.4** (`38afee6c8`), Linux x86_64. OpenSSL se usa sólo para un certificado/key efímeros de ensayo. Herramienta Bun instalada en `/tmp/vvc-bun-toolchain`, fuera del proyecto. Dependencias de producto y `bun.lock` no cambian; sólo se añaden scripts de tests/smoke a package.json.

| Comando | Resultado |
|---|---|
| `bun install --frozen-lockfile` | Exit 0; 664 paquetes en instalación inicial; repetido tras añadir scripts con exit 0. Lock intacto. |
| `npm test` | Exit 0, **61/61**, cero skip/cancel/todo; [salida](evidence/after.txt). Se usa el runner nativo Node. |
| `npm run lint` | Exit 0; ejecuta `tsc --noEmit`; [salida](evidence/typescript.txt). |
| `npm run build` | Exit 0; Vite 8.3.2, 2.492 módulos y PWA; [salida](evidence/build.txt). Warning preexistente: chunk mayor de 500 kB. |
| `npm run smoke:production` | Exit 0 con `NODE_ENV=production` en proceso hijo; [salida](evidence/smoke.txt). |
| `git diff --check` | Exit 0. |

Los 61 tests incluyen: las cinco regresiones originales; registro y credenciales por proveedor; rangos IPv4/IPv6/representaciones numéricas; DNS vacío/mixto/inválido/cambiante; pinning y validación del peer/puerto; fallback de dirección sólo antes de transmitir; errores y plazos de DNS/cuerpo; excepciones locales exactas; 301/302/303/307/308 sin reenviar secretos; rechazo de políticas sin retry/fallback; límite de cuerpo y sanitización de errores; HTTP real a fixtures de NIM/OpenAI-compatible/Ollama/vLLM e IPv6; HTTPS local con CA de ensayo y SNI; rechazo de CA/nombre incorrectos sin encabezados HTTP; Gemini SDK con fetch mock para clave servidor, BYOK, test y fallback.

Smoke real del servidor Express sobre el artefacto `dist`: HTML, asset JS y manifiesto HTTP 200; sin cliente Vite de desarrollo; configuración sin secreto sintético; cuatro requests maliciosos rechazados sin llegar al destino local; un proveedor local registrado aceptado; Gemini sin clave da 401. Cero inferencias externas. Es una prueba del modo de producción local, no un despliegue remoto ni una certificación de producción.

## Cómo repetir

En un checkout completo con Node 24.19.0, Bun 1.4.4, OpenSSL y permiso de sockets locales:

```bash
bun --version
node --version
bun install --frozen-lockfile
npm test
npm run lint
npm run build
npm run smoke:production
git diff --exit-code bun.lock
git diff --check
```

Para verificar el estado anterior, usar un **worktree temporal** del commit `ba253050b0972c0683d72658ce503bcf2602fd91`, instalar congelado y ejecutar sólo `node --test tests/f01-regression.test.mjs`; deben fallar los cinco tests. No mover `main` ni ejecutar sobre un despliegue con claves reales. Los helpers sustituyen ambas claves cloud por valores vacíos/sintéticos y crean fixtures desechables; no cargan credenciales personales.

## Acceso y límites

La CLI `gh auth status` sigue indicando token inválido en `GH_TOKEN`. La conexión GitHub disponible funciona y reporta permisos de lectura/escritura. La clonación por Git funciona con red habilitada en el sandbox; no se imprimió ni reemplazó ningún token. El fallo inicial de proxy con sockets restringidos no se atribuye al producto.

No se llamó a NVIDIA/Gemini/OpenAI de pago, ni se usaron modelos externos o credenciales reales. Las pruebas de DNS cambiante usan un resolver inyectado y conexiones a fixtures loopback; no atacan DNS ni metadata reales. Los contratos no prueban disponibilidad de modelos, OAuth Google, audio o dispositivos. El código Gemini conserva el SDK con origen fijo; no se presenta como transporte fijado a IP para todas las APIs del sistema.

F02–F06, F09 y el resto del [backlog](BACKLOG.md) siguen abiertos. F28/F31 son lagunas documentales. No se añaden voz, agentes, integraciones Google, UI, CI global, upgrades de dependencias ni cambios de plataforma. Los nueve informes históricos y la rama `main` se mantienen intactos.
