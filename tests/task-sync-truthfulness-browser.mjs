// Real App/parser/Calendar UI. All external boundaries synthetic; no live sync or push.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
const stubs = {
  googleAuth: `
    const user = { uid: new URL(location.href).searchParams.get('identity') || 'synthetic-a', email: 'fixture@example.test', displayName: 'Fixture', getIdToken: async () => 'synthetic-id' };
    export const auth = { currentUser: user }, db = {}, WORKSPACE_SCOPES = [];
    export const initAuth = callback => { queueMicrotask(() => callback?.(user, 'synthetic-oauth')); return () => {}; };
    export const googleSignIn = async () => ({ user, accessToken: 'synthetic-oauth' });
    export const googleSignOut = async () => {}, setCachedAccessToken = () => {};
    export const getAccessToken = async () => 'synthetic-oauth', testFirestoreConnection = async () => {};`,
  firestoreSyncService: `
    export const syncUserProfileToFirestore = async () => {}, saveTaskToFirestore = async () => {}, deleteTaskFromFirestore = async () => {},
      saveEventToFirestore = async () => {}, deleteEventFromFirestore = async () => {};
    export const subscribeToUserTasks = () => () => {}, subscribeToUserEvents = () => () => {};`,
  speech: `
    export const playCyberTone = tone => window.fixtureTones.push(tone), stopSpeaking = () => {}, stopMicrophoneAnalyzer = () => {};
    export const speakKokoro = async (text, _voice, options) => { window.fixtureSpeech.push(text); options?.onEnd?.(); };
    export const setupMicrophoneAnalyzer = async () => null, getAudioContext = () => null;
    export const initSpeechRecognition = () => ({ start() {}, stop() {}, abort() {}, isSupported: false });`,
  backendApi: `
    export const backendFetch = async (input, init = {}) => {
      const path = new URL(input, location.origin).pathname;
      window.fixtureCalls.push({ path, method: init.method || 'GET' });
      if (path.startsWith('/api/push/')) return Response.json({ success: false, code: 'PUSH_DISABLED', realExecution: false }, { status: 503 });
      return Response.json({});
    };`,
};


stubs.googleCalendarService = `const forbidden = async () => { window.syncExternalCalls++; throw Error('external synchronization prohibited'); };
  export const listGoogleCalendarEvents=forbidden,createGoogleCalendarEvent=forbidden,deleteGoogleCalendarEvent=forbidden;`;
const bundle = await build({ stdin: { contents: `
  import React from 'react'; import { createRoot } from 'react-dom/client'; import App from './src/App';
  import { parseNaturalVoiceCommand } from './src/utils/rtLiteEngine';
  window.fixtureCalls=[]; window.fixtureSpeech=[]; window.fixtureTones=[]; window.syncExternalCalls=0;
  window.syncParser=parseNaturalVoiceCommand;
  createRoot(document.getElementById('root')).render(React.createElement(App));
`, resolveDir: process.cwd() }, bundle: true, write: false, platform: 'browser', format: 'esm',
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{}' }, plugins: [{ name: 'synthetic-boundaries', setup(b) {
    b.onResolve({ filter: /\/(googleAuth|firestoreSyncService|backendApi|speech|googleCalendarService)$/ }, args => ({ path: args.path.split('/').at(-1), namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: stubs[args.path], loader: 'js' }));
  } }] });
