# Pruebas, resultados y reproducción

> Auditoría independiente · 2026-10-23 UTC · `main@2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7` · rama `audit/codex-deep-review`. Evidencia del código fijada a ese SHA; no se cambió código funcional.

## Entorno y fidelidad de fuente

Linux x86_64, Intel Xeon Platinum 8573C, 3 CPU visibles; Node 24.19.0, npm 11.9.0, Bun 1.4.4 temporal, Chromium 154.0.8037.57 y playwright-core 1.64.1 temporal. UTC. Directorio de pruebas: checkout aislado `/workspace/VVC-LIAM-CORE-git`, rama audit/codex-deep-review, HEAD inicial SHA auditado. No había AGENTS.md en árbol ni directorios padre consultados. No se delegó en agentes adicionales.

La clonación inicial sin permiso de red del sandbox falló al conectar al proxy. Se recuperaron 71 archivos de texto por GitHub y se verificó su hash Git, sin usar esa copia parcial para el build definitivo. Al habilitar acceso de red explícito se clonaron los 78 archivos completos y se ejecutó allí la prueba. Los siete binarios no accesibles mediante lectura UTF-8 del conector sí estuvieron en el clon completo. No se alteró política de red ni se eludió el proxy.

## Registro de comandos y resultados

| Comando / prueba | Resultado real |
|---|---|
| git clone --branch main --single-branch URL | Inicialmente exit128 sin sockets; después exit0 con red permitida. HEAD 2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7. |
| git switch -c audit/codex-deep-review | Exit0; main intacta. Rama remota creada desde el mismo SHA. |
| npm ci | **Exit1 EUSAGE**: no package-lock.json/npm-shrinkwrap.json. Repetido en clon completo, misma causa. No se creó un lockfile para ocultarlo. |
| npm run lint / build / dev, antes de instalar | Exit127: tsc/vite/tsx ausentes. npm start: exit1 express no instalado. Limitación inicial, no diagnóstico final de esos comandos. |
| npm audit --omit=dev | **Exit1 ENOLOCK**; no puede evaluar vulnerabilidades sin lockfile npm. |
| npx --yes bun --version | Exit0, 1.4.4; herramienta en cache temporal. |
| npx --yes bun install --frozen-lockfile | **Exit0**, 664 paquetes en 21,37 s; hashes de package.json y bun.lock intactos. Alternativa documentada, no éxito de npm ci. |
| npm run lint, tras frozen install | **Exit0**, tsc --noEmit sin diagnósticos. |
| npm run build | **Exit0**, 2.492 módulos; Vite 8.3.2, 2,31 s reportados por Vite para frontend; PWA genera SW/precache. Warning de chunk >500 kB. |
| NODE_ENV=production PORT=3101 npm start | Sin red: EPERM al bind, exit1. Con sockets permitidos: arranca y sirve HTTP 200. No se usa el error sandbox como defecto del producto. |
| PORT=3102 npm run dev | Sin sockets: EPERM pipe tsx, exit1. Con sockets permitidos: arranca y sirve HTTP 200. |
| npx --yes --package=node@20.19.0 node server.ts | **Exit1 ERR_UNKNOWN_FILE_EXTENSION .ts** en Node20.19.0. No se cambió comando start. |
| npm run build:android / build:ios / build:desktop | **Exit0 cada uno**; 0 artefactos nativos; cada dist: 6 PNG, 8 JS, 1 ICO, 1 JSON, 1 SVG, 2 HTML, 1 CSS. |
| tsc --noEmit --noUnusedLocals --noUnusedParameters | 113 diagnósticos de no uso; exit individual no conservado por el comando compuesto. No es el lint configurado. |
| npx --yes bun audit --production --json | **Exit1**, 11 avisos en 3 paquetes; [detalle](06-SECURITY.md). |
| npm ls @grpc/grpc-js dompurify vite --omit=dev --all | Rutas instaladas corroboradas; no se descargó ni cambió dependencia. |
| Harness aislado | 35 checks, 0 errores del harness; incluye reproducción intencional de defectos y contratos mock. |
| HTTP local con proveedor mock | NVIDIA/custom anónimos llegan a loopback; modelo preservado; forcePriority degrada; tarea sin clave figura completed; lista anónima devuelve resultado. |
| Navegador con servicios externos bloqueados y LLM/TTS mock | UI carga, tarea local persistida, selector efectivo pero no persistido, doble POST cloud, modal sin aria dialog, overflow y offline caliente. |
| POST /api/tts, es_mateo, texto sintético | HTTP200 fallback NEURAL_TTS_UNAVAILABLE, audio0; 5.097,49ms n1; Edge WebSocket ECONNREFUSED; Gemini sin clave no se invocó. |
| Catálogo auxiliar NVIDIA CLI | Intento npx skills add nvidia/skills --list limitado a 15 s sin salida útil. No se usó para afirmar disponibilidad ni instalar skills. |

La advertencia inicial de npm sobre escritura de logs en cache por defecto es del sandbox; no explica la ausencia real de lockfile. Las herramientas auxiliares, logs, capturas y harness se mantuvieron en `/tmp`. Los nueve Markdown son los únicos archivos versionados de la auditoría.

### Salidas relevantes conservadas

```text
npm ci: The npm ci command can only install with an existing package-lock.json
or npm-shrinkwrap.json with lockfileVersion >= 1.
npm audit: ENOLOCK — This command requires an existing lockfile.
Node20 start: TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".ts"
```

