// Standalone real selector fixture; no Firebase, provider, credential or integration calls.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_CORE_PATH + '/index.mjs').href);
const bundle = await build({ stdin: { contents: `
  import React, { useState } from 'react';
  import { createRoot } from 'react-dom/client';
  import { ModelAgentControlBar } from './src/components/ModelAgentControlBar';
  import { cloudModelProvider } from './src/shared/modelRouting';
  function Fixture() {
    const [model, select] = useState('google/gemma-4-31b-it');
    return React.createElement(React.Fragment, null,
      React.createElement('output', { id: 'selection', 'data-provider': cloudModelProvider(model) }, model),
      React.createElement('button', { id: 'agent', onClick: () => select('z-ai/glm-5-3') }, 'Fixture agent model'),
      React.createElement(ModelAgentControlBar, { currentModel: model, onSelectModel: select,
        agents: [], activeAgentId: '', onSelectAgent() {}, onOpenAddAgent() {}, onOpenAllAgents() {} }));
  }
  createRoot(document.getElementById('root')).render(React.createElement(Fixture));
`, resolveDir: process.cwd() }, bundle: true, write: false, platform: 'browser', format: 'esm',
  define: { 'process.env.NODE_ENV': '"production"' } });
const server = createServer((_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.end('<!doctype html><div id="root"></div><script type="module">' + bundle.outputFiles[0].text + '</script>');
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await page.goto(base);
  await page.locator('#selection[data-provider="nvidia"]').waitFor();
  const nvidia = page.locator('select').nth(0), gemini = page.locator('select').nth(1);
  assert.equal(await nvidia.inputValue(), 'google/gemma-4-31b-it');
  assert.equal(await gemini.inputValue(), 'google/gemini-2.5-flash');
  await gemini.selectOption('google/gemini-2.5-pro');
  await page.locator('#selection[data-provider="gemini"]').waitFor();
  await page.locator('#agent').click();
  await page.locator('#selection[data-provider="nvidia"]').waitFor();
  assert.equal(await nvidia.inputValue(), 'z-ai/glm-5-3');
  await gemini.selectOption('google/gemini-2.5-flash');
  await page.locator('#selection[data-provider="gemini"]').waitFor();
  assert.equal(await nvidia.inputValue(), 'z-ai/glm-5-3', 'last NIM remains coherent after an external model change');
  assert.equal(await gemini.inputValue(), 'google/gemini-2.5-flash');
  console.log(JSON.stringify({ browser: browser.version(), gemmaProvider: 'nvidia', geminiProvider: 'gemini',
    externalAgentModel: 'z-ai/glm-5-3', selectorCoherence: true, realProviderCalls: 0 }));
} finally {
  await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}
