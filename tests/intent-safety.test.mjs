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
    'no borrar tarea comprar café', 'no encender linterna', 'no sincronizar calendario', 'encender linterna, mejor no']) {
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
  assert.equal(parse('enviar mensaje a desconocido: hola', {}, contacts, tasks).messagePayload, undefined);
  assert.equal(parse('emergencia', {}, contacts, tasks).callContact, undefined);
  for (const command of ['activar wifi o bluetooth', 'activar wifi y bluetooth', 'encender linterna y apagar wifi'])
    assert.equal(parse(command, {}, contacts, tasks).updatedDeviceState, undefined);
  for (const command of ['completar tarea café', 'posponer recordatorio café 10 minutos',
    'cambiar prioridad de café a crítica', 'modificar tarea café a las 18:00']) {
    const intent = parse(command, {}, contacts, tasks);
    assert.equal(intent.isHandled, true); assert.match(intent.spokenResponse, /varias tareas/);
    assert.equal(intent.taskToCompleteId, undefined); assert.equal(intent.taskToModify, undefined); assert.equal(intent.newTask, undefined);
  }
});

test('I07: quoted/control descriptions and reminder bodies are data, while direct controls remain usable', () => {
  for (const command of ['"encender linterna"', 'ejemplo: encender linterna', 'texto: brillo al 20',
    'describe subir volumen', '¿cómo poner alarma a las 8?', 'texto: temporizador de 5 minutos']) {
    const intent = parse(command, { volume: 50, brightness: 50 }, contacts, tasks);
    for (const field of ['updatedDeviceState', 'newAlarm', 'newTimer']) assert.equal(intent[field], undefined, command);
  }
  assert.equal(parse('encender linterna', {}, contacts).updatedDeviceState.flashlight, true);
  assert.equal(parse('volumen al 20', {}, contacts).updatedDeviceState.volume, 20);
  assert.equal(parse('poner alarma a las 8', {}, contacts).newAlarm.time, '08:00');
  assert.equal(parse('recuérdame sincronizar calendario', {}, contacts).triggerThirdPartySync, undefined);
  assert.ok(parse('recuérdame sincronizar calendario', {}, contacts).newTask);
  assert.ok(parse('enviar mensaje a ada: hola o adiós, no lo hagas', {}, contacts).messagePayload);
  for (const command of ['mi informe dice activar wifi', 'mi texto dice google maps', 'mi informe contiene test push']) {
    const intent = parse(command, {}, contacts, tasks);
    assert.equal(intent.updatedDeviceState, undefined); assert.equal(intent.openMaps, undefined); assert.equal(intent.triggerPushTest, undefined);
  }
});