```text
> vvc-liam-core@1.0.0 build
> vite build

vite v8.3.2 building client environment for production...
transforming...
✓ 2492 modules transformed.
rendering chunks...
computing gzip size...
dist/registerSW.js                       0.13 kB
dist/manifest.json                       2.15 kB │ gzip:   0.86 kB
dist/index.html                          4.92 kB │ gzip:   1.71 kB
dist/assets/index-UDTrISXI.css         109.99 kB │ gzip:  16.25 kB
dist/assets/purify.es-Bvo9QlJ8.js       28.08 kB │ gzip:  11.08 kB
dist/assets/index.es-MPacMaEa.js       151.37 kB │ gzip:  48.87 kB
dist/assets/html2canvas-CJ40Hj3b.js    199.48 kB │ gzip:  46.77 kB
dist/assets/index-f5XTeizj.js        1,749.85 kB │ gzip: 517.06 kB

[plugin builtin:vite-reporter]
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 2.31s

PWA v2.0.0
mode      generateSW
precache  27 entries (2649.42 KiB)
files generated
  dist/sw.js
  dist/workbox-9c191d2f.js
```

El bundle principal fue 1.749,85 kB minificado / 517,06 kB gzip; CSS 109,99 kB /16,25 kB gzip; precache generado 27 entradas/2.649,42 KiB. No se midieron Core Web Vitals ni se infiere rendimiento móvil a partir del tamaño.

## Evidencia HTTP y browser

GET `/`, `/api/config`, `/api/vaos/health`, `/api/vaos/tasks`, `/manifest.json`, `/sw.js` y `/does-not-exist` devolvieron 200 en puertos 3101 y 3102. La ruta desconocida devolvió HTML de App; no 404. La configuración confirmó false para ambas claves cloud y hasNeuralTTS, y true para push. `/sw.js` servido tuvo 6.574 bytes y SHA256 `5df18bee7ce06acd1fbc9d40b151d63e4d58d33299be5b8f407d20bbdca10047`: coincide con public/sw.js, no dist/sw.js generado.

La prueba HTTP mock usó dos requests a 127.0.0.1:3199; el primero recibió Authorization **sintético**, ambos modelos solicitados se conservaron. forcePriority devolvió P2/FAST_PATH, policyApproved y realExecution true. La tarea asíncrona sin Gemini terminó con durationMs0, tokensGenerated40 (estimados) y tokensPerSec800; no se creó documento real.

Chromium: escritorio 1365×900 → document.scrollWidth1596; móvil 390×844 → scrollWidth545. El modal de agentes abierto tenía 0 role=dialog, 0 aria-modal y 1 botón sin nombre accesible por texto/aria-label/title. No es una auditoría WCAG completa. No se evaluaron lector de pantalla, contraste o navegación exhaustiva de teclado.

Selector: Qwen → localStorage(vvc_liam_model)=null → reload → Llama default. Luego una inferencia con clave sintética produjo `/api/vaos/dispatch` y `/api/chat/nvidia` con Qwen; ambos transportes interceptados, cero inferencia externa. Crear tarea local se verificó en localStorage. SW activo controló la página, cache vvc-liam-core-cache-v2, y App recargó offline después del calentamiento. Servicios externos intentados se abortaron por hostname en Playwright: fuentes, Google API script, Firestore y www.google.com. No hubo excepción pageerror.

## Harness: resultados completos resumidos

| Check ejecutado | Aserción/resultados |
|---|---|
| `RT-corpus` | OK: Corpus de 15 entradas; ver 03 |
| `RT-valid-timer` | OK: 300 seconds |
| `RT-invalid-hour-accepted` | OK: DEFECT reproduced |
| `RT-negation-ignored` | OK: DEFECT reproduced |
| `RT-zero-timer-accepted` | OK: DEFECT reproduced |
| `RT-english-french-unsupported` | OK: not handled |
| `RT-ambiguous-delete-first` | OK: DEFECT first match selected |
| `RT-unhandled-success-fiction` | OK: DEFECT claims execution |
| `RT-imported-contact-crash` | OK: DEFECT missing phone field throws |
| `calendar-overlap` | OK: overlap detected |
| `RT-benchmark` | OK: {"n": 20000, "warmup": 2000, "unit": "ms", "p50": 0.0025979999999208303, "p95": 0.009217999999918902, "p99": 0.04566899999997531, "scope": "parser CPU only; no UI/audio/network"} |
| `VAOS-forcePriority-downgrade` | OK: {"normal": {"approved": true, "priority": "P0_CRITICAL", "route": "ASYNC_PATH", "category": "CRITICAL_SECURITY_OR_OSINT"}, "forced": {"approved": true, "priority": "P2_LOW", "route": "FAST_PATH", "category": "USER_OVERRIDE"}} |
| `VAOS-safety-before-override` | OK: initial filter holds |
| `VAOS-invalid-priority` | OK: DEFECT enum unvalidated at runtime |
| `VAOS-no-key-completed` | OK: {"status": "COMPLETED", "realExecution": true, "restartTasks": 0, "bootTps": 64} |
| `secrets-legacy-acia-ignored` | OK: DEFECT legacy namespace ignored |
| `secrets-plaintext-storage` | OK: plaintext confirmed with synthetic value |
| `crypto-roundtrip-and-wrong-password` | OK: AES-GCM roundtrip succeeds; wrong password rejected |
| `API-route-auth-handlers` | OK: single handler, no per-route authorization; global use is JSON + VAOS only |
| `API-SSRF-and-server-key-forwarding` | OK: DEFECT mock accepted loopback and received server fixture credential; NO request sent |
| `API-selected-model-forwarded` | OK: model forwarded on normal route |
| `API-custom-loopback` | OK: DEFECT no destination restriction (mock only) |
| `API-gemma-wrong-provider` | OK: DEFECT Gemma becomes Gemini Flash |
| `API-gemini-history-dropped` | OK: DEFECT earlier turns not sent |
| `API-NVIDIA-empty-fake-local` | OK: DEFECT empty provider output becomes local success |
| `API-failed-Gemini-fallback-fake-success` | OK: DEFECT provider failure hidden by canned success |
| `Google-Gmail-read-write-mocks` | OK: [{"url": "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10", "method": "GET"}, {"url": "https://gmail.googleapis.com/gmail/v1/users/me/messages/fixture?format=full", "method": "GET"}, {"url": "https://gmail.googleapis.com/gmail/v1/users/me/messages/send", "method": "POST"}] |
| `Google-Calendar-read-write-mocks` | OK: GET, POST, DELETE mock contracts |
| `Google-Docs-Drive-read-write-mocks` | OK: Drive list + Docs read/create/batchUpdate mocks |
| `Google-People-read-write-mocks` | OK: GET, POST, DELETE mocks |
| `Google-expired-token-no-refresh` | OK: 401 thrown; no refresh/retry |
| `voice-six-profiles-present` | OK: {"profiles": 12, "languages": ["Español", "English"]} |
| `STT-English-system-forced-Spanish` | OK: DEFECT en-US navigator -> es-ES STT |
| `voice-cancel-pending-fetch-revives-audio` | OK: DEFECT stopped request later plays; rate/pitch absent from server request; offline still attempts fetch |
| `voice-concurrent-fetches-both-play` | OK: DEFECT two stale requests start audio |


