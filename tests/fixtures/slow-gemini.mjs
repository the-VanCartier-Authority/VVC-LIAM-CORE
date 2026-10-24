globalThis.fetch = async () => {
  await new Promise(resolve => setTimeout(resolve, 200));
  return new Response('{"error":{"code":401,"message":"synthetic refusal"}}', {
    status: 401, headers: { 'Content-Type': 'application/json' },
  });
};
