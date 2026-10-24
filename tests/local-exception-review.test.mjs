import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ProviderRegistry, resolveProvider, EgressPolicyError } from '../src/server/providerEgress.ts';

test('review: local DNS cannot move a provider to another address in the private ranges', async () => {
  const target = { id: 'fixture', kind: 'ollama', endpoint: 'http://local.fixture:11434/v1/chat/completions', allowByok: true,
    localException: { providerId: 'fixture', hostname: 'local.fixture', port: 11434, addresses: ['127.0.0.1'] } };
  await resolveProvider(target, async () => [{ address: '127.0.0.1', family: 4 }]);
  for (const address of ['127.0.0.2', '10.0.0.2', '172.16.0.2', '192.168.1.2'])
    await assert.rejects(resolveProvider(target, async () => [{ address, family: 4 }]), EgressPolicyError);
});

test('review: a local DNS exception must enumerate exact IP addresses', () => {
  assert.throws(() => new ProviderRegistry(JSON.stringify([{ id: 'fixture', kind: 'ollama',
    endpoint: 'http://local.fixture:11434/v1/chat/completions', allowByok: true,
    localException: { providerId: 'fixture', hostname: 'local.fixture', port: 11434 } }])), EgressPolicyError);
});