Un `ok:true` es una aserción del experimento, frecuentemente «el defecto existe». No son 35 pruebas de aceptación del producto y no sustituyen la suite ausente.

## Latencias

| Alcance | n | Warmup | p50 ms | p95 ms | p99 ms |
|---|---:|---:|---:|---:|---:|
| Parser puro | 20,000 | 2,000 | 0.002598 | 0.009218 | 0.045669 |

Benchmark del parser sin UI/voz/I/O, 20.000 muestras, 2.000 warmups, 15 comandos rotados, percentile nearest-rank. Se conserva una ejecución concreta; no se afirma estabilidad de esos microsegundos entre máquinas. Los efectos, LLM, STT y primera respuesta audible no tienen muestra suficiente: **no se informan p50/p95/p99**. El único TTS real devolvió un fallo, no una primera muestra audible.

## Pruebas que no se ejecutaron y causa exacta

| Verificación | Causa / consecuencia |
|---|---|
| Suite unitaria/integración existente | No hay archivos de tests ni script test en el SHA. Se crearon diagnósticos fuera del producto. |
| Inferencia real Gemini/NVIDIA/OpenAI/local externo | No hay claves o servidor de prueba autorizados; prohibición de inferencia de pago. Contratos se probaron con mocks. |
| OAuth Google, Gmail/Calendar/Drive/Docs/People live | Sin cuenta/proyecto de ensayo autorizado; escrituras sustituidas por mocks. |
| Firestore emulator/reglas desplegadas y dos cuentas | No hay configuración emulator/deploy ni credenciales/proyecto de ensayo; no se escribió en proyecto incorporado. |
| Sheets/Slides/Tasks/Meet API | Implementaciones ausentes; no hay ruta que probar. |
| Audio real de las seis voces, pronunciación/calidad, STT real | Edge falló ECONNREFUSED en es_mateo; no se repitió el mismo transporte fallido con otras voces; Gemini sin clave; sin sesión de micrófono/dispositivo de ensayo. |
| Push extremo a extremo | Sin permiso/suscripción de dispositivo de prueba autorizada; no se envió broadcast a usuarios. Registro y temporizadores revisados estáticamente. |
| Torch física, Wi-Fi/BT/brillo del OS, marcador, SMS, WhatsApp | Contenedor/Chromium sin dispositivo físico ni autorización de llamada/envío; no se activó tel: ni se enviaron mensajes. |
| Instalación real APK/iOS/desktop firmada | Toolchains/proyectos nativos no existen; scripts sólo generan web. |
| Offline frío, expiración de caché y múltiples navegadores | Sólo se ejercitó reload offline tras caché caliente en Chromium Linux; otras variantes no medidas. |
| Explotación de avisos de dependencias | Audit identifica versiones/avisos, no una explotación. No se realizó pentest externo. |
| npm run preview/clean | No son necesarios para comprobar servidor Express; preview no contiene API y clean sólo borra build. No se ejecutaron. |

## Reproducción de comandos principales

```bash
git clone --branch main --single-branch https://github.com/the-VanCartier-Authority/VVC-LIAM-CORE.git
cd VVC-LIAM-CORE
git checkout 2ffadf44c2c09bbc8dcde47046ee7d5c08a039f7
git switch -c audit/local-reproduction
npm ci                         # fallo esperado: no lockfile npm
npm audit --omit=dev            # fallo esperado: ENOLOCK
npx --yes bun@1.4.4 install --frozen-lockfile
npm run lint
npm run build
npm run build:android
npm run build:ios
npm run build:desktop
npx --yes bun@1.4.4 audit --production --json
./node_modules/.bin/tsc --noEmit --noUnusedLocals --noUnusedParameters
# terminal 1: sólo servidor local, sin claves cloud
GEMINI_API_KEY= NVIDIA_API_KEY= NODE_ENV=production PORT=3101 npm start
# terminal 2, si se quiere verificar desarrollo
GEMINI_API_KEY= NVIDIA_API_KEY= PORT=3102 npm run dev
# prueba de incompatibilidad conocida
npx --yes --package=node@20.19.0 node server.ts
```

Usar Node 24.19.0 para harness y runtime principal. El registro de advisories puede cambiar con el tiempo; el lock debe seguir siendo el del SHA. No introducir claves reales al reproducir SSRF o tests de secretos.

## Código íntegro del harness aislado

