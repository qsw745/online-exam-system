// @ts-nocheck
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
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
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      // ✅ 强制全项目仅用这份 React/ReactDOM，避免出现第二份 React 导致 Hook 报错
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
