globalThis.fetch = async () => new Response(JSON.stringify({
  candidates: [{ content: { role: 'model', parts: [{ text: 'synthetic generation' }] } }],
  usageMetadata: { candidatesTokenCount: 12 },
}), { status: 200, headers: { 'Content-Type': 'application/json' } });
