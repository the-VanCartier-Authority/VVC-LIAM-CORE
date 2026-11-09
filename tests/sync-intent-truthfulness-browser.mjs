// Actual App/parser text, voice dispatch and tone routing. Synthetic boundaries only.
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


stubs.googleCalendarService = `const forbidden = async () => { window.externalSyncCalls++; throw Error('external sync prohibited'); };
  export const listGoogleCalendarEvents=forbidden,createGoogleCalendarEvent=forbidden,deleteGoogleCalendarEvent=forbidden;`;
const bundle = await build({ stdin: { contents: `
  import React from 'react'; import { createRoot } from 'react-dom/client'; import App from './src/App';
  import { parseNaturalVoiceCommand } from './src/utils/rtLiteEngine';
  window.fixtureCalls=[]; window.fixtureSpeech=[]; window.fixtureTones=[]; window.externalSyncCalls=0;
  window.syncIntentParser=parseNaturalVoiceCommand;
  createRoot(document.getElementById('root')).render(React.createElement(App));
`, resolveDir: process.cwd() }, bundle: true, write: false, platform: 'browser', format: 'esm',
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{}' }, plugins: [{ name: 'synthetic-boundaries', setup(b) {
    b.onResolve({ filter: /\/(googleAuth|firestoreSyncService|backendApi|speech|googleCalendarService)$/ }, args => ({ path: args.path.split('/').at(-1), namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: stubs[args.path], loader: 'js' }));
  } }] });
