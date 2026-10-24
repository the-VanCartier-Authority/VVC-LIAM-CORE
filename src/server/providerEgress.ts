import { assertNotAborted, withCancellation, RequestAbortedError } from './requestCancellation.ts';
// Server-only provider registry and transport. Never import from browser code.
import { lookup as dnsLookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { RequestOptions } from 'node:https';
import type { TLSSocket } from 'node:tls';

type Kind = 'nvidia' | 'gemini' | 'openai-compatible' | 'ollama' | 'vllm';
type LocalException = Readonly<{ providerId: string; hostname: string; port: number; addresses: readonly string[] }>;
export type Provider = Readonly<{
  id: string; kind: Kind; endpoint: string; allowByok: boolean;
  apiKeyEnv?: string; localException?: LocalException;
}>;
type Address = { address: string; family: number };
export type Resolver = (hostname: string) => Promise<Address[]>;
export class EgressPolicyError extends Error {
  readonly code = 'EGRESS_POLICY';
  constructor() { super('Destino o credencial no permitido por la política del servidor.'); }
}
export class UpstreamError extends Error {
  readonly code = 'UPSTREAM_ERROR';
  constructor() { super('No se pudo completar la petición al proveedor.'); }
}
class ConnectError extends UpstreamError {}
const deny = (): never => { throw new EgressPolicyError(); };
const hostOf = (url: URL) => url.hostname.replace(/^\[|\]$/g, '');
const portOf = (url: URL) => Number(url.port || (url.protocol === 'https:' ? 443 : 80));

function parseEndpoint(value: unknown): URL {
  if (typeof value !== 'string' || !value.trim() || /[\\\s]/.test(value.trim())) return deny();
  let url: URL;
  try { url = new URL(value.trim()); } catch { return deny(); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password ||
      url.search || url.hash || url.hostname.endsWith('.')) return deny();
  return url;
}

export class ProviderRegistry {
  private readonly providers!: readonly Provider[];
  constructor(raw = '[]') {
    let config: unknown;
    try { config = JSON.parse(raw); } catch { return deny(); }
    if (!Array.isArray(config)) return deny();
    const providers: Provider[] = [
      Object.freeze({ id: 'nvidia', kind: 'nvidia', endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions', apiKeyEnv: 'NVIDIA_API_KEY', allowByok: true }),
      Object.freeze({ id: 'gemini', kind: 'gemini', endpoint: 'https://generativelanguage.googleapis.com/v1beta', apiKeyEnv: 'GEMINI_API_KEY', allowByok: true }),
    ];
    for (const item of config) {
      if (!item || typeof item !== 'object' || Array.isArray(item) ||
          Object.keys(item).some(k => !['id', 'kind', 'endpoint', 'apiKeyEnv', 'allowByok', 'localException'].includes(k)) ||
          typeof item.id !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(item.id) ||
          providers.some(p => p.id === item.id) ||
          !['nvidia', 'openai-compatible', 'ollama', 'vllm'].includes(item.kind) ||
          typeof item.allowByok !== 'boolean') return deny();
      const url = parseEndpoint(item.endpoint);
      if (providers.some(p => p.endpoint === url.href)) return deny();
      if (item.apiKeyEnv !== undefined && (typeof item.apiKeyEnv !== 'string' ||
          !/^[A-Z][A-Z0-9_]*$/.test(item.apiKeyEnv) ||
          ['NVIDIA_API_KEY', 'GEMINI_API_KEY'].includes(item.apiKeyEnv))) return deny();
      let localException: LocalException | undefined;
      if (item.localException !== undefined) {
        const local = item.localException;
        if (!local || typeof local !== 'object' || Array.isArray(local) ||
            Object.keys(local).some(k => !['providerId', 'hostname', 'port', 'addresses'].includes(k)) ||
            local.providerId !== item.id || local.hostname !== hostOf(url) ||
            !Number.isInteger(local.port) || local.port !== portOf(url)) return deny();
        const addresses = local.addresses ?? (isIP(hostOf(url)) ? [hostOf(url)] : undefined);
        if (!Array.isArray(addresses) || !addresses.length || addresses.length > 16 ||
            addresses.some(address => typeof address !== 'string' || !isLocalAddress(address))) return deny();
        localException = Object.freeze({ providerId: local.providerId, hostname: local.hostname,
          port: local.port, addresses: Object.freeze([...addresses]) });
      }
      if (url.protocol === 'http:' && !localException) return deny();
      providers.push(Object.freeze({ id: item.id, kind: item.kind, endpoint: url.href,
        apiKeyEnv: item.apiKeyEnv, allowByok: item.allowByok, localException }));
    }
    this.providers = Object.freeze(providers);
  }

  select(route: 'nvidia' | 'gemini' | 'custom', input: { providerId?: unknown; endpoint?: unknown }): Provider {
    const compatible = (p: Provider) => route === 'custom'
      ? ['openai-compatible', 'ollama', 'vllm'].includes(p.kind) : p.kind === route;
    const endpoint = input.endpoint === undefined || input.endpoint === '' ? undefined : parseEndpoint(input.endpoint).href;
    if (input.providerId !== undefined && typeof input.providerId !== 'string') return deny();
    const provider = input.providerId !== undefined
      ? this.providers.find(p => p.id === input.providerId && compatible(p))
      : endpoint ? this.providers.find(p => p.endpoint === endpoint && compatible(p))
        : this.providers.find(p => p.id === route && compatible(p));
    if (!provider || (endpoint !== undefined && provider.endpoint !== endpoint)) return deny();
    return provider;
  }
}

export function providerKey(provider: Provider, byok: unknown, env: NodeJS.ProcessEnv = process.env): string {
  if (byok !== undefined && typeof byok !== 'string') return deny();
  const key = typeof byok === 'string' ? byok.trim() : '';
  if (key && !provider.allowByok) return deny();
  const selected = key || (provider.apiKeyEnv ? env[provider.apiKeyEnv]?.trim() : '') || '';
  if (/[\r\n\x00]/.test(selected) || selected.length > 8192) return deny();
  return /^MY_.*_API_KEY$/.test(selected) ? '' : selected;
}

const blockedV4 = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3],
] as const) blockedV4.addSubnet(address, prefix, 'ipv4');
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');
const blockedV6 = new BlockList();
for (const [address, prefix] of [['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20]] as const)
  blockedV6.addSubnet(address, prefix, 'ipv6');
const localAddresses = new BlockList();
for (const [address, prefix] of [['10.0.0.0', 8], ['127.0.0.0', 8], ['172.16.0.0', 12], ['192.168.0.0', 16]] as const)
  localAddresses.addSubnet(address, prefix, 'ipv4');
const localV6Addresses = new BlockList();
localV6Addresses.addAddress('::1', 'ipv6');
localV6Addresses.addSubnet('fc00::', 7, 'ipv6');
const familyOf = (address: string) => isIP(address) === 4 ? 'ipv4' : 'ipv6';
function isLocalAddress(address: string): boolean {
  return isIP(address) === 4 ? localAddresses.check(address, 'ipv4')
    : isIP(address) === 6 && localV6Addresses.check(address, 'ipv6');
}
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  return family === 4 ? !blockedV4.check(address, 'ipv4')
    : family === 6 && globalV6.check(address, 'ipv6') && !blockedV6.check(address, 'ipv6');
}

export async function resolveProvider(provider: Provider, resolve: Resolver = hostname => dnsLookup(hostname, { all: true, verbatim: true })): Promise<Address[]> {
  const url = new URL(provider.endpoint);
  const host = hostOf(url);
  const literalFamily = isIP(host);
  const addresses = literalFamily ? [{ address: host, family: literalFamily }] : await resolve(host);
  if (!addresses.length) return deny();
  const exception = provider.localException;
  const permitsLocal = exception?.providerId === provider.id && exception.hostname === host && exception.port === portOf(url);
  const allowedLocalIPs = new BlockList();
  if (permitsLocal) for (const address of exception.addresses) allowedLocalIPs.addAddress(address, familyOf(address));
  for (const entry of addresses) {
    if (!isIP(entry.address) || isIP(entry.address) !== entry.family) return deny();
    const local = isLocalAddress(entry.address) && allowedLocalIPs.check(entry.address, familyOf(entry.address));
    if ((!isPublicAddress(entry.address) && !(permitsLocal && local)) ||
        (url.protocol === 'http:' && !(permitsLocal && local))) return deny();
  }
  return addresses;
}

export function assertConnectedPeer(addresses: Address[], address: string | undefined, port: number | undefined, expectedPort: number) {
  if (!address || !isIP(address) || port !== expectedPort) return deny();
  const pinned = new BlockList();
  for (const entry of addresses) pinned.addAddress(entry.address, familyOf(entry.address));
  if (!pinned.check(address, familyOf(address))) return deny();
}

// Each call (including NVIDIA's retry) gets a fresh validated DNS snapshot. Only the
// pinned IPs are dialled, without pooling, implicit retries, redirects or proxy agents.
// Host/SNI/certificate validation keep the registered hostname. No HTTP bytes leave
// until the actual peer and, for HTTPS, the authenticated TLS connection are checked.
export async function postProvider(provider: Provider, key: string, payload: unknown, timeoutMs = 45000,
  resolve?: Resolver, signal?: AbortSignal): Promise<Response> {
  assertNotAborted(signal);
  return postEncoded(provider, Buffer.from(JSON.stringify(payload)), {
    'Content-Type': 'application/json', Accept: 'application/json',
    ...(key ? { Authorization: `Bearer ${key}` } : {}),
  }, timeoutMs, resolve, signal);
}

// For server-generated Web Push ciphertext only. No arbitrary headers, agents or
// caller-controlled connection options; the same pinned transport remains in use.
export async function postProviderBytes(provider: Provider, body: Buffer, headers: Record<string, string | number>,
  timeoutMs = 15000, resolve?: Resolver, signal?: AbortSignal): Promise<Response> {
  const allowed = new Set(['authorization', 'content-type', 'content-encoding', 'ttl', 'urgency', 'topic', 'crypto-key', 'encryption']);
  const validated: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (!allowed.has(name.toLowerCase()) || !['string', 'number'].includes(typeof value) ||
        /[\r\n\x00]/.test(String(value))) return deny();
    validated[name] = value;
  }
  if (!Buffer.isBuffer(body) || body.length > 4096) return deny();
  return postEncoded(provider, body, validated, timeoutMs, resolve, signal);
}

async function postEncoded(provider: Provider, body: Buffer, headers: Record<string, string | number>,
  timeoutMs: number, resolve?: Resolver, signal?: AbortSignal): Promise<Response> {
  assertNotAborted(signal);
  const started = Date.now();
  let dnsTimer: ReturnType<typeof setTimeout>;
  let addresses: Address[];
  try {
    addresses = await withCancellation(Promise.race([
      resolveProvider(provider, resolve),
      new Promise<never>((_, reject) => { dnsTimer = setTimeout(() => reject(new UpstreamError()), Math.min(timeoutMs, 5000)); }),
    ]), signal);
  } catch (error) {
    assertNotAborted(signal);
    throw error instanceof EgressPolicyError ? error : new UpstreamError();
  } finally { clearTimeout(dnsTimer!); }
  const deadline = started + timeoutMs;
  for (let index = 0; index < addresses.length; index++) {
    assertNotAborted(signal);
    try { return await sendPinned(provider, body, headers, addresses[index], deadline, signal); }
    catch (error) {
      // Dual-stack/network fallback is allowed only before any HTTP bytes were sent,
      // to another IP in the same validated snapshot. TLS/policy errors stop here.
      if (!(error instanceof ConnectError) || index === addresses.length - 1 || Date.now() >= deadline) throw error;
    }
  }
  throw new UpstreamError();
}

async function sendPinned(provider: Provider, body: Buffer, headers: Record<string, string | number>, pinned: Address, deadline: number, signal?: AbortSignal): Promise<Response> {
  assertNotAborted(signal);
  const url = new URL(provider.endpoint);
  return new Promise((resolveResponse, reject) => {
    let transmitted = false;
    const secure = url.protocol === 'https:';
    const request = secure ? httpsRequest : httpRequest;
    const options: RequestOptions & { autoSelectFamily: boolean } = {
      method: 'POST', agent: false, autoSelectFamily: false, signal,
      lookup: (_hostname, _options, callback) => callback(null, pinned.address, pinned.family),
      headers: { ...headers, 'Content-Length': body.length },
      ...(secure ? { rejectUnauthorized: true, servername: isIP(hostOf(url)) ? undefined : hostOf(url) } : {}),
    };
    const req = request(url, options);
    const timer = setTimeout(() => req.destroy(new UpstreamError()), Math.max(1, deadline - Date.now()));
    req.once('error', (error: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      if (signal?.aborted) reject(new RequestAbortedError());
      else if (error instanceof EgressPolicyError) reject(error);
      else if (!transmitted && ['ECONNREFUSED', 'ENETUNREACH', 'EHOSTUNREACH', 'ETIMEDOUT'].includes(error.code || '')) reject(new ConnectError());
      else reject(new UpstreamError());
    });
    req.once('socket', socket => {
      socket.once(secure ? 'secureConnect' : 'connect', () => {
        try {
          assertNotAborted(signal);
          assertConnectedPeer([pinned], socket.remoteAddress, socket.remotePort, portOf(url));
          if (secure && !(socket as TLSSocket).authorized) return deny();
          transmitted = true;
          req.end(body);
        } catch (error) { req.destroy(error as Error); }
      });
    });
    req.once('response', response => {
      if (signal?.aborted) { clearTimeout(timer); response.destroy(); req.destroy(); reject(new RequestAbortedError()); return; }
      const status = response.statusCode || 502;
      if (status >= 300 && status < 400) {
        clearTimeout(timer); response.destroy(); req.destroy(); reject(new EgressPolicyError()); return;
      }
      if (status >= 400) {
        clearTimeout(timer); response.destroy(); resolveResponse(new Response(null, { status })); return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > 4 * 1024 * 1024) {
          clearTimeout(timer); response.destroy(); req.destroy(); reject(new UpstreamError());
        }
        else chunks.push(chunk);
      });
      response.once('error', () => { clearTimeout(timer); reject(signal?.aborted ? new RequestAbortedError() : new UpstreamError()); });
      response.once('aborted', () => { clearTimeout(timer); reject(signal?.aborted ? new RequestAbortedError() : new UpstreamError()); });
      response.once('end', () => {
        clearTimeout(timer);
        if (signal?.aborted) { reject(new RequestAbortedError()); return; }
        const body = status === 204 || status === 205 ? null : Buffer.concat(chunks);
        resolveResponse(new Response(body, { status, headers: { 'Content-Type': 'application/json' } }));
      });
    });
  });
}
