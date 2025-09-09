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
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      // 仅保留必要的额外别名（如果需要）
      dayjs: path.resolve(process.cwd(), 'node_modules/dayjs'),
    },
    dedupe: ['dayjs'],
  },
  optimizeDeps: {
    include: ['dayjs'],
  },
})
