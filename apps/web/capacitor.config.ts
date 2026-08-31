import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'top.qisw.wenheng',
  appName: '问衡',
  webDir: 'dist',
  ios: {
    backgroundColor: '#F7F9FC',
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
  },
}

export default config
