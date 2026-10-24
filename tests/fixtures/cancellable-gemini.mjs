import { appendFileSync } from 'node:fs';
globalThis.fetch = async (url, options) => {
  const request = new Request(url, options);
  if (new URL(request.url).origin !== 'https://generativelanguage.googleapis.com') throw Error('Unexpected fixture destination');
  appendFileSync(process.env.F01_CAPTURE_FILE, 'started\n');
  return new Promise((_resolve, reject) => {
    const signal = options?.signal || request.signal;
    const abort = () => { appendFileSync(process.env.F01_CAPTURE_FILE, 'aborted\n'); reject(new DOMException('Aborted', 'AbortError')); };
    if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
  });
};