const server=createServer((_req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><div id="root"></div><script type="module">'+bundle.outputFiles[0].text+'</script>');});
const unavailable='No se realizó ninguna sincronización externa. Esta función todavía no está disponible.';
const violations=[];let browser,cases=0,externalCompleted=0;
try {
  server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||chromium.executablePath(),headless:true,
    proxy:{server:'http://127.0.0.1:9',bypass:'127.0.0.1'},args:['--no-sandbox','--disable-background-networking']});
  for(const identity of ['synthetic-a','synthetic-b']){
    const context=await browser.newContext({serviceWorkers:'block'});
    await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort('blockedbyclient'));
    context.on('requestfinished',r=>{if(new URL(r.url()).origin!==base)externalCompleted++;});
    await context.addInitScript(identity=>{
      const effects=window.notificationEffects={permission:0,subscribe:0,native:0,show:0,messages:0};const Original=window.Notification;
      window.Notification=class extends Original{constructor(...args){effects.native++;super(...args);}static requestPermission(){effects.permission++;return Promise.resolve('granted');}static get permission(){return 'granted';}};
      PushManager.prototype.subscribe=async()=>{effects.subscribe++;return {};};ServiceWorkerRegistration.prototype.showNotification=async()=>{effects.show++;};
      const post=ServiceWorker.prototype.postMessage;ServiceWorker.prototype.postMessage=function(data,...rest){if(['SHOW_BACKGROUND_NOTIFICATION','SCHEDULE_BACKGROUND_NOTIFICATION'].includes(data?.type))effects.messages++;return post.call(this,data,...rest);};
      localStorage.clear();localStorage.setItem('vvc_liam_model','rt-lite-local');
      const legacy={id:'legacy-'+identity,title:'Keep existing '+identity,dueDate:'2030-01-15',timeDue:'09:25',priority:'alta',category:'trabajo',recurrence:'weekly',
        isCompleted:false,subtasks:[{id:'s1',title:'Keep subtask',completed:false}],syncedToThirdParty:{googleCalendar:true,notion:true,todoist:true,slackWebhook:true},createdAt:1,updatedAt:2};
      localStorage.setItem('vvc_liam_tasks',JSON.stringify([legacy]));localStorage.setItem('legacy-snapshot',JSON.stringify(legacy));
      localStorage.setItem('vvc_liam_events',JSON.stringify([{id:'event-existing',title:'Keep local calendar',date:'2030-01-15',time:'11:00',category:'personal'}]));
      for(const key of ['contacts','chat_history'])localStorage.setItem('vvc_liam_'+key,'[]');
      localStorage.setItem('vvc_liam_push_active','legacy-record');
    },identity);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/?identity='+identity);const input=page.getByPlaceholder(/^Escribe o dicta un comando/);await input.waitFor();
    const initial=await page.evaluate(()=>({tasks:localStorage.getItem('vvc_liam_tasks'),events:localStorage.getItem('vvc_liam_events')}));
    for(const command of ['sincronizar tareas','sincronizar calendario','sincronizar con notion','sync google']){
      const before=await page.evaluate(()=>({tones:window.fixtureTones.length,history:JSON.parse(localStorage.getItem('vvc_liam_chat_history')||'[]').filter(m=>m.sender==='assistant').length}));
      await input.fill(command);await input.press('Enter');
      await page.waitForFunction(count=>JSON.parse(localStorage.getItem('vvc_liam_chat_history')||'[]').filter(m=>m.sender==='assistant').length===count+1,before.history);
      const result=await page.evaluate(({command,toneCount})=>({
        parsed:window.syncIntentParser(command,{},[],[],[]),answer:JSON.parse(localStorage.getItem('vvc_liam_chat_history')).filter(m=>m.sender==='assistant').at(-1),
        voice:window.fixtureSpeech.at(-1),tones:window.fixtureTones.slice(toneCount),tasks:localStorage.getItem('vvc_liam_tasks'),events:localStorage.getItem('vvc_liam_events'),
        effects:window.notificationEffects,external:window.externalSyncCalls,calls:window.fixtureCalls,
      }),{command,toneCount:before.tones});
      assert.equal(result.parsed.isHandled,true);assert.equal(result.parsed.actionType,'sync');
      assert.equal(result.answer.text,result.parsed.spokenResponse);assert.equal(result.voice,result.answer.text);
      assert.equal(result.answer.actionDetails,result.parsed.actionDetails);
      await page.getByText(result.answer.text,{exact:true}).last().waitFor();
      assert.equal(result.tasks,initial.tasks);assert.equal(result.events,initial.events);
      assert.deepEqual(result.effects,{permission:0,subscribe:0,native:0,show:0,messages:0});assert.equal(result.external,0);
      assert.equal(result.calls.filter(c=>/^\/api\/(chat|push|vaos)\//.test(c.path)).length,0);
      const truthful=result.answer.text===unavailable&&!/completad|sincronizad|en vivo|Google Calendar|Notion/i.test(result.answer.actionDetails);
      console.log(JSON.stringify({identity,command,response:result.answer.text,actionDetails:result.answer.actionDetails,tones:result.tones,truthful,
        unchangedTasks:true,unchangedCalendar:true,externalCalls:result.external,effects:result.effects}));
      if(!truthful)violations.push(identity+': '+command+' falsely claims completed sync');
      if(result.tones.length)violations.push(identity+': '+command+' emits success tones');
      if(result.parsed.triggerThirdPartySync)violations.push(identity+': '+command+' enables inert sync trigger');
      cases++;
    }
    const priorTones=await page.evaluate(()=>window.fixtureTones.length);
    await input.fill('Crear tarea urgente control local a las 14:35 diario');await input.press('Enter');
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('vvc_liam_tasks')).some(t=>t.title==='control local'));
    const control=await page.evaluate(count=>({tasks:JSON.parse(localStorage.getItem('vvc_liam_tasks')),old:JSON.parse(localStorage.getItem('legacy-snapshot')),
      tones:window.fixtureTones.slice(count),voice:window.fixtureSpeech.at(-1),effects:window.notificationEffects,permission:localStorage.getItem('vvc_liam_push_active')}),priorTones);
    const task=control.tasks.find(t=>t.title==='control local');assert.equal(task.priority,'critica');assert.equal(task.timeDue,'14:35');assert.equal(task.recurrence,'daily');assert.deepEqual(task.subtasks,[]);
    assert.ok(Object.values(task.syncedToThirdParty).every(v=>v===false));assert.deepEqual(control.tasks.find(t=>t.id===control.old.id),control.old);
    assert.deepEqual(control.tones,['confirm']);assert.match(control.voice,/notificaciones push y locales están deshabilitadas/i);
    assert.deepEqual(control.effects,{permission:0,subscribe:0,native:0,show:0,messages:0});assert.equal(control.permission,'legacy-record');assert.deepEqual(errors,[]);cases++;
    await context.close();
  }
  assert.equal(externalCompleted,0);assert.deepEqual(violations,[]);
  console.log(JSON.stringify({fixture:'G02 unavailable sync commands',result:'PASS',cases,identities:2,browser:browser.version(),realExternalCalls:externalCompleted,realSpeechProviderCalls:0}));
}finally{await browser?.close();if(server.listening){server.closeAllConnections();await new Promise(r=>server.close(r));}}
