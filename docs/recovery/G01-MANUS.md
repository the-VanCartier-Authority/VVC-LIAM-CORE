# G01 · Dependencia D01 completa y gate CI de navegador

2026-10-26 · Issue #2 · PR existentes #3/#5/#7. Fuente: informes y matrices Manus del 25 de octubre aportados por el propietario. El dictamen sobre `57fc012f2ed8894313cc7e2770504611a10cb05b` es evidencia independiente del árbol anterior, **no aprobación de este SHA nuevo ni autorización de fusión**.

## Base exacta y cambios

- main preservada: `2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7`.
- #3 N01: `0be6e86a0099c2c6f4947695b69522a2ba5e864f`, sin cambios.
- #5 D01 ampliado: `d9df435f0afc34f6064223f962df4858616a2cf0`, sin cambios.
- #7 inicial: `7f0cffdd39a95eda359b0aebe670ba7405f0955e`; partía de D01 `963645202ecd76cac62afd54c8f9cd215b5c29b2`, sin la ampliación.
- Candidato de código/pruebas de G01: **`fb474b91ab32f6b0bff7a9e74caf0125d32473b9`**, árbol `8e1a0504179dc476a9b01578165ae9c8a01c7762`. El head publicado de #7 puede añadir este documento y evidencias: su SHA final y CI exacta se registran en #7/#2, sin atribuirle CI de un antecesor.

Se creó el worktree de candidato desde main exacta, se avanzó al #7 inicial y se incorporó el #5 completo mediante merge de dependencia `6f3e1f688a595039ef41f411aedb6f343bd8c8de`. Se preserva el historial de ambos PR y sus commits de regresión; no hubo reescritura ni force-push. La base declarada de #7 sigue siendo la rama #5, ahora contenida íntegramente en su ascendencia. No se crea ningún PR adicional.

El diff de código de producto contra el candidato G01 histórico `9908785c79e633628328246f381a91c55d705a58` es **vacío** en src/ y server.ts. Contra #5 actual, el diff propio de #7 es tooling/CI/pruebas/documentación, sin código de otras unidades. Las diferencias con el árbol completo #41 son las unidades posteriores todavía ausentes; no se copiaron archivos del ensayo que incluyeran esos cambios.

## Reproducciones y preservación de regresiones

Las cinco pruebas de `webhook-truthfulness.test.mjs` de #5 se ejecutaron sobre el #7 inicial: **0 pass/5 fail**, exit 1. Antes de incorporar D01 se ejecutó también la nueva fixture Chromium: el HTTP403 y el202 se comunicaban como success/status200. La fixture final sigue fallando sobre ese código anterior y pasa tras incorporar D01 completo.

La reproducción de navegador queda en el commit de pruebas `12b684b1193218ae2a9d952f032944c244f20464`; el ajuste de una suposición del propio fixture queda en `fb474b91…`. En el primer intento posterior al merge se esperaba que CORS siempre impidiera transmitir el POST: el navegador mostró cuatro POST de fixture, incluyendo el que no devolvía un recibo CORS legible. Ese fallo se conserva en `browser-initial-fixture-assumption.txt`. La aserción se corrigió para comprobar el contrato real: CORS puede bloquear antes o después de transmitir; siempre se exige delivery unverified, sin inventar entrega ni no-entrega. No se alteró la función de producto para satisfacer el test ni se retiraron los casos que reproducían éxitos ficticios.

Se conservan byte a byte todos los tests/fixtures/scripts existentes de #7 y #5. Se mantiene F01, separación server/BYOK, TLS/DNS/IP/excepciones locales exactas, resultados generated/simulated/failed/unavailable y realExecution=false. El inventario y comparación por blobs se incluyen en evidence/g01-manus/.

## CI fortalecida, sin confundir suites

