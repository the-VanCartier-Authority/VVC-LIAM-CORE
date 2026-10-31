globalThis.fetch = async () => new Response(JSON.stringify({ error: { code: 401, message: 'synthetic provider refusal' } }),
  { status: 401, headers: { 'Content-Type': 'application/json' } });
