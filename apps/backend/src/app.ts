import cors from 'cors'
import express, { NextFunction, Request, Response } from 'express'
import morgan from 'morgan'
import path from 'path'
import { analyticsRoutes } from './routes/analytics.routes.js'
import { authRoutes } from './routes/auth.routes.js'
import { dashboardRoutes } from './routes/dashboard.routes.js'
import discussionsRoutes from './routes/discussions.routes.js'
import { examRoutes } from './routes/exam.routes.js'
import { favoriteRoutes } from './routes/favorite.routes.js'
import favoritesRoutes from './routes/favorites.routes.js'
import leaderboardRoutes from './routes/leaderboard.routes.js'
import learningProgressRoutes from './routes/learning-progress.routes.js'
import logRoutes from './routes/log.routes.js'
import menuRoutes from './routes/menu.routes.js'
import { notificationRoutes } from './routes/notification.routes.js'
import { orgUserRoutes } from './routes/org-user.routes.js'
import { orgRoutes } from './routes/org.routes.js'
import { paperRoutes } from './routes/paper.routes.js'
import { passwordResetRoutes } from './routes/password-reset.routes.js'
import { questionRoutes } from './routes/question.routes.js'
import { resultRoutes } from './routes/result.routes.js'
import roleRoutes from './routes/role.routes.js'
import { taskRoutes } from './routes/task.routes.js'
import { userRoutes } from './routes/user.routes.js'
import wrongQuestionRoutes from './routes/wrong-question.routes.js'
import { ApiResponse } from './types/response.js'
import { syncMenus } from './bootstrap/syncMenus.js'

const app = express()

// 中间件
app.use(cors())
app.use(express.json())
app.use(morgan('dev'))
// 静态文件服务中间件，用于访问上传的头像文件
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

// 路由
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/questions', questionRoutes)
app.use('/api/papers', paperRoutes)
app.use('/api/results', resultRoutes)
app.use('/api/exam_results', resultRoutes) // 使用 resultRoutes 处理 exam_results 请求
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/tasks', taskRoutes)
app.use('/api/exams', examRoutes)
app.use('/api/favorites', favoriteRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/password-reset', passwordResetRoutes)
app.use('/api/logs', logRoutes)
app.use('/api/wrong-questions', wrongQuestionRoutes)
app.use('/api/learning-progress', learningProgressRoutes)
app.use('/api/leaderboard', leaderboardRoutes)
app.use('/api/favorites', favoritesRoutes)
app.use('/api/discussions', discussionsRoutes)
app.use('/api/menu', menuRoutes)
app.use('/api/roles', roleRoutes)
app.use('/api/orgs', orgRoutes)
app.use('/api/orgs', orgUserRoutes)
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() })
})

// 404 处理
app.use((req: Request, res: Response<ApiResponse<null>>) => {
  const errorResponse: ApiResponse<null> = {
    success: false,
    error: '请求的资源不存在',
  }
  res.status(404).json(errorResponse)
})

// 全局错误处理
app.use((err: Error, req: Request, res: Response<ApiResponse<null>>, next: NextFunction) => {
  console.error('未捕获的错误:', err)
  const errorResponse: ApiResponse<null> = {
    success: false,
    error: '服务器内部错误',
  }
  res.status(500).json(errorResponse)
})

// 未捕获的异常处理
process.on('uncaughtException', err => {
  console.error('未捕获的异常:', err)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的 Promise 拒绝:', reason)
})

const port = Number(process.env.PORT) || 3000

async function start() {
  try {
    // 1) 启动期同步菜单（建议首次 removeOrphans: false；稳定后可开 true）
   await syncMenus({ removeOrphans: false, mode: 'patch' })


    // 2) 再启动服务
    app.listen(port, '0.0.0.0', () => {
      console.log(`服务器运行在 http://localhost:${port}`)
      console.log(`网络访问地址: http://0.0.0.0:${port}`)
    })
  } catch (err) {
    console.error('[menu-sync] 启动期同步失败：', err)
    process.exit(1) // 同步失败不启动服务，避免脏状态
  }
}

start()
