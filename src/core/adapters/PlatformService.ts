import { DeviceAdapter } from './DeviceAdapter';
import { ApiClientAdapter } from './ApiClientAdapter';
import type { DeviceCapabilities, ApiClient, PlatformType } from './types';

export class PlatformService {
  private static instance: PlatformService;
  public readonly device: DeviceCapabilities;
  public readonly api: ApiClient;

  private constructor() {
    this.device = new DeviceAdapter();
    this.api = new ApiClientAdapter();
  }

  public static getInstance(): PlatformService {
    if (!PlatformService.instance) {
      PlatformService.instance = new PlatformService();
    }
    return PlatformService.instance;
  }

  public getPlatform(): PlatformType {
    return this.device.getPlatform();
  }

  public isNative(): boolean {
    return this.device.isNativeApp();
  }
}

export const platformService = PlatformService.getInstance();
