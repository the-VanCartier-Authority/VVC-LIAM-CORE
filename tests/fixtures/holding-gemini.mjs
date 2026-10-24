import { appendFileSync } from 'node:fs';
globalThis.fetch = async (url, options) => {
  const request = new Request(url, options);
  if (new URL(request.url).origin !== 'https://generativelanguage.googleapis.com') throw Error('Unexpected fixture destination');
  appendFileSync(process.env.F01_CAPTURE_FILE, 'generation-started\n');
  return new Promise((_resolve, reject) => {
    const signal = options?.signal || request.signal;
    if (signal.aborted) reject(new DOMException('Aborted', 'AbortError'));
    else signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  });
};
