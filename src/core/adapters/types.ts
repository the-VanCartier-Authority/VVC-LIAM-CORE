/**
 * VVC LIAM CORE // Multiplatform Agnostic Adapter Interfaces
 * Decouples UI and business logic from specific platform runtimes
 * Supported targets: PWA (Universal Web), Android (Capacitor/WebView), iOS, Windows (Desktop WebView2)
 */

export type PlatformType = 'pwa' | 'android' | 'ios' | 'windows' | 'web';

export interface DeviceBatteryInfo {
  level: number | null; // 0.0 to 1.0, or unavailable
  charging: boolean | null;
  chargingTime: number | null;
  dischargingTime: number | null;
  source: 'browser' | 'unavailable';
  temperatureEstimatedC?: number | null;
  healthProfile?: 'OPTIMAL' | 'NORMAL' | 'LOW_POWER';
}

export interface DeviceCapabilities {
  getPlatform(): PlatformType;
  isNativeApp(): boolean;
  getBatteryInfo(): Promise<DeviceBatteryInfo>;
  vibrate(pattern: number | number[]): boolean;
  toggleTorch(enabled: boolean): Promise<boolean>;
  requestNotificationPermission(): Promise<NotificationPermission>;
  showNotification(title: string, options?: NotificationOptions): Promise<boolean>;
  copyToClipboard(text: string): Promise<boolean>;
  getStorageItem<T>(key: string, defaultValue: T): T;
  setStorageItem<T>(key: string, value: T): void;
}

export type TaskPriority = 'P0_CRITICAL' | 'P1_HIGH' | 'P2_LOW';
export type TaskRoute = 'FAST_PATH' | 'ASYNC_PATH';
export type TaskExecutionStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'UNAVAILABLE' | 'CANCELLED' | 'INTERRUPTED';

export interface VaosDispatchPayload {
  command: string;
  agentId?: string;
  isExclusiveAgent?: boolean;
  injectedSkills?: string[];
  context?: Record<string, unknown>;
  forcePriority?: TaskPriority;
  callerTimestamp?: number;
}

export interface VaosTelemetryPoint {
  timestamp: number;
  taskId: string;
  command: string;
  priority: TaskPriority;
  route: TaskRoute;
  latencyMs: number;
  tokensPerSec: number | null;
  tokensSource: 'provider' | 'estimated' | 'unavailable';
  latencyScope: 'policy_routing' | 'processing_wall_time';
  success: boolean;
  agentId: string;
}

export interface VaosDispatchResult {
  route: TaskRoute;
  priority: TaskPriority;
  policyApproved: boolean;
  policyReason?: string;
  // If Fast Path:
  immediateResponse?: {
    text: string;
    actionType?: string;
    latencyMs: number;
    tokensPerSec: number | null;
    handledBy: string;
    data?: Record<string, unknown>;
  };
  // If Async Path:
  asyncTask?: {
    taskId: string;
    status: TaskExecutionStatus;
    estimatedDurationMs?: number;
    durable?: boolean;
    durabilityScope?: string;
    queuePosition: number;
    pollUrl: string;
  };
}

export interface VaosTaskDetail {
  taskId: string;
  command: string;
  agentId: string;
  priority: TaskPriority;
  status: TaskExecutionStatus;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  result?: {
    text: string;
    actionType?: string;
    tokensPerSec?: number | null;
    data?: Record<string, unknown>;
  };
  error?: string;
}

export interface ApiClient {
  get<T>(url: string, headers?: Record<string, string>): Promise<T>;
  post<T>(url: string, body: unknown, headers?: Record<string, string>): Promise<T>;
  dispatchVaos(payload: VaosDispatchPayload, idempotencyKey?: string): Promise<VaosDispatchResult>;
  getVaosTask(taskId: string): Promise<VaosTaskDetail>;
  getVaosTelemetry(): Promise<{
    points: VaosTelemetryPoint[];
    stats: {
      avgFastPathLatencyMs: number | null;
      avgAsyncDurationMs: number | null;
      avgTokensPerSec: number | null;
      totalDispatched: number;
      fastPathCount: number;
      asyncCount: number;
      p0Count: number;
      p1Count: number;
      p2Count: number;
    };
  }>;
}
