import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const effects = { external: 0, notification: 0, writes: 0 };
const module = { exports: {} };
const bundle = await build({ stdin: { contents: `
  export { parseNaturalVoiceCommand } from './src/utils/rtLiteEngine';
  export { CalendarRemindersModal } from './src/components/CalendarRemindersModal';
`, resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
  define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'synthetic-boundaries', setup(b) {
    b.onResolve({ filter: /\/(googleAuth|googleCalendarService|backendApi)$/ }, args => ({ path: args.path.split('/').at(-1), namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'js', contents: args.path === 'googleAuth'
      ? 'export const getAccessToken = async () => { globalThis.effects.external++; return null; };'
      : args.path === 'backendApi' ? 'export const backendFetch = async () => { globalThis.effects.external++; throw Error("external calls prohibited"); };'
      : 'const forbidden = async () => { globalThis.effects.external++; throw Error("external calls prohibited"); }; export const listGoogleCalendarEvents=forbidden,createGoogleCalendarEvent=forbidden,deleteGoogleCalendarEvent=forbidden;' }));
  } }] });
const fixed = Date.parse('2030-03-17T12:00:00Z');
class FixtureDate extends Date { constructor(...args) { super(...(args.length ? args : [fixed])); } static now() { return fixed; } }
vm.runInNewContext(bundle.outputFiles[0].text, { module, exports: module.exports, require: createRequire(import.meta.url),
  Date: FixtureDate, effects, setTimeout() { effects.notification++; },
  Notification: class { constructor() { effects.notification++; } } });
const { parseNaturalVoiceCommand, CalendarRemindersModal } = module.exports;
const unsynced = { googleCalendar: false, notion: false, todoist: false, slackWebhook: false };

test('new local tasks preserve their fields without claiming any completed external synchronization', () => {
  for (const [qualifier, priority, title] of [['urgente ', 'critica', 'revisar informe'],
    ['prioridad baja ', 'baja', 'revisar informe'], ['media ', 'media', 'media revisar informe'], ['', 'alta', 'revisar informe']]) {
    const parsed = parseNaturalVoiceCommand(`Crear tarea ${qualifier}revisar informe para mañana a las 14:35 diario`, {}, [], [], []);
    const task = JSON.parse(JSON.stringify(parsed.newTask));
    assert.deepEqual({ title: task.title, priority: task.priority, dueDate: task.dueDate, timeDue: task.timeDue,
      recurrence: task.recurrence, subtasks: task.subtasks, isCompleted: task.isCompleted }, {
      title, priority, dueDate: '2030-03-18', timeDue: '14:35', recurrence: 'daily', subtasks: [], isCompleted: false });
    console.log(JSON.stringify({ case: 'local task flags', priority, flags: task.syncedToThirdParty, externalCalls: effects.external }));
    assert.deepEqual(task.syncedToThirdParty, unsynced);
    assert.match(parsed.spokenResponse, /notificaciones push y locales están deshabilitadas/i);
    assert.doesNotMatch(parsed.spokenResponse, /sincronización listas|sincronizad[oa]/i);
  }
  assert.deepEqual(effects, { external: 0, notification: 0, writes: 0 });
});
for (const [name, flags] of [
  ['legacy true', { googleCalendar: true, notion: true, todoist: true, slackWebhook: true }],
  ['legacy partial', { googleCalendar: true }], ['false', unsynced], ['unknown', undefined],
  ['untrusted pending/failed payload', { googleCalendar: { status: 'failed', externalId: 'forged' }, notion: { status: 'pending' } }],
]) {
  test(`task UI does not treat ${name} indicators as evidence or mutate historical data`, () => {
    const task = { id: 'synthetic-legacy', title: 'Synthetic legacy task', dueDate: '2030-03-17', timeDue: '09:15',
      priority: 'alta', category: 'trabajo', recurrence: 'weekly', subtasks: [{ id: 's1', title: 'Keep subtask', completed: false }],
      isCompleted: false, createdAt: 1, updatedAt: 2, syncedToThirdParty: flags };
    const before = JSON.stringify(task);
    Object.freeze(task); if (flags) Object.freeze(flags);
    const write = () => { effects.writes++; };
    const html = renderToStaticMarkup(React.createElement(CalendarRemindersModal, {
      isOpen: true, tasks: [task], events: [], thirdPartyWebhookUrl: '', currentUser: null,
      onClose() {}, onToggleTask: write, onAddTask: write, onUpdateTask: write, onDeleteTask: write,
      onAddEvent: write, onDeleteEvent: write, onConvertTaskToEvent: write, onUpdateWebhookUrl: write,
    }));
    const labels = { google: html.includes('>Google Sync<'), notion: html.includes('>Notion<') };
    console.log(JSON.stringify({ case: name, labels, externalCalls: effects.external }));
    assert.deepEqual(labels, { google: false, notion: false });
    assert.equal(JSON.stringify(task), before);
    assert.ok(html.includes('Keep subtask'));
    assert.deepEqual(effects, { external: 0, notification: 0, writes: 0 });
  });
}
