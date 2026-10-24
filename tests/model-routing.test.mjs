import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AVAILABLE_MODELS } from '../src/types/index.ts';
import { catalogModelProvider, cloudModelProvider, providerModel, fallbackSelection, modelProvenance,
  ModelRoutingError } from '../src/shared/modelRouting.ts';

test('I03a: every declared model routes by its catalog provider, including Google models hosted on NIM', () => {
  const expected = { 'NVIDIA NIM': 'nvidia', 'Google Gemini': 'gemini', 'Custom LLM': 'custom',
    'RT-Lite Local': 'local', 'Direct Execution': 'direct' };
  assert.equal(new Set(AVAILABLE_MODELS.map(m => m.id)).size, AVAILABLE_MODELS.length);
  for (const model of AVAILABLE_MODELS) {
    assert.equal(catalogModelProvider(model.id), expected[model.category]);
    if (['local', 'direct'].includes(expected[model.category])) assert.throws(() => cloudModelProvider(model.id), ModelRoutingError);
    else assert.equal(cloudModelProvider(model.id), expected[model.category]);
  }
  for (const model of ['google/gemma-4-31b-it', 'google/diffusiongemma-26b-a4b-it']) {
    assert.equal(cloudModelProvider(model), 'nvidia'); assert.equal(providerModel('nvidia', model), model);
    assert.throws(() => providerModel('gemini', model), ModelRoutingError);
  }
  assert.equal(providerModel('gemini', 'google/gemini-2.5-pro'), 'gemini-2.5-pro');
  assert.equal(providerModel('gemini', 'gemini-2.5-flash'), 'gemini-2.5-flash');
  for (const model of ['google/gemini-2.5-pro', 'gemini-2.5-flash', 'custom-llm', 'rt-lite-local'])
    assert.throws(() => providerModel('nvidia', model), ModelRoutingError);
  for (const model of [null, {}, '', 'google/unregistered', 'rt-lite-unknown'])
    assert.throws(() => cloudModelProvider(model), ModelRoutingError);
});

test('I03a: fallback is opt-in and provenance separates selection from provider reporting', () => {
  assert.equal(fallbackSelection(undefined), 'none');
  for (const value of [null, '', true, {}, 'auto', 'gemini']) assert.throws(() => fallbackSelection(value), ModelRoutingError);
  const unknown = modelProvenance('nim', 'google/gemma-4-31b-it', 'google/gemma-4-31b-it');
  assert.equal(unknown.model_source, 'requested_only'); assert.equal(unknown.reported_model, null);
  const reported = modelProvenance('gemini', 'google/gemini-2.5-pro', 'gemini-2.5-pro', 'gemini-2.5-pro-version-fixture');
  assert.equal(reported.model_source, 'provider_reported'); assert.equal(reported.model_used, 'gemini-2.5-pro-version-fixture');
  assert.equal(reported.requested_model, 'google/gemini-2.5-pro');
});