const server=createServer((_req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><div id="root"></div><script type="module">'+bundle.outputFiles[0].text+'</script>');});
const zero={ permission:0,subscribe:0,native:0,show:0,messages:0 };
const noSync={googleCalendar:false,notion:false,todoist:false,slackWebhook:false};
let browser,cases=0,externalCompleted=0;
const violations=[];
function check(condition,label) { if(!condition) violations.push(label); }
try {
  server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||chromium.executablePath(),headless:true,
    proxy:{server:'http://127.0.0.1:9',bypass:'127.0.0.1'},args:['--no-sandbox','--disable-background-networking']});
  async function contextFor(identity,seed=true) {
    const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1000}});
    await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort('blockedbyclient'));
    context.on('requestfinished',r=>{if(new URL(r.url()).origin!==base)externalCompleted++;});
    await context.addInitScript(({identity,seed})=>{
      window.notificationEffects={permission:0,subscribe:0,native:0,show:0,messages:0};const e=window.notificationEffects,Original=window.Notification;
      window.Notification=class extends Original {constructor(...args){e.native++;super(...args);}static requestPermission(){e.permission++;return Promise.resolve('granted');}static get permission(){return 'granted';}};
      PushManager.prototype.subscribe=async()=>{e.subscribe++;return {};};ServiceWorkerRegistration.prototype.showNotification=async()=>{e.show++;};
      const post=ServiceWorker.prototype.postMessage;ServiceWorker.prototype.postMessage=function(data,...rest){if(['SHOW_BACKGROUND_NOTIFICATION','SCHEDULE_BACKGROUND_NOTIFICATION'].includes(data?.type))e.messages++;return post.call(this,data,...rest);};
      if(!sessionStorage.getItem('sync-fixture-seeded')){
        localStorage.clear();localStorage.setItem('vvc_liam_model','rt-lite-local');
        for(const n of ['events','contacts','chat_history'])localStorage.setItem('vvc_liam_'+n,'[]');
        if(seed){const legacy={id:'legacy-'+identity,title:'Legacy '+identity,description:'Preserve historical data',dueDate:'2030-03-17',timeDue:'09:15',
          priority:'media',category:'trabajo',isCompleted:false,recurrence:'weekly',subtasks:[{id:'sub-old',title:'Keep historical subtask',completed:false}],createdAt:1,updatedAt:2,
          syncedToThirdParty:{googleCalendar:true,notion:true,todoist:true,slackWebhook:true},syncEvidence:{status:'verified',externalId:'forged-client-data'}};
          localStorage.setItem('vvc_liam_tasks',JSON.stringify([legacy]));localStorage.setItem('legacy-snapshot',JSON.stringify(legacy));}
        localStorage.setItem('vvc_liam_push_active','legacy-permission-record');sessionStorage.setItem('sync-fixture-seeded','yes');
      }
    },{identity,seed});return context;
  }
  for(const identity of ['synthetic-a','synthetic-b']){
    const context=await contextFor(identity),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/?identity='+identity);
    const input=page.getByPlaceholder(/^Escribe o dicta un comando/);await input.waitFor();
    const command='Crear tarea urgente revisar informe para mañana a las 14:35 diario';
    await input.fill(command);await input.press('Enter');
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('vvc_liam_tasks')||'[]').some(t=>t.title==='revisar informe'));
    const created=await page.evaluate(()=>({task:JSON.parse(localStorage.getItem('vvc_liam_tasks')).find(t=>t.title==='revisar informe'),
      parsed:window.syncParser('Crear tarea urgente revisar informe para mañana a las 14:35 diario',{},[],[],[]),
      text:JSON.parse(localStorage.getItem('vvc_liam_chat_history')).filter(m=>m.sender==='assistant').at(-1).text,voice:window.fixtureSpeech.at(-1)}));
    assert.equal(created.text,created.parsed.spokenResponse);assert.equal(created.voice,created.text);
    await page.getByText(created.text,{exact:true}).waitFor();
    assert.match(created.text,/notificaciones push y locales están deshabilitadas/i);assert.doesNotMatch(created.text,/sincronización listas/i);
    for(const key of ['title','dueDate','timeDue','priority','category','recurrence','subtasks','isCompleted'])assert.deepEqual(created.task[key],created.parsed.newTask[key]);
    check(JSON.stringify(created.task.syncedToThirdParty)===JSON.stringify(noSync),identity+': local parser flags');
    console.log(JSON.stringify({identity,case:'parser task text/voice',flags:created.task.syncedToThirdParty}));cases++;
    await page.getByRole('button',{name:/^Agenda & Tareas/}).click();
    // Inspect only task badge labels, not provider names in form/configuration.
    const badges={google:await page.getByText('Google Sync',{exact:true}).count(),notion:await page.getByText('Notion',{exact:true}).count()};
    console.log(JSON.stringify({identity,case:'new and legacy task badges',badges}));check(badges.google===0&&badges.notion===0,identity+': task success badges without evidence');
    await page.getByText('Legacy '+identity,{exact:true}).waitFor();await page.getByText('Keep historical subtask',{exact:true}).waitFor();cases++;
    const form=page.locator('form').filter({has:page.getByPlaceholder('Título de la tarea o recordatorio...')});
    await form.getByPlaceholder('Título de la tarea o recordatorio...').fill('Form local '+identity);
    await form.locator('input[type=date]').fill('2030-04-22');await form.locator('input[type=time]').fill('16:40');
    await form.locator('select').nth(0).selectOption('baja');await form.locator('select').nth(1).selectOption('personal');await form.locator('select').nth(2).selectOption('weekly');
    await form.getByPlaceholder(/Añadir subtarea opcional/).fill('Form subtask');await form.getByRole('button',{name:'+ Subtarea',exact:true}).click();
    await form.locator('input[type=checkbox]').nth(0).check();await form.locator('input[type=checkbox]').nth(1).check();
    await form.locator('button[type=submit]').click();
    await page.waitForFunction(title=>JSON.parse(localStorage.getItem('vvc_liam_tasks')).some(t=>t.title===title),'Form local '+identity);
    const task=await page.evaluate(title=>JSON.parse(localStorage.getItem('vvc_liam_tasks')).find(t=>t.title===title),'Form local '+identity);
    assert.deepEqual({title:task.title,dueDate:task.dueDate,timeDue:task.timeDue,priority:task.priority,category:task.category,recurrence:task.recurrence,isCompleted:task.isCompleted},
      {title:'Form local '+identity,dueDate:'2030-04-22',timeDue:'16:40',priority:'baja',category:'personal',recurrence:'weekly',isCompleted:false});
    assert.equal(task.subtasks[0].title,'Form subtask');assert.equal(task.subtasks[0].completed,false);assert.ok(task.subtasks[0].id);assert.deepEqual(task.syncedToThirdParty,noSync);cases++;
    await page.reload();await page.getByRole('button',{name:/^Agenda & Tareas/}).click();
    const state=await page.evaluate(()=>({legacy:JSON.parse(localStorage.getItem('vvc_liam_tasks')).find(t=>t.id.startsWith('legacy-')),
      snapshot:JSON.parse(localStorage.getItem('legacy-snapshot')),effects:window.notificationEffects,external:window.syncExternalCalls,
      calls:window.fixtureCalls,permission:localStorage.getItem('vvc_liam_push_active')}));
    assert.deepEqual(state.legacy,state.snapshot);assert.deepEqual(state.effects,zero);assert.equal(state.external,0);
    assert.equal(state.calls.filter(c=>c.path.startsWith('/api/push/')).length,0);assert.equal(state.permission,'legacy-permission-record');assert.deepEqual(errors,[]);
    check(await page.getByText('Google Sync',{exact:true}).count()===0&&await page.getByText('Notion',{exact:true}).count()===0,identity+': reload must not trust legacy flags');
    console.log(JSON.stringify({identity,case:'legacy preserved after reload',unchanged:true,effects:state.effects,externalCalls:state.external}));cases++;
    await context.close();
  }
  const context=await contextFor('fresh-install',false),page=await context.newPage();await page.goto(base+'/?identity=fresh-install');
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('vvc_liam_tasks')||'[]').length===3);
  const defaults=await page.evaluate(()=>JSON.parse(localStorage.getItem('vvc_liam_tasks')));
  console.log(JSON.stringify({case:'fresh local defaults',flags:defaults.map(t=>t.syncedToThirdParty)}));
  check(defaults.every(t=>Object.values(t.syncedToThirdParty||{}).every(v=>v===false)),'fresh defaults assert synchronization');cases++;await context.close();
  assert.equal(externalCompleted,0);assert.deepEqual(violations,[]);
  console.log(JSON.stringify({fixture:'G02 conservative task sync',result:'PASS',cases,identities:2,browser:browser.version(),realExternalCalls:externalCompleted}));
}finally{await browser?.close();if(server.listening){server.closeAllConnections();await new Promise(r=>server.close(r));}}
