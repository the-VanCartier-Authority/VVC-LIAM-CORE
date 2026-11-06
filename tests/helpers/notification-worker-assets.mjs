import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, sep } from 'node:path';

function invalid(code, message) {
  const error = new Error(`${code}: ${message}. Run npm run build before npm run test:browser.`);
  error.code = code; return error;
}

export async function loadNotificationWorkerAssets(root) {
  const dist = resolve(root, 'dist');
  async function file(directory, name) {
    const path = resolve(root, directory, name);
    try {
      const body = await readFile(path);
      return { source: `${directory}/${name}`, body, sha256: createHash('sha256').update(body).digest('hex') };
    } catch (error) {
      throw invalid('NOTIFICATION_FIXTURE_BUILD_REQUIRED', `Cannot read ${directory}/${name} (${error.code})`);
    }
  }
  const [publicMain, publicPush, builtMain, builtPush] = await Promise.all([
    file('public', 'sw.js'), file('public', 'sw-push.js'), file('dist', 'sw.js'), file('dist', 'sw-push.js'),
  ]);
  if (!builtPush.body.equals(publicPush.body))
    throw invalid('NOTIFICATION_FIXTURE_BUILD_STALE', 'dist/sw-push.js differs from public/sw-push.js');
  const main = builtMain.body.toString('utf8');
  if (!main.includes('sw-push.js')) throw invalid('NOTIFICATION_FIXTURE_BUILD_INVALID', 'Built worker does not import sw-push.js');
  const dependencies = [...new Set(main.match(/workbox-[A-Za-z0-9_-]+(?:\.js)?/g) || [])]
    .map(name => name.endsWith('.js') ? name : name + '.js');
  // The generated format is pinned by bun.lock. Refuse an unknown manifest shape
  // instead of serving the fixture's HTML in place of missing precache assets.
  const urls = [...main.matchAll(/\burl:\s*["']([^"']+)["']/g)].map(match => match[1]);
  if (!dependencies.length || !urls.length)
    throw invalid('NOTIFICATION_FIXTURE_BUILD_INVALID', 'Cannot identify Workbox dependencies/precache URLs');
  for (const url of urls) {
    const parsed = new URL(url, 'http://fixture.invalid/');
    const path = resolve(dist, '.' + parsed.pathname);
    if (parsed.origin !== 'http://fixture.invalid' || !path.startsWith(dist + sep))
      throw invalid('NOTIFICATION_FIXTURE_BUILD_INVALID', `Unsupported precache URL ${url}`);
    try { if (!(await stat(path)).isFile()) throw Error('not a file'); }
    catch { throw invalid('NOTIFICATION_FIXTURE_BUILD_INVALID', `Missing precache asset ${url}`); }
  }
  const publicAssets = new Map([['/sw.js', publicMain], ['/sw-push.js', publicPush]]);
  const builtAssets = new Map([['/sw.js', builtMain], ['/sw-push.js', builtPush]]);
  for (const name of dependencies) builtAssets.set('/' + name, await file('dist', name));
  return { public: publicAssets, built: builtAssets, precacheCount: urls.length };
}

export function workerScriptAsset(assets, phase, pathname) {
  return phase === 'public' || phase === 'built' ? assets[phase].get(pathname) : undefined;
}
