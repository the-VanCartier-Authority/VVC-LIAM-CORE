import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/utils/rtLiteEngine.ts'], bundle: true, write: false, format: 'cjs', platform: 'node' });
const effects = { external: 0, notifications: 0, messages: 0 };
const module = { exports: {} };
vm.runInNewContext(bundle.outputFiles[0].text, { module, exports: module.exports,
  fetch() { effects.external++; throw Error('external requests prohibited'); },
  Notification: class { constructor() { effects.notifications++; } },
  setTimeout() { effects.notifications++; }, setInterval() { effects.notifications++; },
  navigator: { serviceWorker: { controller: { postMessage() { effects.messages++; } } } },
});
const { parseNaturalVoiceCommand } = module.exports;
const message = 'No se realizó ninguna sincronización externa. Esta función todavía no está disponible.';
const tasks = [{ id: 'synthetic-legacy', title: 'Keep existing task', dueDate: '2030-01-15', timeDue: '09:25',
  priority: 'alta', category: 'trabajo', recurrence: 'weekly', isCompleted: false,
  subtasks: [{ id: 's1', title: 'Keep subtask', completed: false }],
  syncedToThirdParty: { googleCalendar: true, notion: true, todoist: true, slackWebhook: true },
  createdAt: 1, updatedAt: 2 }];
const events = [{ id: 'event-existing', title: 'Keep local calendar', date: '2030-01-15', time: '11:00' }];
function freeze(value) { for (const v of Object.values(value)) if (v && typeof v === 'object') freeze(v); return Object.freeze(value); }
freeze(tasks); freeze(events);
for (const command of ['sincronizar tareas', 'sincronizar calendario', 'sincronizar con notion', 'sync google']) {
  test(`${command}: recognizes unavailability without success, action triggers or data changes`, () => {
    const before = JSON.stringify({ tasks, events });
    const result = parseNaturalVoiceCommand(command, {}, [], tasks, events);
    console.log(JSON.stringify({ command, isHandled: result.isHandled, response: result.spokenResponse,
      actionDetails: result.actionDetails, triggerThirdPartySync: result.triggerThirdPartySync ?? null,
      outcome: result.outcome ?? null, effects }));
    assert.equal(result.isHandled, true); assert.equal(result.actionType, 'sync');
    assert.equal(result.spokenResponse, message);
    assert.doesNotMatch(result.actionDetails, /completad|sincronizad|en vivo|Google Calendar|Notion/i);
    assert.equal(result.outcome?.status, 'unavailable'); assert.equal(result.outcome?.realExecution, false);
    for (const flag of ['triggerThirdPartySync','triggerCalendarSync','triggerICalExport','newTask','newCalendarEvent',
      'eventsToUpdate','taskToModify','taskToCompleteId','taskToDeleteId','triggerPushTest']) assert.ok(!result[flag], flag);
    assert.equal(JSON.stringify({ tasks, events }), before);
    assert.deepEqual(effects, { external: 0, notifications: 0, messages: 0 });
  });
}
test('local task creation and ICS generation retain their distinct actions', () => {
  const task = parseNaturalVoiceCommand('Crear tarea urgente control local a las 14:35 diario', {}, [], tasks, events);
  assert.equal(task.isHandled, true); assert.equal(task.actionType, 'task'); assert.equal(task.newTask.title, 'control local');
  assert.equal(task.newTask.priority, 'critica'); assert.equal(task.newTask.recurrence, 'daily');
  assert.equal(task.outcome, undefined); assert.ok(Object.values(task.newTask.syncedToThirdParty).every(v => v === false));
  const exported = parseNaturalVoiceCommand('descargar ics', {}, [], tasks, events);
  assert.equal(exported.triggerICalExport, true); assert.equal(exported.outcome, undefined);
  assert.deepEqual(effects, { external: 0, notifications: 0, messages: 0 });
});
