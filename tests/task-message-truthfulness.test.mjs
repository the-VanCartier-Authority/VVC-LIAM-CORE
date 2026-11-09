import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { build } from 'esbuild';

const fixed = Date.parse('2030-03-17T12:00:00Z');
class FixtureDate extends Date {
  constructor(...args) { super(...(args.length ? args : [fixed])); }
  static now() { return fixed; }
}
const result = await build({ entryPoints: ['src/utils/rtLiteEngine.ts'], bundle: true, write: false, format: 'cjs', platform: 'node' });
const effects = { timers: 0, native: 0, show: 0, subscribe: 0, messages: 0 };
const module = { exports: {} };
vm.runInNewContext(result.outputFiles[0].text, { module, exports: module.exports, Date: FixtureDate,
  setTimeout() { effects.timers++; }, setInterval() { effects.timers++; },
  Notification: class { constructor() { effects.native++; } },
  navigator: { serviceWorker: { controller: { postMessage() { effects.messages++; } },
    getRegistration: async () => ({ showNotification() { effects.show++; }, pushManager: { subscribe() { effects.subscribe++; } } }) } },
});
const { parseNaturalVoiceCommand, generateRTLiteResponse } = module.exports;
const forbiddenTaskClaim = /notificaci[oó]n en tiempo real|sincronizaci[oó]n listas|sincronizad[oa]s? (?:con|en)/i;
for (const [qualifier, priority, title] of [
  ['urgente ', 'critica', 'revisar informe'], ['prioridad baja ', 'baja', 'revisar informe'],
  ['media ', 'media', 'media revisar informe'], ['', 'alta', 'revisar informe'],
]) {
  test(`task response is truthful and preserves ${priority} task data`, () => {
    const command = `Crear tarea ${qualifier}revisar informe para mañana a las 14:35 diario`;
    const parsed = parseNaturalVoiceCommand(command, {}, [], [], []);
    console.log(JSON.stringify({ command, spokenResponse: parsed.spokenResponse, priority: parsed.newTask?.priority }));
    assert.equal(parsed.isHandled, true); assert.equal(parsed.actionType, 'task');
    // Existing title/date/priority/recurrence extraction remains unchanged.
    const task = JSON.parse(JSON.stringify(parsed.newTask));
    assert.deepEqual({ title: task.title, dueDate: task.dueDate, timeDue: task.timeDue, priority: task.priority,
      category: task.category, isCompleted: task.isCompleted, recurrence: task.recurrence, subtasks: task.subtasks }, {
      title, dueDate: '2030-03-18', timeDue: '14:35', priority, category: priority === 'critica' ? 'urgente' : 'trabajo',
      isCompleted: false, recurrence: 'daily', subtasks: [],
    });
    assert.ok(parsed.actionDetails.includes(title)); assert.ok(parsed.actionDetails.includes('2030-03-18 14:35'));
    assert.doesNotMatch(parsed.spokenResponse, forbiddenTaskClaim);
    assert.match(parsed.spokenResponse, /notificaciones push y locales est[aá]n deshabilitadas/i);
    assert.deepEqual(effects, { timers: 0, native: 0, show: 0, subscribe: 0, messages: 0 });
  });
}
test('RT Lite help preserves task creation without offering a disabled push test', () => {
  for (const query of ['ayuda', 'comandos', 'que puedes hacer']) {
    const text = generateRTLiteResponse(query);
    console.log(JSON.stringify({ query, offersPushTest: /probar notificaci[oó]n push/i.test(text) }));
    assert.match(text, /Crear tarea urgente/);
    assert.doesNotMatch(text, /probar notificaci[oó]n push/i);
    assert.match(text, /notificaciones push y locales est[aá]n deshabilitadas/i);
  }
  assert.deepEqual(effects, { timers: 0, native: 0, show: 0, subscribe: 0, messages: 0 });
});
