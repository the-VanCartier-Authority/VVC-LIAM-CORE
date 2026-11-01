import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { worker, client } from './helpers/notification-fixtures.mjs';

test('actual public/sw.js rejects SCHEDULE_BACKGROUND_NOTIFICATION without a timer', async () => {
  const sw = worker(); await sw.dispatch('message', { type: 'SCHEDULE_BACKGROUND_NOTIFICATION', title: 'synthetic', delayMs: 1 });
  console.log(JSON.stringify({ case: 'registered worker schedule', timers: sw.timers.length, show: sw.counts.show }));
  assert.equal(sw.timers.length, 0); assert.equal(sw.counts.show, 0);
});
test('actual public/sw.js rejects SHOW_BACKGROUND_NOTIFICATION', async () => {
  const sw = worker(); await sw.dispatch('message', { type: 'SHOW_BACKGROUND_NOTIFICATION', title: 'synthetic' });
  console.log(JSON.stringify({ case: 'worker immediate', show: sw.counts.show }));
  assert.equal(sw.counts.show, 0);
});
test('actual public/sw.js ignores incoming push payload and never shows it', async () => {
  const sw = worker(); await sw.dispatch('push', { json() { sw.counts.payload++; return { title: 'synthetic push' }; } });
  console.log(JSON.stringify({ case: 'incoming push', show: sw.counts.show, payloadReads: sw.counts.payload }));
  assert.equal(sw.counts.show, 0); assert.equal(sw.counts.payload, 0);
});
test('worker activation preserves unrelated and legacy caches', async () => {
  const sw = worker(); await sw.dispatch('activate');
  assert.deepEqual(sw.deleted, []); assert.equal(sw.counts.claim, 1);
});
test('client entry points create no permission, subscription, scheduling or local notification effects for two identities', async () => {
  for (const identity of ['synthetic-a', 'synthetic-b']) {
    const c = await client();
    await c.service.requestNotificationPermission();
    const subscription = await c.service.subscribeToPushNotifications();
    const schedule = await c.service.scheduleBackgroundAlert(identity, {}, 1);
    const send = await c.service.sendBackgroundAlert(identity);
    const nativeTest = await c.service.testNativePushNotification();
    await c.service.unsubscribeFromPushNotifications();
    console.log(JSON.stringify({ case: 'client notification calls', identity, counts: c.counts, subscriptionSuccess: subscription.success }));
    assert.equal(subscription.success, false); assert.equal(schedule?.success, false); assert.equal(send?.success, false);
    assert.equal(nativeTest.success, false); assert.equal(nativeTest.outcome.status, 'unavailable');
    assert.deepEqual(c.counts, { permission: 0, subscribe: 0, unsubscribe: 0, show: 0, native: 0, messages: 0, fetch: 0, register: 0 });
    assert.equal(c.storage.get('vvc_liam_push_active'), 'legacy-record'); assert.equal(c.storage.get('unrelated-user-data'), 'keep');
  }
});
test('503 PUSH_DISABLED cannot become subscription/test success or a new Notification fallback', async () => {
  const c = await client(); c.state.existing = true;
  const sub = await c.service.subscribeToPushNotifications();
  const fallback = await client(); fallback.state.noWorker = true;
  await fallback.service.sendBackgroundAlert('synthetic without worker');
  console.log(JSON.stringify({ case: '503 subscription / fallback', success: sub.success, fetchCalls: c.counts.fetch,
    fallbackFetchCalls: fallback.counts.fetch, native: fallback.counts.native }));
  assert.equal(sub.success, false);
  assert.equal(fallback.counts.native, 0); assert.equal(c.counts.unsubscribe, 0);
});
test('DeviceAdapter cannot request permission or deliver a native notification', async () => {
  const c = await client(), device = new c.service.DeviceAdapter();
  const permission = await device.requestNotificationPermission(), shown = await device.showNotification('synthetic');
  console.log(JSON.stringify({ case: 'DeviceAdapter', permission, shown, counts: c.counts }));
  assert.equal(shown, false);
  assert.equal(c.counts.permission, 0); assert.equal(c.counts.show, 0); assert.equal(c.counts.native, 0);
});
test('actual SettingsModal renders a disabled state without activation/test/scheduling controls', async () => {
  const c = await client();
  const html = renderToStaticMarkup(React.createElement(c.service.SettingsModal, {
    isOpen: true, initialSection: 'push', nvidiaApiKey: '', geminiApiKey: '', customEndpoint: '', thirdPartyWebhookUrl: '',
    currentModel: 'nvidia-fast', selectedVoiceId: 'es_mateo', pitchModifier: 0, rateModifier: 1,
    currentTheme: 'obsidian-cyan', onClose() {}, onOpenInstallModal() {}
  }));
  assert.ok(/deshabilitadas/i.test(html), 'settings must declare disabled delivery');
  assert.doesNotMatch(html, /Habilitar Notificaciones|Probar Alerta Inmediata|Probar en 5s|Re-sincronizar Service Worker/);
});


test('worker rejects message commands explicitly and identifies the disabled policy', async () => {
  const sw = worker(), c = await client();
  await sw.dispatch('message', { type: 'SCHEDULE_BACKGROUND_NOTIFICATION' });
  await sw.dispatch('message', { type: 'SHOW_BACKGROUND_NOTIFICATION' });
  for (const result of sw.replies) {
    assert.equal(result.success, false); assert.equal(result.code, 'PUSH_DISABLED'); assert.equal(result.realExecution, false);
    assert.equal(result.outcome.status, 'unavailable');
  }
  assert.equal(sw.replies.length, 2);
  await sw.dispatch('message', { type: 'GET_NOTIFICATION_POLICY' });
  assert.equal(sw.replies.at(-1).enabled, false);
  assert.equal(sw.replies.at(-1).revision, c.service.NOTIFICATION_POLICY_REVISION);
  assert.equal(sw.timers.length, 0); assert.equal(sw.counts.show, 0);
});
test('public worker retains a cached response when network is unavailable', async () => {
  const sw = worker();
  const [response] = await sw.dispatch('fetch', {}, { request: new Request('https://fixture.test/static-fixture') });
  assert.equal(await response.text(), 'cached fixture');
});
test('legacy notification clicks do not open a URL or dispatch a task', async () => {
  const sw = worker(); await sw.dispatch('notificationclick');
  assert.equal(sw.counts.open, 0); assert.equal(sw.counts.show, 0);
});
test('status preserves the difference between disabled delivery and an unknown legacy subscription', async () => {
  const c = await client(), status = await c.service.getPushSubscriptionStatus();
  assert.equal(status.enabled, false); assert.equal(status.code, 'PUSH_DISABLED');
  assert.equal(status.isSubscribed, null); assert.equal(status.permission, 'granted');
  assert.equal(c.storage.get('vvc_liam_push_active'), 'legacy-record');
  assert.equal(c.counts.fetch, 0); assert.equal(c.counts.register, 0);
});
test('worker confirmation requires the exact disabled acknowledgement; a silent old worker expires', async () => {
  const c = await client(), confirm = c.service.lifecycle.confirmDisabledWorker;
  assert.equal(await confirm(null), false);
  for (const [revision, enabled, expected] of [
    [c.service.NOTIFICATION_POLICY_REVISION, false, true],
    ['old-worker', false, false], [c.service.NOTIFICATION_POLICY_REVISION, true, false]
  ]) {
    const result = await confirm({ postMessage(_data, [port]) {
      port.postMessage({ type: 'NOTIFICATION_POLICY', revision, enabled });
    } });
    assert.equal(result, expected);
  }
  assert.equal(await confirm({ postMessage() {} }), false);
});
