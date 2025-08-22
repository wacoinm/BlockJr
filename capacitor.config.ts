import type { CapacitorConfig } from '@capacitor/cli';

const isDev = process.env.NODE_ENV === 'development';

const config: CapacitorConfig = {
  appId: 'me.sharik.blockjr',
  appName: 'BlockJr',
  webDir: 'dist',
  ...(isDev && {
    server: {
      url: 'http://10.0.2.2:5173',
      cleartext: true
    }
  }),
  android: {
    buildOptions: {
      keystorePath: 'app/sharik.keystore',
      keystorePassword: 'sharik9461SH!',
      keystoreAlias: 'sharik',
      keystoreAliasPassword: 'sharik9461SH!',
      releaseType: 'APK'
    }
  }
};

export default config;
