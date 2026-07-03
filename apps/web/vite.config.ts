// 不用改 ts-nocheck，这里仅影响本配置文件的类型检查，不影响 src 代码
// @ts-nocheck
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import checker from 'vite-plugin-checker'
import basicSsl from '@vitejs/plugin-basic-ssl'
import path from 'path'

const basePath = (process.env.VITE_BASE_PATH || '/').replace(/\/+$/, '') || '/'
// 仅当 VITE_HTTPS=1 时启用自签 HTTPS（手机端摄像头需要安全上下文）；普通 dev 不受影响
const useHttps = process.env.VITE_HTTPS === '1'

export default defineConfig({
  base: basePath,
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      // 工作流走 Java Flowable 后端（更具体的前缀放前面，优先匹配）
      '/api/workflows': {
        target: process.env.VITE_WORKFLOW_TARGET || 'http://127.0.0.1:8090',
        changeOrigin: true,
        secure: false,
        xfwd: true,
      },
      // 其余 API 走 Node 后端
      '/api': {
        target: 'http://127.0.0.1:8848',
        changeOrigin: true,
        secure: false,
        xfwd: true,
      },
    },
  },
  plugins: [
    react(),
    tsconfigPaths(),
    // ✅ 开发时在终端 + 浏览器浮层显示 TypeScript 报错，和构建保持一致
    checker({
      typescript: true,
      // 如需同时检查 ESLint，可再加：
      // eslint: { lintCommand: 'eslint "./src/**/*.{ts,tsx}"' }
    }),
    ...(useHttps ? [basicSsl()] : []),
  ],
  resolve: {
    alias: {
      react: path.resolve(process.cwd(), 'node_modules/react'),
      'react-dom': path.resolve(process.cwd(), 'node_modules/react-dom'),
      dayjs: path.resolve(process.cwd(), 'node_modules/dayjs'),
    },
    dedupe: ['react', 'react-dom', 'scheduler', 'dayjs'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'dayjs'],
  },
})
