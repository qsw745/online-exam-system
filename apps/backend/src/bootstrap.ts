// apps/backend/src/bootstrap.ts
process.on('uncaughtException', (err: unknown) => {
  // 你自己的 logger，这里用 console 兜底
  // eslint-disable-next-line no-console
  console.error('[fatal] uncaughtException', err)
  if (process.env.NODE_ENV === 'production') process.exit(1)
})

process.on('unhandledRejection', (reason: unknown) => {
  // eslint-disable-next-line no-console
  console.error('[fatal] unhandledRejection', reason)
  if (process.env.NODE_ENV === 'production') process.exit(1)
})

process.on('SIGTERM', () => {
  // eslint-disable-next-line no-console
  console.warn('[signal] SIGTERM received')
  process.exit(0)
})

// 动态加载主程序（若在 import 期间出错，以上监听已就位）
import('./app')
