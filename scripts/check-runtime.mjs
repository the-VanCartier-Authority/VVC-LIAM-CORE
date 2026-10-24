import { readFile } from 'node:fs/promises';
const expected = (await readFile(new URL('../.node-version', import.meta.url), 'utf8')).trim();
const { engines, packageManager } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
if (process.versions.node !== expected || engines.node !== expected || packageManager !== 'bun@1.4.4') {
  throw new Error(`Validated runtime required: Node ${expected}, Bun 1.4.4; current Node ${process.versions.node}`);
}
console.log(`Validated Node ${expected}; package manager ${packageManager}`);
