import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'me.sharik.blockjr',
  appName: 'BlockJr',
  webDir: 'dist',
  // server: {
  //   url: 'http://localhost:5173',
  //   cleartext: true
  // },
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
