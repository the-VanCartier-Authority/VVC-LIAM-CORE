export interface CapacitorConfig {
  appId: string;
  appName: string;
  webDir: string;
  bundledWebRuntime?: boolean;
  server?: {
    androidScheme?: string;
    cleartext?: boolean;
    url?: string;
  };
  backgroundColor?: string;
  android?: {
    buildOptions?: {
      keystorePath?: string;
      releaseType?: string;
    };
    allowMixedContent?: boolean;
    captureInput?: boolean;
  };
  ios?: {
    contentInset?: string;
  };
  plugins?: Record<string, Record<string, unknown>>;
}

/**
 * VVC LIAM CORE // Multiplatform Capacitor & WebView Wrapper Configuration
 * Prepares universal distribution: PWA -> Android APK / iOS / Windows Desktop
 * Identity: Control // Analyze // Execute
 */
const config: CapacitorConfig = {
  appId: 'com.vvcliam.core',
  appName: 'VVC LIAM CORE',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  backgroundColor: '#0A060D',
  android: {
    buildOptions: {
      keystorePath: undefined,
      releaseType: 'APK',
    },
    allowMixedContent: false,
    captureInput: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1800,
      launchAutoHide: true,
      backgroundColor: '#0A060D',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: true,
      spinnerColor: '#00FF66',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0A060D',
    },
  },
};

export default config;
