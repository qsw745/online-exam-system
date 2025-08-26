// apps/web/vite.config.ts
import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000', // ← 改成 127.0.0.1
        changeOrigin: true,
        secure: false
      }
    }
  },
  plugins: [react()],
  resolve: {
    alias: { dayjs: path.resolve(__dirname, 'node_modules/dayjs') },
    dedupe: ['dayjs']
  },
  optimizeDeps: { include: ['dayjs'] }
})
