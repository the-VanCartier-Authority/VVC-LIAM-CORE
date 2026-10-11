import type {
  ApiClient,
  VaosDispatchPayload,
  VaosDispatchResult,
  VaosTaskDetail,
  VaosTelemetryPoint,
} from './types';

export class ApiClientAdapter implements ApiClient {
  private baseUrl: string;

  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
  }

  public async get<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
    const fullUrl = `${this.baseUrl}${url}`;
    const res = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Network response was not ok');
      throw new Error(`GET ${url} failed [${res.status}]: ${errText}`);
    }

    return res.json() as Promise<T>;
  }

  public async post<T>(url: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
    const fullUrl = `${this.baseUrl}${url}`;
    const res = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Network response was not ok');
      throw new Error(`POST ${url} failed [${res.status}]: ${errText}`);
    }

    return res.json() as Promise<T>;
  }

  public async dispatchVaos(payload: VaosDispatchPayload): Promise<VaosDispatchResult> {
    return this.post<VaosDispatchResult>('/api/vaos/dispatch', {
      ...payload,
      callerTimestamp: payload.callerTimestamp || Date.now(),
    });
  }

  public async getVaosTask(taskId: string): Promise<VaosTaskDetail> {
    return this.get<VaosTaskDetail>(`/api/vaos/task/${encodeURIComponent(taskId)}`);
  }

  public async getVaosTelemetry(): Promise<{
    points: VaosTelemetryPoint[];
    stats: {
      avgFastPathLatencyMs: number;
      avgAsyncDurationMs: number;
      avgTokensPerSec: number;
      totalDispatched: number;
      fastPathCount: number;
      asyncCount: number;
      p0Count: number;
      p1Count: number;
      p2Count: number;
    };
  }> {
    return this.get('/api/vaos/telemetry');
  }
}
