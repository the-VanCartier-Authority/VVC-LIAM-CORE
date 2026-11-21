import type { ErrorRequestHandler, RequestHandler } from 'express';

const defaults = { requestsPerMinute: 120, concurrentRequestsPerUser: 4, concurrentRequestsGlobal: 64,
  concurrentTasksPerUser: 2, concurrentTasksGlobal: 8, tokenReservationsPerDay: 1000000 };
type Limits = typeof defaults;
type Bucket = { window: number; count: number; day: number; tokens: number; requests: number; tasks: number };
export class ResourceLimitError extends Error {
  readonly status: number;
  readonly retryAfter: number;
  constructor(status = 429, retryAfter = 60) { super('Límite de recursos alcanzado.'); this.status = status; this.retryAfter = retryAfter; }
}
export class BackendLimits {
  private readonly config: Limits;
  private buckets = new Map<string, Bucket>();
  private requests = 0;
  private tasks = 0;
  private now: () => number;
  constructor(raw = '{}', now = () => Date.now()) {
    this.now = now;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).some(key =>
      !Object.hasOwn(defaults, key) || !Number.isSafeInteger(parsed[key]) || parsed[key] < 1 || parsed[key] > 10000000))
      throw new Error('INVALID_BACKEND_LIMITS');
    this.config = Object.freeze({ ...defaults, ...parsed });
  }
  private bucket(uid: string): Bucket {
    if (!uid) throw new Error('VERIFIED_OWNER_REQUIRED');
    const now = this.now(), day = Math.floor(now / 86400000);
    for (const [key, value] of this.buckets) if (value.day < day && !value.requests && !value.tasks) this.buckets.delete(key);
    let bucket = this.buckets.get(uid);
    if (!bucket) {
      if (this.buckets.size >= 10000) throw new ResourceLimitError(503);
      bucket = { window: now, count: 0, day, tokens: 0, requests: 0, tasks: 0 };
      this.buckets.set(uid, bucket);
    }
    if (now - bucket.window >= 60000) { bucket.window = now; bucket.count = 0; }
    if (bucket.day !== day) { bucket.day = day; bucket.tokens = 0; }
    return bucket;
  }
  request(uid: string): () => void {
    const bucket = this.bucket(uid);
    if (++bucket.count > this.config.requestsPerMinute) throw new ResourceLimitError(429,
      Math.max(1, Math.ceil((60000 - (this.now() - bucket.window)) / 1000)));
    if (bucket.requests >= this.config.concurrentRequestsPerUser || this.requests >= this.config.concurrentRequestsGlobal)
      throw new ResourceLimitError(429, 1);
    bucket.requests++; this.requests++;
    let released = false;
    return () => { if (!released) { released = true; bucket.requests--; this.requests--; } };
  }
  reserveGeneration(uid: string, attempts = 3) {
    const bucket = this.bucket(uid), maximum = 4096 * attempts;
    if (bucket.tokens + maximum > this.config.tokenReservationsPerDay) throw new ResourceLimitError(429,
      Math.max(1, Math.ceil(((bucket.day + 1) * 86400000 - this.now()) / 1000)));
    bucket.tokens += maximum; // Conservative reservation, never reported as measured use or billing.
  }
  task(uid: string): () => void {
    const bucket = this.bucket(uid);
    if (bucket.tasks >= this.config.concurrentTasksPerUser || this.tasks >= this.config.concurrentTasksGlobal)
      throw new ResourceLimitError(429, 1);
    bucket.tasks++; this.tasks++;
    let released = false;
    return () => { if (!released) { released = true; bucket.tasks--; this.tasks--; } };
  }
  middleware(): RequestHandler {
    return (req, res, next) => {
      if (!req.auth) return next(); // Only the explicit public GET allowlist reaches this without auth.
      try {
        const release = this.request(req.auth.uid);
        const timer = setTimeout(() => { release(); res.destroy(); }, 120000);
        timer.unref();
        res.once('finish', () => { clearTimeout(timer); release(); });
        // On disconnect keep the slot until the bounded deadline; provider work can
        // still be running. Do not allow early disconnects to bypass concurrency.
        next();
      } catch (error) { next(error); }
    };
  }
  payload(): RequestHandler {
    return (req, _res, next) => {
      if (!req.auth || req.method !== 'POST') return next();
      try {
        const body = req.body || {};
        const invalid = () => { throw new ResourceLimitError(400); };
        if (body.max_tokens !== undefined && (!Number.isInteger(body.max_tokens) || body.max_tokens < 1 || body.max_tokens > 4096)) invalid();
        if (body.temperature !== undefined && (typeof body.temperature !== 'number' || !Number.isFinite(body.temperature) || body.temperature < 0 || body.temperature > 2)) invalid();
        for (const [field, maximum] of [['prompt', 32000], ['systemInstruction', 32000], ['text', 8000], ['command', 5000], ['model', 200], ['agentId', 200], ['title', 200], ['body', 4000]] as const)
          if (body[field] !== undefined && (typeof body[field] !== 'string' || body[field].length > maximum)) invalid();
        if (body.messages !== undefined) {
          if (!Array.isArray(body.messages) || body.messages.length > 64) invalid();
          let characters = 0;
          for (const message of body.messages) {
            if (!message || typeof message.content !== 'string' || message.content.length > 32000 ||
                !['system', 'user', 'assistant'].includes(message.role)) invalid();
            characters += message.content.length;
          }
          if (characters > 64000) invalid();
        }
        if (body.injectedSkills !== undefined && (!Array.isArray(body.injectedSkills) || body.injectedSkills.length > 32 ||
            body.injectedSkills.some((skill: unknown) => typeof skill !== 'string' || skill.length > 500))) invalid();
        if (req.path.startsWith('/chat/') || req.path === '/vaos/dispatch' || req.path === '/secrets/test')
          this.reserveGeneration(req.auth.uid, req.path === '/chat/gemini' || req.path === '/secrets/test' ? 1 : 3);
        if (req.path === '/tts') this.reserveGeneration(req.auth.uid, 5);
        next();
      } catch (error) { next(error); }
    };
  }
}

export const resourceErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  const status = error instanceof ResourceLimitError ? error.status : error?.type === 'entity.too.large' ? 413
    : error instanceof SyntaxError && 'status' in error && error.status === 400 ? 400 : undefined;
  if (!status) return next(error);
  if (error instanceof ResourceLimitError && status === 429) res.setHeader('Retry-After', String(error.retryAfter));
  return res.status(status).json({ code: status === 429 || status === 503 ? 'RESOURCE_LIMIT' : status === 413 ? 'PAYLOAD_TOO_LARGE' : 'INVALID_REQUEST',
    error: status === 429 ? 'Límite de recursos alcanzado. Inténtalo más tarde.' : 'Petición fuera de los límites permitidos.',
    outcome: { status: 'failed', realExecution: false, source: 'server-policy' } });
};
