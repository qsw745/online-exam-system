import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'top.qisw.wenheng',
  appName: '问衡',
  webDir: 'dist',
  plugins: {
    // Use iOS networking and its cookie store for the HttpOnly refresh session.
    CapacitorHttp: { enabled: true },
  },
  ios: {
    backgroundColor: '#F7F9FC',
    // 页面已经通过 safe-area-inset-* 处理安全区，避免原生滚动容器重复留白。
    contentInset: 'never',
    preferredContentMode: 'mobile',
  },
}

export default config
