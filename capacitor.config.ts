import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'net.mm9pdy.codeplugstudio',
  appName: 'Codeplug Studio',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 300,
      backgroundColor: '#0f172a',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
};

export default config;
