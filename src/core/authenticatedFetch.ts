// Firebase ID tokens are backend credentials, separate from Workspace OAuth tokens.
// Resolve the token at request time so sign-out, expiry and user changes take effect.
export function createAuthenticatedFetch(getToken: () => Promise<string | null>, getOrigin: () => string,
  transport: typeof fetch = (...args) => fetch(...args)) {
  return async (input: string | URL, init: RequestInit = {}): Promise<Response> => {
    const origin = new URL(getOrigin()).origin;
    const url = new URL(input, origin);
    if (url.origin !== origin || !url.pathname.startsWith('/api/') || url.username || url.password)
      throw new Error('BACKEND_ORIGIN_NOT_ALLOWED');
    const headers = new Headers(init.headers);
    // Callers cannot substitute a Workspace access token or stale Authorization.
    headers.delete('Authorization');
    const token = await getToken();
    const publicRead = (!init.method || init.method.toUpperCase() === 'GET') &&
      ['/api/config', '/api/push/vapid-public-key', '/api/vaos/health'].includes(url.pathname);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    else if (!publicRead) throw new Error('AUTH_REQUIRED');
    return transport(url.href, { ...init, headers, redirect: 'error', credentials: 'same-origin' });
  };
}
