import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: { '/api': { target: 'http://127.0.0.1:3000', changeOrigin: true, secure: false } },
  },
  plugins: [react(), tsconfigPaths()], // ← 必须启用
  resolve: {
    alias: { dayjs: path.resolve(__dirname, 'node_modules/dayjs') },
    dedupe: ['dayjs'],
  },
  optimizeDeps: { include: ['dayjs'] },
})
