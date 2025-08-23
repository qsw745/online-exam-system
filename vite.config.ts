import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const isProd = process.env.BUILD_MODE === 'prod'
export default defineConfig({
  server: {
    host: '0.0.0.0', // 允许外部访问
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  plugins: [
    react()
  ],
  resolve: {
    alias: {
      // 所有 import 'dayjs' 都指向同一份
      dayjs: path.resolve(__dirname, 'node_modules/dayjs'),
    },
      // 防止出现多份副本
    dedupe: ['dayjs'],
  },
    optimizeDeps: {
    include: ['dayjs'],
  },
})

