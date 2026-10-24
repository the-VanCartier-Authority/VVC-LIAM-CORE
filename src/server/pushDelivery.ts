import { ECDH } from 'node:crypto';
import { isIP } from 'node:net';
import webpush from 'web-push';
import { postProviderBytes } from './providerEgress.ts';
import type { Provider } from './providerEgress.ts';

export class PushError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string) { super(code); this.status = status; this.code = code; }
}
export type PushSubscription = Readonly<{ endpoint: string; expirationTime: number | null;
  keys: Readonly<{ p256dh: string; auth: string }> }>;
type Record = { ownerUid: string; subscription: PushSubscription };
type Sender = (sub: PushSubscription, payload: string) => Promise<number>;
const invalid = (): never => { throw new PushError(400, 'INVALID_PUSH_INPUT'); };

// Exact hostnames only, administered at boot. Ports, schemes and arbitrary local
// exceptions cannot be supplied by a client or enabled by this setting.
export class PushDestinations {
  private readonly hosts!: Set<string>;
  constructor(raw = '[]') {
    let extra: unknown;
    try { extra = JSON.parse(raw); } catch { return invalid(); }
    if (!Array.isArray(extra) || extra.length > 32 || extra.some(host =>
      typeof host !== 'string' || host.length > 253 || isIP(host) ||
      !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(host))) return invalid();
    this.hosts = new Set(['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com', ...extra]);
  }
  endpoint(value: unknown): string {
    if (typeof value !== 'string' || value.length > 4096 || /[\\\s\x00-\x1f]/.test(value)) return invalid();
    let url: URL;
    try { url = new URL(value); } catch { return invalid(); }
    if (url.protocol !== 'https:' || url.username || url.password || url.hash ||
        (url.port && url.port !== '443') || !this.hosts.has(url.hostname)) return invalid();
    return url.href;
  }
  subscription(input: unknown): PushSubscription {
    const sub = input as any;
    const endpoint = this.endpoint(sub?.endpoint);
    const key = (value: unknown, length: number) => {
      if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) return invalid();
      const decoded = Buffer.from(value, 'base64url');
      if (decoded.length !== length || decoded.toString('base64url') !== value) return invalid();
      return value;
    };
    const p256dh = key(sub?.keys?.p256dh, 65), auth = key(sub?.keys?.auth, 16);
    try {
      if (Buffer.from(p256dh, 'base64url')[0] !== 4) return invalid();
      ECDH.convertKey(Buffer.from(p256dh, 'base64url'), 'prime256v1');
    } catch { return invalid(); }
    if (sub.expirationTime != null && (!Number.isSafeInteger(sub.expirationTime) || sub.expirationTime <= Date.now())) return invalid();
    return Object.freeze({ endpoint, expirationTime: sub.expirationTime ?? null,
      keys: Object.freeze({ p256dh, auth }) });
  }
  provider(endpoint: string): Provider {
    return Object.freeze({ id: 'web-push', kind: 'openai-compatible', endpoint: this.endpoint(endpoint), allowByok: false });
  }
}

export function createPushSender(destinations: PushDestinations): Sender {
  return async (sub, payload) => {
    const provider = destinations.provider(sub.endpoint);
    const details = webpush.generateRequestDetails(sub, payload, { TTL: 60, contentEncoding: 'aes128gcm' });
    // Length is computed by our transport from the actual ciphertext.
    const headers = Object.fromEntries(Object.entries(details.headers).filter(([name]) => name.toLowerCase() !== 'content-length'));
    const response = await postProviderBytes(provider, details.body, headers, 15000);
    return response.status;
  };
}

