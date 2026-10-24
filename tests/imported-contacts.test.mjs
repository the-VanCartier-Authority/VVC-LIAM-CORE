import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { convertGoogleContactsToPhoneContacts, listGoogleContacts } from '../src/services/googleContactsService.ts';

let dir, ui;
before(async () => {
dir = await mkdtemp(join(tmpdir(), 'vvc-contacts-fixture-'));
const bundle = await build({ stdin: { contents: `
  import React from 'react';
  import { renderToStaticMarkup } from 'react-dom/server';
  import { GoogleContactsModal } from './src/components/GoogleContactsModal';
  import { PhoneActionModal } from './src/components/PhoneActionModal';
  import { parseNaturalVoiceCommand } from './src/utils/rtLiteEngine';
  export { parseNaturalVoiceCommand };
  export const directory = contacts => renderToStaticMarkup(React.createElement(GoogleContactsModal, {
    isOpen: true, contacts, currentUser: null, onClose() {}, onSignInGoogle() {}, onUpdateContacts() {},
    onInitiateCall() {}, onInitiateMessage() {} }));
  export const dialer = contact => renderToStaticMarkup(React.createElement(PhoneActionModal, {
    call: { inCall: true, contactName: contact.name, phoneNumber: contact.phone }, onEndCall() {} }));
`, resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'cjs',
  plugins: [{ name: 'no-real-google-auth', setup(b) {
    b.onResolve({ filter: /services\/googleAuth$/ }, () => ({ path: 'fixture-auth', namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: "export const getAccessToken = async () => { throw Error('REAL_AUTH_FORBIDDEN'); };", loader: 'js' }));
  } }] });
const artifact = join(dir, 'render.cjs'); await writeFile(artifact, bundle.outputFiles[0].contents);
ui = createRequire(import.meta.url)(artifact);
});
after(() => rm(dir, { recursive: true, force: true }));
const item = { resourceName: 'people/fixture-a', name: 'Fixture Ada', phoneNumber: '+34 600 123 456', email: 'ada@example.test' };

test('I06: People API fixture imports into the real phone contract and real directory/dialer', async t => {
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(new URL(url).hostname, 'people.googleapis.com');
    assert.equal(init.headers.Authorization, 'Bearer synthetic-only');
    return Response.json({ connections: [{ resourceName: item.resourceName,
      names: [{ displayName: item.name }], phoneNumbers: [{ value: item.phoneNumber }],
      emailAddresses: [{ value: item.email }] }] });
  });
  const contacts = convertGoogleContactsToPhoneContacts(await listGoogleContacts('synthetic-only'));
  assert.equal(contacts[0].phone, item.phoneNumber);
  assert.match(ui.directory(contacts), /\+34 600 123 456/);
  assert.match(ui.dialer(contacts[0]), /href="tel:\+34600123456"/);
  const saved = JSON.parse(JSON.stringify(contacts));
  assert.equal(saved[0].phone, item.phoneNumber); assert.equal(saved[0].number, undefined);
});

test('I06: missing phone never becomes an email or invented number', () => {
  const contacts = convertGoogleContactsToPhoneContacts([{ ...item, phoneNumber: undefined },
    { ...item, resourceName: 'people/fixture-b', phoneNumber: undefined, email: undefined }]);
  for (const contact of contacts) {
    assert.equal(contact.phone, '');
    const actions = ui.directory([contact]).match(/<button[^>]*>/g).filter(button => /title="(?:Llamar|Enviar mensaje)/.test(button));
    assert.equal(actions.length, 2);
    for (const button of actions) assert.match(button, /disabled=""/);
  }
});

test('I06: imported phone reaches the real RT Lite call and message consumers', () => {
  const contacts = convertGoogleContactsToPhoneContacts([item]);
  const call = ui.parseNaturalVoiceCommand('llamar a fixture ada', {}, contacts);
  assert.deepEqual(call.callContact, { name: item.name, number: item.phoneNumber });
  const message = ui.parseNaturalVoiceCommand('enviar mensaje a fixture ada: hola', {}, contacts);
  assert.equal(message.messagePayload.recipient, item.phoneNumber);
  assert.doesNotMatch(call.spokenResponse, /encriptad|iniciando|segura/i);
});

test('I06: absent phone cannot produce a call/SMS from an imported name, and unknown names get no fictional number', () => {
  const contacts = convertGoogleContactsToPhoneContacts([{ ...item, phoneNumber: undefined }]);
  assert.equal(ui.parseNaturalVoiceCommand('llamar a fixture ada', {}, contacts).callContact, undefined);
  assert.equal(ui.parseNaturalVoiceCommand('enviar mensaje a fixture ada: hola', {}, contacts).messagePayload, undefined);
  assert.equal(ui.parseNaturalVoiceCommand('llamar a desconocido', {}, []).callContact, undefined);
});
