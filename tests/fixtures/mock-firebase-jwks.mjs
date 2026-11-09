// Test-only preload. Production has no configurable JWKS endpoint or bypass mode.
import { readFile } from 'node:fs/promises';
const previousFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = input instanceof Request ? input.url : String(input);
  if (url === 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com') {
    return new Response(await readFile(process.env.VVC_FIXTURE_JWKS_PATH, 'utf8'), {
      status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=3600' },
    });
  }
  return previousFetch(input, init);
};
