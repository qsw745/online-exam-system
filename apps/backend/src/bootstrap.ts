// src/bootstrap.ts
process.on('uncaughtException', (err) => {
    console.error('[fatal] uncaughtException', err)
    if (process.env.NODE_ENV === 'production') process.exit(1)
})
process.on('unhandledRejection', (reason) => {
    console.error('[fatal] unhandledRejection', reason)
    if (process.env.NODE_ENV === 'production') process.exit(1)
})
process.on('SIGTERM', () => {
    console.warn('[signal] SIGTERM received')
    process.exit(0)
})

// 动态加载主程序（若在 import 期间出错，以上监听已就位）
import('./app')
