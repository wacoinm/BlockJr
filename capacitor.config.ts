import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'me.sharik.blockjr',
  appName: 'کمانک',
  webDir: 'dist',
  // server: {
  //   url: 'http://192.168.0.109:5173',
  //   cleartext: true
  // },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      launchFadeOutDuration: 300,
      backgroundColor: "#ffffffff",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      spinnerColor: "#999999",
      splashFullScreen: true,
      splashImmersive: true
    },
    EdgeToEdge: {
      backgroundColor: "#694db9",
    },
    ScreenOrientation: {
      allowOrientationChange: false,
      orientation: "portrait"
    }
  }
};

export default config;
