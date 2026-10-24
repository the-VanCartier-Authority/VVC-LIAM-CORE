// Actual TelemetryPanel polling with fixture API/device boundaries, no provider/Google access.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_CORE_PATH + '/index.mjs').href);
const bundle = await build({ stdin: { contents: `import React from 'react'; import { createRoot } from 'react-dom/client';
  import { TelemetryPanel } from './src/components/TelemetryPanel';
  window.fixtureState = new URLSearchParams(location.search).get('state');
  createRoot(document.getElementById('root')).render(React.createElement(TelemetryPanel, {isOpen:true,onClose(){}}));`, resolveDir: process.cwd() },
  bundle: true, write: false, platform: 'browser', format: 'esm', define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'fixture-only', setup(b) {
    b.onResolve({ filter: /\/PlatformService$/ }, () => ({ path: 'platform', namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `export const platformService = {getPlatform: () => 'web',isNativeApp: () => false,
      api: { dispatchVaos: async () => ({ asyncTask: { taskId: 'fixture-task' } }),
        getVaosTask: async () => ({ status: window.fixtureState }),
        getVaosTelemetry: async () => ({points:[],stats:{avgFastPathLatencyMs:0,avgAsyncDurationMs:0,avgTokensPerSec:0,totalDispatched:0,fastPathCount:0,asyncCount:0,p0Count:0,p1Count:0,p2Count:0}}) },
      device: { getBatteryInfo: async () => ({level:0.5,charging:false,chargingTime:0,dischargingTime:0,temperatureEstimatedC:undefined,healthProfile:'NORMAL'}) } };`, loader: 'js' }));
  } }] });
const server = createServer((_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><div id="root"></div><script type="module">' + bundle.outputFiles[0].text + '</script>'); });
server.listen(0, '127.0.0.1'); await once(server, 'listening'); const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage(), errors = []; page.setDefaultTimeout(8000); page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  for (const state of ['CANCELLED','INTERRUPTED','UNAVAILABLE','FAILED']) {
    await page.goto(base + '?state=' + state); await page.waitForTimeout(100); if (errors.length) throw new Error(JSON.stringify({errors})); await page.getByRole('button', { name: 'Benchmark VAOS' }).click();
    await page.getByText(new RegExp('^Tarea ' + state + ':')).waitFor();
    assert.equal(await page.getByText(/Benchmark completado/).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Benchmark VAOS' }).isEnabled(), true);
  }
  await page.goto(base + '?state=PROCESSING'); await page.getByRole('button', { name: 'Benchmark VAOS' }).click();
  await page.getByText(/^Consulta detenida: tarea PROCESSING/).waitFor();
  assert.equal(await page.getByText(/Benchmark completado/).count(), 0); assert.deepEqual(errors, []);
  console.log(JSON.stringify({ browser: browser.version(), cancelledNotSuccess: true, interruptedNotSuccess: true,
    failedNotSuccess: true, unavailableNotSuccess: true, pollTimeoutStillPending: true, errors, realExternalCalls: 0 }));
} finally { await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
