// Test-only first preload. Later provider mocks may replace fetch with synthetic
// responses; any request reaching native fetch must stay on literal loopback.
const localFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (!['http:', 'https:'].includes(url.protocol) || !['127.0.0.1', '[::1]'].includes(url.hostname))
    throw new Error('EXTERNAL_TEST_FETCH_BLOCKED');
  return localFetch(input, { ...init, redirect: 'error' });
};