Guardar como `/tmp/vvc-audit-harness.mjs` y ejecutar `node --disable-warning=ExperimentalWarning /tmp/vvc-audit-harness.mjs "$PWD"`. Usa stripTypeScriptTypes para cargar el código original sin dependencias; quita imports/exports únicamente para sustituir límites de módulo por mocks. Conserva funciones de producto. Para server.ts evita ejecutar startServer. Las pruebas HTTP/browser posteriores cubren las limitaciones de ese aislamiento. No se añade el harness a los scripts de la aplicación.

```javascript
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {stripTypeScriptTypes} from 'node:module';
import {webcrypto} from 'node:crypto';
import {performance} from 'node:perf_hooks';
const root=process.argv[2]||process.cwd();
const results=[];
const quiet={log(){},warn(){},error(){},debug(){}};
function load(file,names,inject={}) {
  let s=fs.readFileSync(path.join(root,file),'utf8');
  s=stripTypeScriptTypes(s,{mode:'transform'});
  s=s.replace(/^import\s[\s\S]*?;\s*/gm,'').replace(/\bexport\s+(?=(?:async\s+)?(?:class|function|const|let|var))/g,'');
  s=s.replaceAll('import.meta.url',JSON.stringify('file://'+path.join(root,file)));
  if(file==='server.ts')s=s.replace(/startServer\(\);\s*$/,'');
  const context=vm.createContext({console:quiet,Date,URL,Buffer,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,atob,btoa,setTimeout,clearTimeout,setImmediate,process:{env:{},hrtime:process.hrtime},...inject});
  return vm.runInContext('(function(){'+s+';return {'+names.join(',')+'}})()',context,{filename:file});
}
async function check(id,fn){try{const detail=await fn();results.push({id,ok:true,detail});}catch(e){results.push({id,ok:false,error:String(e)});}}
function assert(x,msg='assertion failed'){if(!x)throw Error(msg);}
const cal=load('src/utils/calendarSync.ts',['detectEventConflicts','resolveEventConflict']);
const rt=load('src/utils/rtLiteEngine.ts',['parseNaturalVoiceCommand','generateRTLiteResponse'],cal);
const state={flashlight:false,brightness:80,volume:75,isMuted:false,wifi:true,bluetooth:true,batteryLevel:92,isCharging:false};
const parse=(s,contacts=[],tasks=[])=>rt.parseNaturalVoiceCommand(s,state,contacts,tasks,[]);
const inputs=['temporizador de 5 minutos','alarma a las 07:30','crear tarea comprar pan para mañana a las 18:00','encender linterna','no encender linterna','alarma a las 99:99','temporizador de 0 segundos','set a timer for 5 minutes','règle une alarme à 7 heures','definir temporizador de 5 minutos','xyzzy','¿qué es una emergencia?','sincronizar calendario','recuérdame estudiar a las 3 pm','recuérdame estudiar a las 7 de la mañana'];
await check('RT-corpus',()=>inputs.map(input=>({input,result:parse(input)})));
await check('RT-valid-timer',()=>{assert(parse(inputs[0]).newTimer.seconds===300);return '300 seconds';});
await check('RT-invalid-hour-accepted',()=>{assert(parse(inputs[5]).newAlarm.time==='99:99');return 'DEFECT reproduced';});
await check('RT-negation-ignored',()=>{assert(parse(inputs[4]).updatedDeviceState.flashlight===true);return 'DEFECT reproduced';});
await check('RT-zero-timer-accepted',()=>{assert(parse(inputs[6]).newTimer.seconds===0);return 'DEFECT reproduced';});
await check('RT-english-french-unsupported',()=>{assert(!parse(inputs[7]).isHandled&&!parse(inputs[8]).isHandled);return 'not handled';});
await check('RT-ambiguous-delete-first',()=>{const r=parse('eliminar tarea informe',[],[{id:'a',title:'informe A'},{id:'b',title:'informe B'}]);assert(r.taskToDeleteId==='a');return 'DEFECT first match selected';});
await check('RT-unhandled-success-fiction',()=>{const s=rt.generateRTLiteResponse('xyzzy');assert(s.includes('Operación ejecutada'));return 'DEFECT claims execution';});
const contacts=load('src/services/googleContactsService.ts',['convertGoogleContactsToPhoneContacts','listGoogleContacts','createGoogleContact','deleteGoogleContact']);
await check('RT-imported-contact-crash',()=>{const cs=contacts.convertGoogleContactsToPhoneContacts([{resourceName:'people/test',name:'Fixture',phoneNumber:'123'}]);let error;try{parse('llamar a otra persona',cs);}catch(e){error=e.message;}assert(error?.includes('includes'));return 'DEFECT missing phone field throws';});
await check('calendar-overlap',()=>{assert(cal.detectEventConflicts({date:'2026-10-23',time:'10:30',endTime:'11:30'},[{id:'e',date:'2026-10-23',time:'10:00',endTime:'11:00'}]).hasConflict);return 'overlap detected';});
await check('RT-benchmark',()=>{for(let i=0;i<2000;i++)parse(inputs[i%inputs.length]);const samples=[];for(let i=0;i<20000;i++){const t=performance.now();parse(inputs[i%inputs.length]);samples.push(performance.now()-t);}samples.sort((a,b)=>a-b);const q=p=>samples[Math.ceil(p*samples.length)-1];return {n:samples.length,warmup:2000,unit:'ms',p50:q(.5),p95:q(.95),p99:q(.99),scope:'parser CPU only; no UI/audio/network'};});
const queue=[];const vp={env:{},hrtime:process.hrtime};
const vaos=load('src/server/vaosOrchestrator.ts',['VaosPolicyEngine','VaosOrchestrator','vaosService','createVaosRouter'],{process:vp,setImmediate:fn=>queue.push(fn),GoogleGenAI:class{constructor(){throw Error('Forbidden external AI')}}});
await check('VAOS-forcePriority-downgrade',()=>{const normal=vaos.VaosPolicyEngine.evaluate('formatear bóveda');const forced=vaos.VaosPolicyEngine.evaluate('formatear bóveda','neutral','P2_LOW');assert(normal.priority==='P0_CRITICAL'&&forced.route==='FAST_PATH'&&forced.approved);return {normal,forced};});
await check('VAOS-safety-before-override',()=>{assert(!vaos.VaosPolicyEngine.evaluate('<script>','neutral','P2_LOW').approved);return 'initial filter holds';});
await check('VAOS-invalid-priority',()=>{const r=vaos.VaosPolicyEngine.evaluate('hola','neutral','INVALID');assert(r.approved&&r.priority==='INVALID');return 'DEFECT enum unvalidated at runtime';});
await check('VAOS-no-key-completed',async()=>{const v=new vaos.VaosOrchestrator();const t=v.enqueueTask('crear documento de prueba','custom-profile','P1_HIGH',['fixture']);while(queue.length)queue.shift()();await Promise.resolve();assert(t.status==='COMPLETED'&&t.result.data.realExecution===true);assert(new vaos.VaosOrchestrator().listTasks().length===0);return {status:t.status,realExecution:t.result.data.realExecution,restartTasks:0,bootTps:v.getTelemetry().points[0].tokensPerSec};});
const storage=new Map([['vvc_acia_nvidia_key','legacy-fixture']]);
const secrets=load('src/services/secretsService.ts',['SecretsService'],{localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}});
await check('secrets-legacy-acia-ignored',()=>{assert(secrets.SecretsService.getSecret('nvidia_api_key')==='');return 'DEFECT legacy namespace ignored';});
await check('secrets-plaintext-storage',()=>{secrets.SecretsService.setSecret('nvidia_api_key','fixture-only');assert(storage.get('vvc_secret_nvidia_api_key')==='fixture-only');return 'plaintext confirmed with synthetic value';});
const crypto=load('src/utils/crypto.ts',['encryptText','decryptText'],{window:{crypto:webcrypto,btoa,atob}});
await check('crypto-roundtrip-and-wrong-password',async()=>{const e=await crypto.encryptText('fixture','fixture-pass');assert(await crypto.decryptText(e.ciphertext,e.iv,e.salt,'fixture-pass')==='fixture');let rejected=false;try{await crypto.decryptText(e.ciphertext,e.iv,e.salt,'wrong');}catch{rejected=true;}assert(rejected);return 'AES-GCM roundtrip succeeds; wrong password rejected';});
const routes=new Map();const outbound=[];const aiCalls=[];let answer={choices:[{message:{content:'fixture response'}}]};let aiError=false;
const exp=()=>({use(){},get:(p,...handlers)=>routes.set('GET '+p,handlers),post:(p,...handlers)=>routes.set('POST '+p,handlers)});exp.json=()=>()=>{};
const serverProcess={env:{NVIDIA_API_KEY:'fixture-server-key'},hrtime:process.hrtime};
load('server.ts',[],{express:exp,dotenv:{config(){}},path, fileURLToPath:u=>new URL(u).pathname,process:serverProcess,createVaosRouter:()=>({}),webpush:{generateVAPIDKeys:()=>({publicKey:'fixture-public',privateKey:'fixture-private'}),setVapidDetails(){},async sendNotification(){outbound.push({push:true});}},fetch:async(u,o)=>{outbound.push({url:String(u),options:o});return {ok:true,status:200,json:async()=>answer,text:async()=>''};},GoogleGenAI:class{models={generateContent:async p=>{aiCalls.push(p);if(aiError)throw Error('fixture provider failure');return {text:'fixture AI response'};}};},setTimeout:()=>0,clearTimeout(){}});
async function request(route,body={}){const hs=routes.get('POST '+route);assert(hs);const res={code:200,body:null,status(c){this.code=c;return this;},setHeader(){},json(x){this.body=x;return this;}};await hs.at(-1)({body,headers:{}},res);return res;}
await check('API-route-auth-handlers',()=>{const paths=['/api/chat/nvidia','/api/chat/gemini','/api/chat/custom','/api/secrets/test','/api/push/send'];for(const p of paths)assert(routes.get('POST '+p).length===1);return 'single handler, no per-route authorization; global use is JSON + VAOS only';});
await check('API-SSRF-and-server-key-forwarding',async()=>{outbound.length=0;await request('/api/chat/nvidia',{endpoint:'http://127.0.0.1:9999/audit-mock',model:'fixture/model',messages:[{role:'user',content:'test'}]});const c=outbound[0];assert(c.url.startsWith('http://127.0.0.1')&&c.options.headers.Authorization==='Bearer fixture-server-key');return 'DEFECT mock accepted loopback and received server fixture credential; NO request sent';});
await check('API-selected-model-forwarded',async()=>{outbound.length=0;await request('/api/chat/nvidia',{model:'fixture/chosen-model',messages:[{role:'user',content:'test'}]});assert(JSON.parse(outbound[0].options.body).model==='fixture/chosen-model');return 'model forwarded on normal route';});
await check('API-custom-loopback',async()=>{outbound.length=0;await request('/api/chat/custom',{endpoint:'http://127.0.0.1:9999/audit-mock',model:'fixture',messages:[]});assert(outbound[0].url.startsWith('http://127.0.0.1'));return 'DEFECT no destination restriction (mock only)';});
await check('API-gemma-wrong-provider',async()=>{aiCalls.length=0;await request('/api/chat/gemini',{apiKey:'fixture',model:'google/gemma-4-31b-it',prompt:'test'});assert(aiCalls[0].model==='gemini-2.5-flash');return 'DEFECT Gemma becomes Gemini Flash';});
await check('API-gemini-history-dropped',async()=>{aiCalls.length=0;await request('/api/chat/gemini',{apiKey:'fixture',model:'google/gemini-2.5-pro',messages:[{role:'user',content:'EARLIER_FIXTURE'},{role:'assistant',content:'PREVIOUS_ANSWER'},{role:'user',content:'LAST_FIXTURE'}]});assert(aiCalls[0].contents==='LAST_FIXTURE');return 'DEFECT earlier turns not sent';});
await check('API-NVIDIA-empty-fake-local',async()=>{answer={choices:[]};const r=await request('/api/chat/nvidia',{messages:[{role:'user',content:'test'}]});assert(r.code===200&&r.body.model_used.includes('Local'));return 'DEFECT empty provider output becomes local success';});
await check('API-failed-Gemini-fallback-fake-success',async()=>{aiError=true;const r=await request('/api/chat/nvidia',{geminiApiKey:'fixture',messages:[{role:'user',content:'test'}]});assert(r.code===200&&r.body.choices[0].message.content.includes('sincronizados y operativos'));return 'DEFECT provider failure hidden by canned success';});
let calls=[];let mockData={};let mockStatus=200;
const fetchMock=async(u,o={})=>{calls.push({url:String(u),method:o.method||'GET',body:o.body,headers:o.headers});return {ok:mockStatus<400,status:mockStatus,json:async()=>mockData,text:async()=> 'fixture error'};};
const authMock={getAccessToken:async()=> 'fixture-token'};
const gmail=load('src/services/gmailService.ts',['listGmailMessages','getGmailMessageDetail','sendGmailEmail'],{fetch:fetchMock,...authMock});
const gc=load('src/services/googleCalendarService.ts',['listGoogleCalendarEvents','createGoogleCalendarEvent','deleteGoogleCalendarEvent'],{fetch:fetchMock});
const gd=load('src/services/googleDocsService.ts',['listGoogleDocs','getGoogleDoc','createGoogleDoc','insertTextIntoGoogleDoc'],{fetch:fetchMock});
const gp=load('src/services/googleContactsService.ts',['listGoogleContacts','createGoogleContact','deleteGoogleContact'],{fetch:fetchMock});
await check('Google-Gmail-read-write-mocks',async()=>{calls=[];mockData={messages:[]};await gmail.listGmailMessages();mockData={id:'fixture',payload:{headers:[],body:{data:btoa('fixture')}}};await gmail.getGmailMessageDetail('fixture');await gmail.sendGmailEmail('test@example.invalid','fixture','fixture');assert(calls.some(c=>c.method==='POST'&&c.url.endsWith('/send')));return calls.map(c=>({url:c.url,method:c.method}));});
await check('Google-Calendar-read-write-mocks',async()=>{calls=[];mockData={items:[]};await gc.listGoogleCalendarEvents('fixture');await gc.createGoogleCalendarEvent('fixture',{summary:'fixture',startDateTime:'2026-10-23T10:00:00Z',endDateTime:'2026-10-23T11:00:00Z'});await gc.deleteGoogleCalendarEvent('fixture','fixture');assert(calls.map(c=>c.method).join(',')==='GET,POST,DELETE');return 'GET, POST, DELETE mock contracts';});
await check('Google-Docs-Drive-read-write-mocks',async()=>{calls=[];mockData={files:[],documentId:'fixture',title:'fixture',body:{content:[]}};await gd.listGoogleDocs('fixture');await gd.getGoogleDoc('fixture','fixture');await gd.createGoogleDoc('fixture','fixture','fixture');assert(calls.map(c=>c.method).join(',')==='GET,GET,POST,POST');return 'Drive list + Docs read/create/batchUpdate mocks';});
await check('Google-People-read-write-mocks',async()=>{calls=[];mockData={connections:[],resourceName:'people/fixture'};await gp.listGoogleContacts('fixture');await gp.createGoogleContact('fixture',{givenName:'fixture'});await gp.deleteGoogleContact('fixture','people/fixture');assert(calls.map(c=>c.method).join(',')==='GET,POST,DELETE');return 'GET, POST, DELETE mocks';});
await check('Google-expired-token-no-refresh',async()=>{mockStatus=401;calls=[];let rejected=false;try{await gc.listGoogleCalendarEvents('expired-fixture');}catch{rejected=true;}assert(rejected&&calls.length===1);return '401 thrown; no refresh/retry';});
const types=load('src/types/index.ts',['KOKORO_VOICES']);
await check('voice-six-profiles-present',()=>{for(const id of ['es_mateo','es_sofia','es_camila','es_lucas','es_valeria','es_diego'])assert(types.KOKORO_VOICES.some(v=>v.id===id));return {profiles:types.KOKORO_VOICES.length,languages:[...new Set(types.KOKORO_VOICES.map(v=>v.language))]};});
let recognition;class FakeRecognition {constructor(){recognition=this;}start(){}stop(){}abort(){}}
const speechBase={KOKORO_VOICES:types.KOKORO_VOICES,window:{SpeechRecognition:FakeRecognition,speechSynthesis:{cancel(){},getVoices(){return [];},speak(){},addEventListener(){},removeEventListener(){}}},navigator:{language:'en-US'},setTimeout:()=>0,clearTimeout(){}};
const speech=load('src/utils/speech.ts',['initSpeechRecognition'],speechBase);
await check('STT-English-system-forced-Spanish',async()=>{await speech.initSpeechRecognition({onResult(){},onError(){},onStart(){},onEnd(){}}).start();assert(recognition.lang==='es-ES');return 'DEFECT en-US navigator -> es-ES STT';});
const pending=[];const played=[];const ttsBodies=[];
class FakeAudio {constructor(){this.volume=1;}async play(){played.push(this);}pause(){}}
const speechRace=load('src/utils/speech.ts',['speakKokoro','stopSpeaking'],{...speechBase,navigator:{onLine:false,language:'en-US'},Audio:FakeAudio,fetch:async(u,o)=>{ttsBodies.push(JSON.parse(o.body));return new Promise(resolve=>pending.push(resolve));}});
await check('voice-cancel-pending-fetch-revives-audio',async()=>{const p=speechRace.speakKokoro('fixture','es_mateo',{rateModifier:1.3,pitchModifier:1.2});speechRace.stopSpeaking();pending.shift()({ok:true,json:async()=>({audio:btoa('fixture'),fallback:false})});await p;assert(played.length===1);assert(!('rateModifier' in ttsBodies[0]));return 'DEFECT stopped request later plays; rate/pitch absent from server request; offline still attempts fetch';});
await check('voice-concurrent-fetches-both-play',async()=>{played.length=0;const a=speechRace.speakKokoro('fixture-a');const b=speechRace.speakKokoro('fixture-b');for(const resolve of pending.splice(0))resolve({ok:true,json:async()=>({audio:btoa('fixture'),fallback:false})});await Promise.all([a,b]);assert(played.length===2);return 'DEFECT two stale requests start audio';});
const out={environment:{node:process.version,platform:process.platform,arch:process.arch,tz:Intl.DateTimeFormat().resolvedOptions().timeZone},count:results.length,failed:results.filter(r=>!r.ok).length,results};
console.log(JSON.stringify(out,null,2));
if(out.failed)process.exitCode=1;
```

