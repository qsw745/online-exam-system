// @ts-nocheck
// apps/web/vite.config.ts
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

// 用异步工厂，动态 import 以避免 TS 对类型/默认导出的挑剔
export default defineConfig(async () => {
  // 动态加载 node 内置模块与 react 插件，避免 2307/2306/1192
  const path = await import('path')
  const { default: react } = await import('@vitejs/plugin-react')

  return {
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true, // ← 端口占用时直接报错，不自动换端口
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    // 插件：React + tsconfig 路径别名
    plugins: [react(), tsconfigPaths()],

    // 路径别名（避免 __dirname，直接用 cwd 更稳）
    resolve: {
      alias: {
        dayjs: path.resolve(process.cwd(), 'node_modules/dayjs'),
      },
      dedupe: ['dayjs'],
    },

    // 预优化
    optimizeDeps: {
      include: ['dayjs'],
    },
  }
})
