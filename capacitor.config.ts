import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.kingoftrade.app',
  appName: 'King of Trade',
  webDir: 'dist',
  android: { allowMixedContent: false },
  plugins: { CapacitorHttp: { enabled: true } },
}

export default config