## Código de la prueba HTTP segura

Guardar como `/tmp/vvc-http-probes.py`; requiere el servidor anterior en 3101 con ambas claves cloud vacías. Ejecutar `python3 /tmp/vvc-http-probes.py`. Sólo crea recursos sintéticos en RAM de esa instancia y tráfico hacia un mock local; no usarlo sobre producción.

```python
import json,threading,urllib.request,pathlib
from http.server import HTTPServer,BaseHTTPRequestHandler
captured=[]
class Mock(BaseHTTPRequestHandler):
 def do_POST(self):
  b=self.rfile.read(int(self.headers.get('Content-Length','0')));captured.append({'path':self.path,'payload':json.loads(b),'dummyAuthorization':self.headers.get('Authorization')=='Bearer fixture-only'})
  self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps({'choices':[{'message':{'content':'fixture response'}}]}).encode())
 def log_message(self,*args):pass
server=HTTPServer(('127.0.0.1',3199),Mock);threading.Thread(target=server.serve_forever,daemon=True).start()
def post(route,data):
 req=urllib.request.Request('http://127.0.0.1:3101'+route,data=json.dumps(data).encode(),headers={'Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=5) as r:return {'status':r.status,'body':json.loads(r.read())}
rows=[]
rows.append({'test':'unauthenticated-nvidia-local-mock','result':post('/api/chat/nvidia',{'endpoint':'http://127.0.0.1:3199/mock','apiKey':'fixture-only','model':'fixture/model','messages':[{'role':'user','content':'fixture'}]})})
rows.append({'test':'unauthenticated-custom-local-mock','result':post('/api/chat/custom',{'endpoint':'http://127.0.0.1:3199/mock','model':'fixture/custom','messages':[{'role':'user','content':'fixture'}]})})
rows.append({'test':'forcePriority-HTTP','result':post('/api/vaos/dispatch',{'command':'formatear bóveda de prueba','forcePriority':'P2_LOW'})})
rows.append({'test':'no-key-async-HTTP','result':post('/api/vaos/dispatch',{'command':'crear documento de prueba audit','agentId':'audit-fixture'})})
with urllib.request.urlopen('http://127.0.0.1:3101/api/vaos/tasks') as r:rows.append({'test':'anonymous-task-list','result':json.loads(r.read())})
server.shutdown();out={'rows':rows,'mockRequests':captured};pathlib.Path('/tmp/vvc-audit-logs/http-probes.json').write_text(json.dumps(out,indent=2));print(json.dumps(out,indent=2))
```

