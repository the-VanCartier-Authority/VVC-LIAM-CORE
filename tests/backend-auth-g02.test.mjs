import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { spawnSync } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { createLocalJWKSet, generateKeyPair, SignJWT } from 'jose';
import { createFirebaseVerifier } from '../src/server/firebaseIdentity.ts';
import { identityFixture } from './identity-fixture.mjs';
import { startApp } from './server-helper.mjs';

function rawRequest(app, path, headers, method = 'GET', body = '') {
  return new Promise((resolve, reject) => {
    const req = request(app.base + path, { method,
      headers: ['Host', new URL(app.base).host, ...headers] }, response => {
      let text = ''; response.setEncoding('utf8'); response.on('data', part => { text += part; });
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, text }));
    });
    req.on('error', reject); req.end(body);
  });
}

test('G02 JWT: a trusted kid cannot authorize another RSA signer, HS256, wrong typ or future nbf', async () => {
  const fixture = await identityFixture();
  const verify = createFirebaseVerifier(fixture.project, createLocalJWKSet(fixture.jwks));
  const valid = await fixture.token('synthetic-owner-a');
  assert.equal((await verify(valid)).uid, 'synthetic-owner-a');
  const claims = JSON.parse(Buffer.from(valid.split('.')[1], 'base64url').toString());
  const other = await generateKeyPair('RS256');
  await assert.rejects(verify(await new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: fixture.jwks.keys[0].kid }).sign(other.privateKey)));
  await assert.rejects(verify(await new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256', kid: fixture.jwks.keys[0].kid }).sign(new Uint8Array(32).fill(7))));
  await assert.rejects(verify(await fixture.token('synthetic-owner-a', {}, { typ: 'not-an-id-token' })));
  await assert.rejects(verify(await fixture.token('synthetic-owner-a', { nbf: Math.floor(Date.now() / 1000) + 60 })));
});

test('G02 HTTP: malformed and duplicated Authorization headers never reach a private handler', async t => {
  const app = await startApp(); t.after(() => app.stop());
  for (const headers of [[], ['Cookie', '__session=' + app.token],
    ['Authorization', 'Basic ' + app.token], ['Authorization', app.token],
    ['Authorization', 'Bearer'], ['Authorization', 'Bearer  ' + app.token],
    ['Authorization', 'Bearer\t' + app.token], ['Authorization', `Bearer ${app.token}, Bearer ${app.token}`],
    ['Authorization', 'Bearer ' + 'A'.repeat(8193)],
    ['Authorization', 'Bearer ' + app.token, 'Authorization', 'Bearer ' + app.token],
    ['Authorization', 'Bearer ' + app.token, 'authorization', 'Bearer forged-token']]) {
    const response = await rawRequest(app, '/api/vaos/tasks', headers);
    assert.equal(response.status, 401); assert.equal(response.headers['www-authenticate'], 'Bearer');
    assert.equal(JSON.parse(response.text).code, 'AUTH_REQUIRED');
    assert.ok(!response.text.includes(app.token));
  }
  assert.equal((await rawRequest(app, '/api/vaos/tasks', ['Authorization', 'bEaReR ' + app.token])).status, 200);
});

test('G02 HTTP: authentication precedes JSON parsing and only the three public GET APIs bypass it', async t => {
  const app = await startApp(); t.after(() => app.stop());
  const json = ['Content-Type', 'application/json', 'Content-Length', '1'];
  assert.equal((await rawRequest(app, '/api/chat/custom', json, 'POST', '{')).status, 401);
  assert.equal((await rawRequest(app, '/api/chat/custom', [...json, 'Authorization', 'Bearer ' + app.token], 'POST', '{')).status, 400);
  for (const path of ['/api/config', '/api/push/vapid-public-key', '/api/vaos/health'])
    assert.equal((await rawRequest(app, path, [])).status, 200);
  for (const [method, path] of [['POST', '/api/config'], ['HEAD', '/api/config'],
    ['GET', '/api/config/extra'], ['GET', '/api/unknown'], ['GET', '/api/vaos/telemetry']])
    assert.equal((await rawRequest(app, path, [], method)).status, 401);
});

test('G02 HTTP: invalid, empty or unavailable JWKS fail closed without leaking token or errors', async t => {
  for (const contents of ['not-json', '{"keys":[]}', null]) {
    const app = await startApp();
    try {
      if (contents === null) await unlink(app.jwksPath); else await writeFile(app.jwksPath, contents);
      const response = await rawRequest(app, '/api/vaos/tasks', ['Authorization', 'Bearer ' + app.token]);
      assert.equal(response.status, 401);
      assert.deepEqual(JSON.parse(response.text), { code: 'AUTH_REQUIRED', error: 'Se requiere una sesión válida.' });
      assert.equal((await rawRequest(app, '/api/config', [])).status, 200);
    } finally { await app.stop(); }
  }
});

test('G02 fixtures: unmocked external fetch fails before network I/O', () => {
  const result = spawnSync(process.execPath, ['--import', './tests/fixtures/block-external-fetch.mjs',
    '--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      for (const url of ['https://external.invalid', 'http://169.254.169.254/'])
        await assert.rejects(fetch(url), /EXTERNAL_TEST_FETCH_BLOCKED/);
      console.log('external-fetch-blocked');
    `], { cwd: new URL('../', import.meta.url), encoding: 'utf8', timeout: 3000 });
  assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /external-fetch-blocked/);
});