export class PushRegistry {
  private readonly records = new Map<string, Record>();
  private readonly pending = new Map<string, number>();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private readonly active = new Map<string, number>();
  private activeTotal = 0;
  private readonly destinations: PushDestinations;
  private readonly sender: Sender;
  constructor(destinations: PushDestinations, sender: Sender) { this.destinations = destinations; this.sender = sender; }
  private prune() {
    for (const [endpoint, record] of this.records) {
      if (record.subscription.expirationTime !== null && record.subscription.expirationTime <= Date.now()) this.records.delete(endpoint);
    }
  }
  count(uid: string) { this.prune(); return [...this.records.values()].filter(record => record.ownerUid === uid).length; }
  subscribe(uid: string, input: unknown) {
    this.prune();
    const sub = this.destinations.subscription(input);
    const existing = this.records.get(sub.endpoint);
    if (existing && existing.ownerUid !== uid) throw new PushError(409, 'PUSH_REGISTRATION_CONFLICT');
    if (!existing && (this.count(uid) >= 5 || this.records.size >= 10000)) throw new PushError(429, 'PUSH_DEVICE_LIMIT');
    this.records.set(sub.endpoint, { ownerUid: uid, subscription: sub });
    return this.count(uid);
  }
  unsubscribe(uid: string, value: unknown) {
    const endpoint = this.destinations.endpoint(value);
    if (this.records.get(endpoint)?.ownerUid !== uid) throw new PushError(404, 'PUSH_NOT_FOUND');
    this.records.delete(endpoint);
    return this.count(uid);
  }
  async dispatch(uid: string, payload: string) {
    if ((this.active.get(uid) || 0) >= 2 || this.activeTotal >= 8) throw new PushError(429, 'PUSH_CONCURRENCY_LIMIT');
    this.active.set(uid, (this.active.get(uid) || 0) + 1); this.activeTotal++;
    try { return await this.dispatchOwned(uid, payload); }
    finally {
      this.activeTotal--;
      const count = (this.active.get(uid) || 1) - 1;
      if (count) this.active.set(uid, count); else this.active.delete(uid);
    }
  }
  private async dispatchOwned(uid: string, payload: string) {
    this.prune();
    const candidates = [...this.records.entries()].filter(([, record]) => record.ownerUid === uid);
    let sent = 0, failed = 0;
    for (const [endpoint, record] of candidates) {
      // Recheck after every await. Logout/unsubscribe/replacement must not restore
      // a stale candidate or delete a fresh registration when a send fails.
      if (this.records.get(endpoint) !== record) continue;
      try {
        const status = await this.sender(record.subscription, payload);
        if (status >= 200 && status < 300) sent++;
        else {
          failed++;
          if ([404, 410].includes(status) && this.records.get(endpoint) === record) this.records.delete(endpoint);
        }
      } catch { failed++; } // No endpoint/keys in logs or HTTP responses.
    }
    return { sent, failed, total: this.count(uid), delivery: 'service_acceptance_only' as const };
  }
  schedule(uid: string, payload: string, delayMs: number) {
    if ((this.pending.get(uid) || 0) >= 10 || this.timers.size >= 100) throw new PushError(429, 'PUSH_SCHEDULE_LIMIT');
    this.pending.set(uid, (this.pending.get(uid) || 0) + 1);
    const timer = setTimeout(async () => {
      try { await this.dispatch(uid, payload); }
      catch { /* Volatile schedule cannot promise delivery, including at capacity. */ }
      finally {
        this.timers.delete(timer);
        const count = (this.pending.get(uid) || 1) - 1;
        if (count) this.pending.set(uid, count); else this.pending.delete(uid);
      }
    }, delayMs);
    timer.unref(); this.timers.add(timer);
  }
  dispose() { for (const timer of this.timers) clearTimeout(timer); this.timers.clear(); this.pending.clear(); }
}

export function pushPayload(input: any): { payload: string; delayMs: number } {
  const text = (value: unknown, fallback: string, max: number) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || value.length > max) return invalid();
    return value;
  };
  const path = (value: unknown, fallback: string) => {
    const result = text(value, fallback, 1024);
    // Notification navigation and image fetches must remain on this application.
    if (!result.startsWith('/') || result.startsWith('//') || /[\\\s\x00-\x1f]/.test(result)) return invalid();
    return result;
  };
  const delayMs = input?.delayMs ?? 0;
  if (!Number.isSafeInteger(delayMs) || delayMs < 0 || delayMs > 86400000) return invalid();
  const payload = JSON.stringify({ title: text(input?.title, 'VVC LIAM CORE // Alerta', 200),
    body: text(input?.body, 'Alerta o recordatorio.', 2000), icon: path(input?.icon, '/pwa-192x192.png'),
    badge: path(input?.badge, '/pwa-192x192.png'), url: path(input?.url, '/'),
    tag: text(input?.tag, `vvc-alert-${Date.now()}`, 200), taskId: text(input?.taskId, '', 200), timestamp: Date.now() });
  if (Buffer.byteLength(payload) > 3000) return invalid();
  return { payload, delayMs };
}