## Código de navegador

Instalar herramienta aislada: `npm install --prefix /tmp/vvc-browser --no-save --no-package-lock playwright-core@1.64.1`. Requiere Chromium local en `/usr/bin/chromium`, servidor anterior en 3101 y permisos de sockets. Guardar como `/tmp/vvc-browser-probes.cjs`, ejecutar `node /tmp/vvc-browser-probes.cjs`. Crea localStorage sintético, intercepta inferencia/TTS y aborta hosts externos; no simula que los proveedores remotos funcionen. Salida JSON y captura se guardan en `/tmp/vvc-audit-logs`; crear ese directorio antes. No se incluyó la captura como dato del usuario.

```javascript
const {chromium}=require('/tmp/vvc-browser/node_modules/playwright-core');
const fs=require('fs');
(async()=>{
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1365,height:900}});
const external=new Set(),errors=[],requests=[];
await context.route('**/*',async r=>{const u=new URL(r.request().url());if(u.hostname!=='127.0.0.1'){external.add(u.hostname);return r.abort();}if(u.pathname==='/api/tts')return r.fulfill({json:{fallback:true}});if(u.pathname.startsWith('/api/chat/')){requests.push({path:u.pathname,model:r.request().postDataJSON().model,command:r.request().postDataJSON().command});return r.fulfill({json:{choices:[{message:{content:'fixture response'}}],model_used:'fixture/mock'}});}if(u.pathname==='/api/vaos/dispatch'){requests.push({path:u.pathname,model:r.request().postDataJSON().model,command:r.request().postDataJSON().command});return r.fulfill({json:{route:'FAST_PATH',priority:'P2_LOW',policyApproved:true,immediateResponse:{text:'fixture'}}});}return r.continue();});
await context.addInitScript(()=>{speechSynthesis.speak=()=>{};speechSynthesis.cancel=()=>{};});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message.replace(/AIza[\w-]+/g,'[REDACTED]')));
await page.goto('http://127.0.0.1:3101/',{waitUntil:'networkidle'});
const desktop=await page.evaluate(()=>({title:document.title,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,selects:[...document.querySelectorAll('select')].map(s=>({title:s.title,value:s.value,values:[...s.options].map(o=>o.value)})),inputs:[...document.querySelectorAll('input,textarea')].map(s=>({tag:s.tagName,placeholder:s.placeholder})),unnamedButtons:[...document.querySelectorAll('button')].filter(b=>!b.innerText.trim()&&!b.getAttribute('aria-label')&&!b.getAttribute('title')).length}));
const nvidia=page.locator('select[title="Lista desplegable de modelos LLM NVIDIA"]');
const chosen='qwen/qwen2.5-coder-32b-instruct';await nvidia.selectOption(chosen);
const modelBeforeReload=await page.evaluate(()=>localStorage.getItem('vvc_liam_model'));
await page.reload({waitUntil:'networkidle'});
const selectedAfterReload=await nvidia.inputValue();
await page.evaluate(()=>localStorage.setItem('vvc_secret_nvidia_api_key','fixture-only'));
await nvidia.selectOption(chosen);
const input=page.locator('input[placeholder^="Escribe o dicta"]');
await input.fill('Analiza una vulnerabilidad en un protocolo');await input.press('Enter');
await page.waitForFunction(()=>document.body.innerText.includes('fixture response'));
const cloudRequests=requests.slice();requests.length=0;
await input.fill('crear tarea fixture audit para mañana a las 18:00');await input.press('Enter');
await page.waitForFunction(()=>JSON.parse(localStorage.getItem('vvc_liam_tasks')||'[]').some(t=>t.title==='fixture audit'));
const taskCreated=await page.evaluate(()=>JSON.parse(localStorage.getItem('vvc_liam_tasks')).some(t=>t.title==='fixture audit'));
await input.fill('abrir agentes');await input.press('Enter');
await page.waitForFunction(()=>document.body.innerText.includes('Vladimir'));
const agentsModal=await page.evaluate(()=>({dialogs:document.querySelectorAll('[role="dialog"]').length,ariaModals:document.querySelectorAll('[aria-modal="true"]').length,unnamedButtons:[...document.querySelectorAll('button')].filter(b=>!b.innerText.trim()&&!b.getAttribute('aria-label')&&!b.getAttribute('title')).length}));

await page.setViewportSize({width:390,height:844});
const mobile=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth}));
await page.screenshot({path:'/tmp/vvc-audit-logs/mobile.png',fullPage:true});
const sw=await page.evaluate(async()=>{const reg=await navigator.serviceWorker.ready;return {active:reg.active?.scriptURL,controlled:!!navigator.serviceWorker.controller,caches:await caches.keys()};});
await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'}).catch(()=>{});
const offline=await page.evaluate(()=>({appLoaded:document.querySelector('#root')?.childElementCount>0,title:document.title,textLength:document.body.innerText.length}));
await context.setOffline(false);
fs.writeFileSync('/tmp/vvc-audit-logs/browser.json',JSON.stringify({browser:browser.version(),desktop,modelPersistence:{chosen,modelBeforeReload,selectedAfterReload},cloudRequests,taskCreated,agentsModal,mobile,sw,offline,externalHostsBlocked:[...external],errors,requests},null,2));
await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
```

