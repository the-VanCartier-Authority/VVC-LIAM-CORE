import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPushSessionGuard } from '../src/core/pushSession.ts';

test('B05: browser credential is revoked on account change and cannot carry A ownership into B', async () => {
  let uid = 'a', unsubscribed = 0, closed = 0, sub = null;
  const values = new Map(), storage = { getItem: k => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
  const device = () => ({ async unsubscribe() { unsubscribed++; sub = null; return true; } });
  const guard = createPushSessionGuard(() => uid, storage, async () => ({
    pushManager: { getSubscription: async () => sub }, getNotifications: async () => [{ close() { closed++; } }] }));
  sub = device(); // Legacy unowned subscription is never assigned to A.
  await guard.withAccount(async owner => { assert.equal(owner, 'a'); assert.equal(sub, null); sub = device(); });
  assert.equal(unsubscribed, 1);
  assert.equal(values.get('vvc_liam_push_owner_uid'), 'a');
  await guard.reset(); assert.equal(unsubscribed, 1, 'same verified owner keeps subscription');
  uid = 'b'; await guard.reset();
  assert.equal(unsubscribed, 2); assert.equal(values.has('vvc_liam_push_owner_uid'), false);
  await guard.withAccount(async owner => { assert.equal(owner, 'b'); sub = device(); });
  uid = null; await guard.reset();
  assert.equal(unsubscribed, 3); assert.ok(closed >= 3);
  await assert.rejects(guard.withAccount(async () => {}), /AUTH_REQUIRED/);
});

test('B05: identity changes during registration discard the device credential and successful ownership stamp', async () => {
  let uid = 'a', sub = null, revoked = false;
  const values = new Map(), storage = { getItem: k => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
  const guard = createPushSessionGuard(() => uid, storage, async () => ({
    pushManager: { getSubscription: async () => sub }, getNotifications: async () => [] }));
  await assert.rejects(guard.withAccount(async () => {
    sub = { async unsubscribe() { revoked = true; return true; } }; uid = 'b';
  }), /PUSH_ACCOUNT_CHANGED/);
  assert.equal(revoked, true); assert.equal(values.has('vvc_liam_push_owner_uid'), false);
});

test('B05: rejected registration revokes the browser credential and leaves no verified owner', async () => {
  let sub = null, revoked = false;
  const values = new Map(), storage = { getItem: k => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
  const guard = createPushSessionGuard(() => 'a', storage, async () => ({
    pushManager: { getSubscription: async () => sub }, getNotifications: async () => [] }));
  await assert.rejects(guard.withAccount(async () => {
    sub = { async unsubscribe() { revoked = true; return true; } }; throw new Error('PUSH_REGISTRATION_REJECTED');
  }), /PUSH_REGISTRATION_REJECTED/);
  assert.equal(revoked, true); assert.equal(values.has('vvc_liam_push_owner_uid'), false);
});
