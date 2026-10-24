import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
let parse;
before(async () => {
  const bundle = await build({ entryPoints: ['src/utils/rtLiteEngine.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
  parse = (await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'))).parseNaturalVoiceCommand;
});
const contacts = [{ id: 'a', name: 'Ada', phone: '+15550000001' }];
const tasks = [{ id: 'a', title: 'comprar café' }, { id: 'b', title: 'revisar café' }];

test('I07: explicit negation never prepares a call, delete, device change or cloud sync', () => {
  for (const command of ['no llamar a ada', 'no quiero llamar a ada', 'nunca llamar a ada',
    'no borrar tarea comprar café', 'no encender linterna', 'no sincronizar calendario']) {
    const intent = parse(command, {}, contacts, tasks);
    for (const field of ['callContact', 'taskToDeleteId', 'updatedDeviceState', 'triggerThirdPartySync', 'triggerCalendarSync'])
      assert.equal(intent[field], undefined, `${command}: ${field}`);
    assert.equal(intent.isHandled, true);
  }
});

test('I07: descriptive questions and a reminder body cannot invoke an embedded command', () => {
  const question = parse('¿cómo borrar tarea comprar café?', {}, contacts, tasks);
  assert.equal(question.taskToDeleteId, undefined); assert.equal(question.newTask, undefined);
  const reminder = parse('crear tarea llamar a ada', {}, contacts, tasks);
  assert.equal(reminder.callContact, undefined); assert.ok(reminder.newTask);
  const negativeReminder = parse('recuérdame no llamar a ada', {}, contacts, tasks);
  assert.equal(negativeReminder.callContact, undefined); assert.ok(negativeReminder.newTask);
});

test('I07: multiple contacts/tasks and compound alternatives require clarification', () => {
  const ambiguousContact = parse('llamar a ada', {}, [...contacts, { id: 'b', name: 'Ada Rivera', phone: '+15550000002' }]);
  assert.equal(ambiguousContact.callContact, undefined);
  assert.equal(parse('borrar tarea café', {}, contacts, tasks).taskToDeleteId, undefined);
  assert.equal(parse('borrar tarea inexistente', {}, contacts, tasks).newTask, undefined);
  assert.equal(parse('llamar a ada o borrar tarea comprar café', {}, contacts, tasks).callContact, undefined);
});
