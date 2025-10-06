// 不用改 ts-nocheck，这里仅影响本配置文件的类型检查，不影响 src 代码
// @ts-nocheck
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import checker from 'vite-plugin-checker'
import path from 'path'

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
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
