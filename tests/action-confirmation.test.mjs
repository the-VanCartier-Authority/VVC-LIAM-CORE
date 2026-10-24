import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createConfirmationGate, needsSensitiveConfirmation } from '../src/core/actionConfirmation.ts';

test('I07: only one exact snapshot can be consumed once with unchanged identity/data', () => {
  let now = 1000, counter = 0;
  const gate = createConfirmationGate(() => now, () => String(++counter));
  const action = { callContact: { name: 'Ada', number: '+15550000001' } };
  const contextA = JSON.stringify({ uid: 'a', revision: 1 });
  const nonce = gate.request(action, contextA);
  action.callContact.number = '+15550000002';
  const taken = gate.take(nonce, contextA);
  assert.equal(taken.callContact.number, '+15550000001');
  assert.ok(Object.isFrozen(taken.callContact));
  assert.equal(gate.take(nonce, contextA), undefined);
  const otherUser = gate.request(action, contextA);
  assert.equal(gate.take(otherUser, JSON.stringify({ uid: 'b', revision: 1 })), undefined);
  const changedData = gate.request(action, contextA);
  assert.equal(gate.take(changedData, JSON.stringify({ uid: 'a', revision: 2 })), undefined);
  const expired = gate.request(action, contextA); now += 60000;
  assert.equal(gate.take(expired, contextA), undefined);
  const cancelled = gate.request(action, contextA); gate.cancel();
  assert.equal(gate.take(cancelled, contextA), undefined);
  const replaced = gate.request(action, contextA); gate.request(action, contextA);
  assert.equal(gate.take(replaced, contextA), undefined);
  assert.equal(gate.isPending(), false);
  const backwards = gate.request(action, contextA); now--;
  assert.equal(gate.take(backwards, contextA), undefined);
  now = NaN; const invalidClock = gate.request(action, contextA); now = 1000;
  assert.equal(gate.take(invalidClock, contextA), undefined);
});

test('I07: sensitive effect classification covers deletion, dialer and bulk/external changes', () => {
  for (const intent of [{ callContact: { name: 'fixture', number: 'fixture' } }, { taskToDeleteId: 'fixture' },
    { eventsToUpdate: [{}] }, { triggerThirdPartySync: true }, { triggerPushTest: true }, { triggerCalendarSync: 'google', newCalendarEvent: {} }])
    assert.equal(needsSensitiveConfirmation(intent), true);
  for (const intent of [{ isHandled: false }, { openCalendar: true }, { openVault: true }, { newTask: {} }])
    assert.equal(needsSensitiveConfirmation(intent), false);
  assert.equal(needsSensitiveConfirmation({ newTask: {} }, true), true);
  assert.equal(needsSensitiveConfirmation({ newCalendarEvent: { conflictNote: 'fixture' } }), true);
});
