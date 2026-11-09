import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLocalJWKSet, generateKeyPair, exportJWK, SignJWT } from 'jose';
import { writeFile } from 'node:fs/promises';
import { createFirebaseVerifier } from '../src/server/firebaseIdentity.ts';
import { createAuthenticatedFetch } from '../src/core/authenticatedFetch.ts';
import { identityFixture } from './identity-fixture.mjs';
import { startApp } from './server-helper.mjs';

test('cryptographic Firebase validation binds UID to signature, project, time and trusted keys', async () => {
  const identity = await identityFixture();
  const verify = createFirebaseVerifier(identity.project, createLocalJWKSet(identity.jwks));
  for (const uid of ['user-a', 'user-b']) assert.equal((await verify(await identity.token(uid))).uid, uid);
  const now = Math.floor(Date.now() / 1000);
  for (const claims of [{ aud: 'wrong-project' }, { aud: [identity.project, 'other'] },
    { iss: 'https://securetoken.google.com/wrong-project' }, { exp: now - 1 }, { exp: undefined },
    { iat: now + 60 }, { iat: undefined }, { auth_time: now + 60 }, { auth_time: now, iat: now - 60 }, { auth_time: undefined },
    { sub: '' }, { sub: 'x'.repeat(129) }, { sub: 123 }, { exp: now + 7200 }])
    await assert.rejects(verify(await identity.token('user-a', claims)));
  await assert.rejects(verify(await identity.token('user-a', {}, { kid: 'unknown-key' })));
  const token = await identity.token('user-a');
  const parts = token.split('.');
  const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  parts[1] = Buffer.from(JSON.stringify({ ...claims, sub: 'forged-user' })).toString('base64url');
  await assert.rejects(verify(parts.join('.')));
  await assert.rejects(verify(Buffer.from('{"alg":"none"}').toString('base64url') + '.' + parts[1] + '.'));
  await assert.rejects(verify('x'.repeat(8193)));
});

test('HTTP accepts two signed identities and overlapping Firebase rotation keys, rejects invalid tokens', async t => {
  const app = await startApp(); t.after(() => app.stop());
  const pair = await generateKeyPair('RS256');
  const nextKey = { ...await exportJWK(pair.publicKey), kid: 'rotation-key', alg: 'RS256', use: 'sig' };
  await writeFile(app.jwksPath, JSON.stringify({ keys: [...app.identity.jwks.keys, nextKey] }));
  const now = Math.floor(Date.now() / 1000);
  const rotated = await new SignJWT({ sub: 'fixture-user-b', iss: `https://securetoken.google.com/${app.identity.project}`,
    aud: app.identity.project, auth_time: now - 1, iat: now, exp: now + 3600 })
    .setProtectedHeader({ alg: 'RS256', kid: nextKey.kid, typ: 'JWT' }).sign(pair.privateKey);
  for (const token of [app.token, rotated]) {
    assert.equal((await fetch(app.base + '/api/vaos/tasks', { headers: { Authorization: `Bearer ${token}` } })).status, 200);
  }
  for (const token of [await app.identity.token('user', { exp: now - 1 }),
    await app.identity.token('user', { aud: 'wrong-project' }),
    await app.identity.token('user', { iss: 'https://securetoken.google.com/wrong-project' }),
    await app.identity.token('user', {}, { kid: 'untrusted-key' }), 'forged-token']) {
    const response = await fetch(app.base + '/api/vaos/tasks', { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(response.status, 401); assert.equal((await response.json()).code, 'AUTH_REQUIRED');
  }
});

test('key discovery failures fail closed; query strings and OAuth-like tokens never authenticate', async t => {
  const app = await startApp(); t.after(() => app.stop());
  await writeFile(app.jwksPath, '{"keys":[]}');
  for (const request of [
    fetch(app.base + '/api/vaos/tasks', { headers: app.authHeaders }),
    fetch(app.base + '/api/vaos/tasks?token=' + encodeURIComponent(app.token)),
    fetch(app.base + '/api/vaos/tasks', { headers: { Authorization: 'Bearer synthetic-workspace-oauth' } }),
  ]) assert.equal((await request).status, 401);
  assert.equal((await fetch(app.base + '/api/config')).status, 200);
  assert.equal((await fetch(app.base + '/api/push/vapid-public-key')).status, 200);
});

test('client resolves current ID token per request and cannot send it to another origin or a redirect', async () => {
  const calls = [];
  let current = 'synthetic-id-user-a';
  const backend = createAuthenticatedFetch(async () => current, () => 'https://liam.example', async (url, init) => {
    calls.push({ url, init }); return new Response('{}');
  });
  await backend('/api/chat/nvidia', { method: 'POST', headers: { Authorization: 'Bearer workspace-oauth' } });
  current = 'synthetic-id-user-b'; await backend('/api/vaos/tasks');
  assert.deepEqual(calls.map(c => c.init.headers.get('Authorization')), ['Bearer synthetic-id-user-a', 'Bearer synthetic-id-user-b']);
  assert.ok(calls.every(c => c.init.redirect === 'error' && c.init.credentials === 'same-origin'));
  for (const url of ['https://evil.example/api/chat/nvidia', '//evil.example/api/chat/custom', 'https://user:pass@liam.example/api/x', '/not-api'])
    await assert.rejects(backend(url), /BACKEND_ORIGIN_NOT_ALLOWED/);
  current = null;
  await assert.rejects(backend('/api/chat/nvidia', { method: 'POST' }), /AUTH_REQUIRED/);
  assert.equal(calls.length, 2);
  await backend('/api/config'); assert.equal(calls[2].init.headers.get('Authorization'), null);
});
