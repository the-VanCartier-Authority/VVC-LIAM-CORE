// Browser coverage is a separate, explicit gate; npm test remains the Node suite.
import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
const root = fileURLToPath(new URL('../', import.meta.url));
const fixtures = (await readdir(new URL('../tests/', import.meta.url))).filter(name => name.endsWith('-browser.mjs')).sort();
if (!fixtures.length) throw new Error('NO_BROWSER_FIXTURES');
const executable = process.env.CHROMIUM_EXECUTABLE_PATH || chromium.executablePath();
console.log(JSON.stringify({ gate: 'Chromium fixtures', fixtures, executable, node: process.version }));
for (const fixture of fixtures) {
  console.log(`Browser fixture: tests/${fixture}`);
  const child = spawn(process.execPath, [`tests/${fixture}`], { cwd: root, stdio: 'inherit', timeout: 120000,
    env: { ...process.env, CHROMIUM_EXECUTABLE_PATH: executable,
      PLAYWRIGHT_CORE_PATH: fileURLToPath(new URL('../node_modules/playwright-core', import.meta.url)),
      GEMINI_API_KEY: '', NVIDIA_API_KEY: '', LLM_PROVIDERS_JSON: '[]' } });
  const [code, signal] = await once(child, 'exit');
  if (code !== 0 || signal) throw new Error(`BROWSER_FIXTURE_FAILED: ${fixture} (${code ?? signal})`);
}
console.log(JSON.stringify({ browserGate: 'PASS', fixturesExecuted: fixtures.length }));