- `npm test`: suite Node `tests/*.test.mjs`; **no ejecuta Chromium**.
- `npm run test:browser`: gate separado, enumera y ejecuta explícitamente los `tests/*-browser.mjs` presentes; falla si no hay fixtures, si una falla o excede 120s.
- En G01 existe una fixture, `webhook-truthfulness-browser.mjs`, con cinco casos:403 fallido,202 aceptado sin acción externa acreditada, CORS ilegible, redirect rechazado y URL con credenciales no intentada. Verifica además payload sintético, ausencia de Cookie/Authorization, cero destino externo y realExecution=false.
- `playwright-core` **1.64.1 exacto**, sólo devDependency. bun.lock añade únicamente ese paquete; dependencias/versiones de producto intactas.
- El workflow instala Chromium mediante el CLI de ese paquete fijado y lo ejecuta en un paso con nombre propio. Revisión bundled 1248 / versión esperada 156.0.8078.4 según browsers.json; la versión efectivamente ejecutada queda en el log. Localmente se verificó Chromium 154.0.8037.57 del entorno. No se presentan como el mismo binario.
- En las pruebas de navegador se bloquean service workers y toda URL fuera de los dos orígenes loopback de fixture. Los servicios externos no se contactan. La instalación de dependencias/navegador es una fase distinta del tráfico del producto bajo prueba.

Las fixtures de grupos posteriores todavía no están en G01. Deben conservar sus fronteras de red y adaptarse al ejecutable del gate al incorporarse; no se declaran ejecutadas ni cubiertas por este único fixture. H05/egress-combination sigue en G13 y no se importa anticipadamente.

## Verificación local del candidato de código

Worktree nuevo, sin node_modules previo, Node 24.19.0 y Bun 1.4.4:

```bash
bun install --frozen-lockfile
npm run check:runtime
node --test --test-timeout=15000 tests/f01-regression.test.mjs tests/local-exception-review.test.mjs tests/provider-egress.test.mjs tests/provider-http.test.mjs tests/truthfulness-http.test.mjs tests/truthfulness-unit.test.mjs tests/webhook-truthfulness.test.mjs
npm test
npm run lint
npm run build
npm run smoke:production
CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:browser
git diff --exit-code -- package.json bun.lock
git diff --check
```

Suite completa **76/76**, sin omitidos/cancelados; tipos/build/smoke y Chromium correctos. El smoke acredita HTML/asset/manifest200, cuatro rutas rechazadas sin llamadas, un proveedor local registrado y Gemini sin clave401, externalInferenceCalls0. Se conserva el aviso de bundle. La CI completa del **head final publicado** se verificará y enlazará en #7/#2; no se reutiliza la CI inicial de 71 casos ni la de 219 casos de #41.

## Matriz, revisión y bloqueo del siguiente grupo

[groups/MATRIZ_G01_G13.csv](groups/MATRIZ_G01_G13.csv) conserva la referencia Manus y añade el estado de preparación actual. El SHA de código es un campo distinto del head documental/CI publicado en #7/#2; no se inventa un hash autorreferente dentro del propio commit. El head #7 inicial queda identificado como histórico. G02 deberá actualizar sus bases sobre el nuevo #7 cuando exista revisión/autorización pertinente; las CI de sus heads antiguos no certifican un candidato futuro sobre esta base.

Estado del ciclo: **preparado técnicamente, pendiente de revisión independiente del head final**. Sin usuario/equipo GitHub autorizado designado no se inventa una asignación ni aprobación; se publica el encargo del SHA exacto para el revisor independiente. El informe Manus 25 de octubre no cubre automáticamente este diff nuevo. G02–G13 quedan bloqueados por la revisión pendiente de G01; #21/D03 y H01–H05 continúan pendientes en sus grupos, sin cambios anticipados.

Riesgos abiertos: main sigue sin integrar F01; G01 no incorpora B01/B02/B03/B05 ni E02/G04. B04 legado sin UID, C01 bóveda/recuperación, C02 secretos BYOK, revocación Firebase, cuotas/estado volátiles, persistencia/backup/multiinstancia y capacidades externas no verificadas permanecen abiertos. No se migran ni asignan datos históricos, no se usan credenciales reales o servicios de pago, no se fusiona ni despliega. #41 se conserva draft e inmutable como evidencia histórica; #42 también conserva su head.
