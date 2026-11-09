import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadNotificationWorkerAssets, workerScriptAsset } from './helpers/notification-worker-assets.mjs';

async function fixture(t, { built = true, stale = false, precache = true, dependency = true } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'vvc-worker-assets-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'public'));
  await writeFile(join(root, 'public/sw.js'), "importScripts('/sw-push.js'); // public worker");
  await writeFile(join(root, 'public/sw-push.js'), '// synthetic disabled policy');
  if (built) {
    await mkdir(join(root, 'dist'));
    await writeFile(join(root, 'dist/sw.js'), "importScripts('/sw-push.js'); define(['./workbox-fixture'],()=>{const entries=[{url:'index.html',revision:'synthetic'}];});");
    await writeFile(join(root, 'dist/sw-push.js'), stale ? '// stale policy' : '// synthetic disabled policy');
    if (precache) await writeFile(join(root, 'dist/index.html'), '<title>synthetic</title>');
    if (dependency) await writeFile(join(root, 'dist/workbox-fixture.js'), '// synthetic workbox dependency');
  }
  return root;
}

test('push browser fixture diagnoses a missing build before launching a browser', async t => {
  const root = await fixture(t, { built: false });
  await assert.rejects(loadNotificationWorkerAssets(root), error => error.code === 'NOTIFICATION_FIXTURE_BUILD_REQUIRED' && /npm run build/.test(error.message));
});
test('push browser fixture rejects a stale built policy instead of substituting the public copy', async t => {
  const root = await fixture(t, { stale: true });
  await assert.rejects(loadNotificationWorkerAssets(root), { code: 'NOTIFICATION_FIXTURE_BUILD_STALE' });
});
test('push browser fixture diagnoses incomplete precache files', async t => {
  const root = await fixture(t, { precache: false });
  await assert.rejects(loadNotificationWorkerAssets(root), { code: 'NOTIFICATION_FIXTURE_BUILD_INVALID' });
});
test('push browser fixture diagnoses a missing Workbox dependency', async t => {
  const root = await fixture(t, { dependency: false });
  await assert.rejects(loadNotificationWorkerAssets(root), { code: 'NOTIFICATION_FIXTURE_BUILD_REQUIRED' });
});
test('each phase serves its actual worker and policy, and unknown script paths never become HTML', async t => {
  const assets = await loadNotificationWorkerAssets(await fixture(t));
  assert.equal(assets.precacheCount, 1);
  assert.equal(workerScriptAsset(assets, 'public', '/sw.js').source, 'public/sw.js');
  assert.equal(workerScriptAsset(assets, 'built', '/sw.js').source, 'dist/sw.js');
  assert.equal(workerScriptAsset(assets, 'built', '/sw-push.js').source, 'dist/sw-push.js');
  assert.equal(workerScriptAsset(assets, 'public', '/sw-push.js').source, 'public/sw-push.js');
  assert.notEqual(workerScriptAsset(assets, 'public', '/sw.js').sha256, workerScriptAsset(assets, 'built', '/sw.js').sha256);
  assert.equal(workerScriptAsset(assets, 'public', '/workbox-fixture.js'), undefined);
  assert.equal(workerScriptAsset(assets, 'built', '/workbox-missing.js'), undefined);
  assert.equal(workerScriptAsset(assets, 'legacy', '/sw-push.js'), undefined);
});
