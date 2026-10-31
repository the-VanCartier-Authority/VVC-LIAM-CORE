/**
 * VVC LIAM CORE // Multiplatform Agnostic Adapter Interfaces
 * Decouples UI and business logic from specific platform runtimes
 * Supported targets: PWA (Universal Web), Android (Capacitor/WebView), iOS, Windows (Desktop WebView2)
 */

export type PlatformType = 'pwa' | 'android' | 'ios' | 'windows' | 'web';

export interface DeviceBatteryInfo {
  level: number; // 0.0 to 1.0
  charging: boolean;
  chargingTime: number; // in seconds, or Infinity
  dischargingTime: number; // in seconds, or Infinity
  temperatureEstimatedC?: number;
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
export type TaskExecutionStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'UNAVAILABLE';

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
  tokensPerSec: number;
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
    tokensPerSec: number;
    handledBy: string;
    data?: Record<string, unknown>;
  };
  // If Async Path:
  asyncTask?: {
    taskId: string;
    status: TaskExecutionStatus;
    estimatedDurationMs: number;
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
    tokensPerSec?: number;
    data?: Record<string, unknown>;
  };
  error?: string;
}

export interface ApiClient {
  get<T>(url: string, headers?: Record<string, string>): Promise<T>;
  post<T>(url: string, body: unknown, headers?: Record<string, string>): Promise<T>;
  dispatchVaos(payload: VaosDispatchPayload): Promise<VaosDispatchResult>;
  getVaosTask(taskId: string): Promise<VaosTaskDetail>;
  getVaosTelemetry(): Promise<{
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
  }>;
}