## Reinicio real del servidor

Se levantó una tercera instancia aislada en 3103 con claves cloud vacías, se creó una tarea sintética, se terminó el proceso y se volvió a levantar en el mismo puerto. Resultado: 1 tarea antes, 0 después. No se recuperó la tarea. Reproducción: guardar este script en /tmp, adaptar root al checkout, crear /tmp/vvc-audit-logs y ejecutar con Python3 y sockets locales habilitados.

```python
import os,subprocess,time,json,urllib.request,pathlib
root='/workspace/VVC-LIAM-CORE-git';base='http://127.0.0.1:3103';env=dict(os.environ,NODE_ENV='production',PORT='3103',GEMINI_API_KEY='',NVIDIA_API_KEY='')
log=open('/tmp/vvc-audit-logs/restart-server.log','w')
def get(route):
 with urllib.request.urlopen(base+route,timeout=1) as r:return json.load(r)
def start():
 p=subprocess.Popen(['node','server.ts'],cwd=root,env=env,stdout=log,stderr=log)
 for _ in range(100):
  if p.poll() is not None:raise RuntimeError('server exited')
  try:get('/api/vaos/health');return p
  except Exception:time.sleep(.05)
 p.terminate();p.wait(timeout=5);raise RuntimeError('startup timeout')
def stop(p):p.terminate();p.wait(timeout=5)
p=None
try:
 p=start();req=urllib.request.Request(base+'/api/vaos/dispatch',data=json.dumps({'command':'crear documento fixture restart','agentId':'audit-fixture'}).encode(),headers={'Content-Type':'application/json'})
 with urllib.request.urlopen(req) as r:json.load(r)
 before=len(get('/api/vaos/tasks'));stop(p);p=None
 p=start();after=len(get('/api/vaos/tasks'));assert before==1 and after==0
 out={'taskCountBeforeRestart':before,'taskCountAfterRestart':after,'cloudKeysEmpty':True}
 pathlib.Path('/tmp/vvc-audit-logs/restart.json').write_text(json.dumps(out,indent=2));print(json.dumps(out))
finally:
 if p is not None:stop(p)
 log.close()
```
