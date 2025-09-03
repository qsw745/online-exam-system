import { Response } from 'express'
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { pool } from '../config/database.js'
import { AuthRequest } from '../types/auth.js'
import { ApiResponse } from '../types/response.js'

interface ITask extends RowDataPacket {
  id: number
  user_id: number
  title: string
  description: string
  type: 'exam' | 'practice'
  status: 'not_started' | 'in_progress' | 'completed' | 'expired' | 'published' | 'unpublished' | 'draft'
  start_time: Date
  end_time: Date
  exam_id: number
  created_at: Date
  updated_at: Date
  username?: string
  email?: string
  publish_status?: 'draft' | 'published' | 'unpublished'
  assigned_users_info?: string
}

type TaskListResponse = ApiResponse<{
  tasks: ITask[]
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}>

type TaskDetailResponse = ApiResponse<{
  task: ITask
}>

export class TaskController {
  static async list(req: AuthRequest, res: Response<TaskListResponse>) {
    try {
      const userId = req.user?.id
      const userRole = req.user?.role
      const page = parseInt(req.query.page as string, 10) || 1
      const limit = parseInt(req.query.limit as string, 10) || 10
      const search = (req.query.search as string) || ''
      const status = (req.query.status as string) || ''

      if (!userId) {
        const errorResponse: TaskListResponse = { success: false, error: '未授权访问' }
        return res.status(401).json(errorResponse)
      }

      const offset = (page - 1) * limit

      // 构建查询条件 - 管理员和教师可以看到所有任务，学生只能看到分配给自己的任务
      let whereClause = ''
      const queryParams: any[] = []

      if (userRole === 'student') {
        whereClause = 'WHERE t.id IN (SELECT task_id FROM task_assignments WHERE user_id = ?)'
        queryParams.push(userId)
      } else {
        // 管理员和教师可以看到所有任务
        whereClause = 'WHERE 1=1'
      }

      if (search) {
        whereClause += ' AND (title LIKE ? OR description LIKE ?)'
        queryParams.push(`%${search}%`, `%${search}%`)
      }

      if (status) {
        whereClause += ' AND status = ?'
        queryParams.push(status)
      }

      // 获取总数
      const [countResult] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(DISTINCT t.id) as total 
         FROM tasks t 
         LEFT JOIN task_assignments ta ON t.id = ta.task_id
         LEFT JOIN users u ON ta.user_id = u.id 
         ${whereClause}`,
        queryParams
      )
      const total = Number(countResult[0]?.total ?? 0)

      // 获取分页数据，包含分配用户信息
      const [tasks] = await pool.query<ITask[]>(
        `SELECT t.*, 
               GROUP_CONCAT(DISTINCT CONCAT(u.id, ':', u.username, ':', u.email) SEPARATOR '|') as assigned_users_info
         FROM tasks t 
         LEFT JOIN task_assignments ta ON t.id = ta.task_id
         LEFT JOIN users u ON ta.user_id = u.id 
         ${whereClause} 
         GROUP BY t.id
         ORDER BY t.created_at DESC 
         LIMIT ? OFFSET ?`,
        [...queryParams, limit, offset]
      )

      // 处理分配用户信息
      const processedTasks = tasks.map(task => {
        const assignedUsers: Array<{ id: number; username: string; email: string }> = []
        if (task.assigned_users_info) {
          const userInfos = task.assigned_users_info.split('|')
          for (const userInfo of userInfos) {
            const [id, username, email] = userInfo.split(':')
            if (id && username && email) {
              assignedUsers.push({ id: parseInt(id, 10), username, email })
            }
          }
        }
        return {
          ...task,
          assigned_users: assignedUsers,
          assigned_users_info: undefined, // 移除临时字段
        } as unknown as ITask
      })

      const successResponse: TaskListResponse = {
        success: true,
        data: {
          tasks: processedTasks,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      }
      return res.json(successResponse)
    } catch (error) {
      console.error('获取任务列表错误:', error)
      const errorResponse: TaskListResponse = {
        success: false,
        error: error instanceof Error ? error.message : '获取任务列表失败',
      }
      return res.status(500).json(errorResponse)
    }
  }

  static async get(req: AuthRequest, res: Response<TaskDetailResponse>) {
    try {
      const userId = req.user?.id
      const taskId = parseInt(req.params.id, 10)

      if (!userId) {
        const errorResponse: TaskDetailResponse = { success: false, error: '未授权访问' }
        return res.status(401).json(errorResponse)
      }

      if (Number.isNaN(taskId)) {
        const errorResponse: TaskDetailResponse = { success: false, error: '无效的任务ID' }
        return res.status(400).json(errorResponse)
      }

      // 根据用户角色决定查询条件
      const userRole = req.user?.role
      let whereClause: string
      let params: any[]

      if (userRole === 'admin' || userRole === 'teacher') {
        whereClause = 'WHERE t.id = ?'
        params = [taskId]
      } else {
        whereClause = 'WHERE t.id = ? AND t.id IN (SELECT task_id FROM task_assignments WHERE user_id = ?)'
        params = [taskId, userId]
      }

      // 获取任务详情和分配用户信息
      const [tasks] = await pool.query<ITask[]>(
        `SELECT t.*, 
               GROUP_CONCAT(DISTINCT CONCAT(u.id, ':', u.username, ':', u.email) SEPARATOR '|') as assigned_users_info
         FROM tasks t 
         LEFT JOIN task_assignments ta ON t.id = ta.task_id
         LEFT JOIN users u ON ta.user_id = u.id 
         ${whereClause} 
         GROUP BY t.id`,
        params
      )

      if (tasks.length === 0) {
        const errorResponse: TaskDetailResponse = { success: false, error: '任务不存在或无权限访问' }
        return res.status(404).json(errorResponse)
      }

      // 处理分配用户信息
      const task = tasks[0]
      const assignedUsers: Array<{ id: number; username: string; email: string }> = []
      if (task.assigned_users_info) {
        const userInfos = task.assigned_users_info.split('|')
        for (const userInfo of userInfos) {
          const [id, username, email] = userInfo.split(':')
          if (id && username && email) {
            assignedUsers.push({ id: parseInt(id, 10), username, email })
          }
        }
      }

      const processedTask = {
        ...task,
        assigned_users: assignedUsers,
        assigned_users_info: undefined,
      } as unknown as ITask

      const successResponse: TaskDetailResponse = { success: true, data: { task: processedTask } }
      return res.json(successResponse)
    } catch (error) {
      console.error('获取任务详情错误:', error)
      const errorResponse: TaskDetailResponse = {
        success: false,
        error: error instanceof Error ? error.message : '获取任务详情失败',
      }
      return res.status(500).json(errorResponse)
    }
  }

  static async create(req: AuthRequest, res: Response<TaskDetailResponse>) {
    try {
      const creatorId = req.user?.id
      const userRole = req.user?.role
      const {
        title,
        description,
        status,
        start_time,
        end_time,
        exam_id,
        type = 'practice',
        assigned_user_ids,
      } = req.body

      if (!creatorId) {
        return res.status(401).json({ success: false, error: '未授权访问' })
      }

      if (userRole !== 'admin' && userRole !== 'teacher') {
        return res.status(403).json({ success: false, error: '权限不足，只有管理员和教师可以创建任务' })
      }

      if (!title) {
        return res.status(400).json({ success: false, error: '任务标题不能为空' })
      }

      // 处理分配用户ID列表
      let assignedUserIds: number[] = []
      if (assigned_user_ids && Array.isArray(assigned_user_ids) && assigned_user_ids.length > 0) {
        const [users] = await pool.query<RowDataPacket[]>(
          `SELECT id FROM users WHERE id IN (${assigned_user_ids.map(() => '?').join(',')})`,
          assigned_user_ids
        )
        if (users.length !== assigned_user_ids.length) {
          return res.status(400).json({ success: false, error: '部分指定的分配用户不存在' })
        }
        assignedUserIds = assigned_user_ids
      } else {
        assignedUserIds = [creatorId]
      }

      // 状态映射
      let dbStatus: ITask['status'] = 'not_started'
      if (status === 'in_progress') dbStatus = 'in_progress'
      else if (status === 'completed') dbStatus = 'completed'

      // 如果没有提供 exam_id，则创建默认考试
      let taskExamId = exam_id
      if (!taskExamId) {
        const formattedStartTime = new Date(start_time).toISOString().slice(0, 19).replace('T', ' ')
        const formattedEndTime = new Date(end_time).toISOString().slice(0, 19).replace('T', ' ')

        const [examResult] = await pool.query<ResultSetHeader>(
          'INSERT INTO exams (title, description, duration, start_time, end_time, created_by) VALUES (?, ?, ?, ?, ?, ?)',
          [title, description, 60, formattedStartTime, formattedEndTime, creatorId]
        )
        taskExamId = examResult.insertId
      }

      const formattedStartTime = new Date(start_time).toISOString().slice(0, 19).replace('T', ' ')
      const formattedEndTime = new Date(end_time).toISOString().slice(0, 19).replace('T', ' ')

      // 创建任务
      const [result] = await pool.query<ResultSetHeader>(
        // ✅ 增加 user_id 列
        'INSERT INTO tasks (user_id, title, description, status, start_time, end_time, exam_id, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        // ✅ 把 creatorId 作为 user_id 写入
        [creatorId, title, description, dbStatus, formattedStartTime, formattedEndTime, taskExamId, type]
      )
      const taskId = result.insertId

      // 分配用户
      for (const uid of assignedUserIds) {
        await pool.query(
          'INSERT INTO task_assignments (task_id, user_id, assigned_by, assigned_at) VALUES (?, ?, ?, NOW())',
          [taskId, uid, creatorId]
        )
      }

      // 返回任务
      const [task] = await pool.query<ITask[]>(
        'SELECT t.*, u.username, u.email FROM tasks t LEFT JOIN users u ON u.id = ? WHERE t.id = ?',
        [assignedUserIds[0], taskId]
      )

      const successResponse: TaskDetailResponse = { success: true, data: { task: task[0] } }
      return res.status(201).json(successResponse)
    } catch (error) {
      console.error('创建任务错误:', error)
      const errorResponse: TaskDetailResponse = {
        success: false,
        error: error instanceof Error ? error.message : '创建任务失败',
      }
      return res.status(500).json(errorResponse)
    }
  }

  static async update(req: AuthRequest, res: Response<TaskDetailResponse>) {
    try {
      const userId = req.user?.id
      const taskId = parseInt(req.params.id, 10)
      const { title, description, status, start_time, end_time } = req.body

      if (!userId) {
        return res.status(401).json({ success: false, error: '未授权访问' })
      }
      if (Number.isNaN(taskId)) {
        return res.status(400).json({ success: false, error: '无效的任务ID' })
      }

      // 检查任务是否存在以及用户是否有权限修改
      const userRole = req.user?.role
      let taskQuery: string
      let taskParams: any[]

      if (userRole === 'admin' || userRole === 'teacher') {
        taskQuery = 'SELECT * FROM tasks WHERE id = ?'
        taskParams = [taskId]
      } else {
        taskQuery =
          'SELECT * FROM tasks WHERE id = ? AND id IN (SELECT task_id FROM task_assignments WHERE user_id = ?)'
        taskParams = [taskId, userId]
      }

      const [existingTask] = await pool.query<ITask[]>(taskQuery, taskParams)

      if (existingTask.length === 0) {
        return res.status(404).json({ success: false, error: '任务不存在或无权限修改' })
      }

      // 状态映射
      let dbStatus: ITask['status'] = 'not_started'
      if (status === 'in_progress') dbStatus = 'in_progress'
      else if (status === 'completed') dbStatus = 'completed'

      const formattedStartTime = new Date(start_time).toISOString().slice(0, 19).replace('T', ' ')
      const formattedEndTime = new Date(end_time).toISOString().slice(0, 19).replace('T', ' ')

      await pool.query(
        'UPDATE tasks SET title = ?, description = ?, status = ?, start_time = ?, end_time = ? WHERE id = ?',
        [title, description, dbStatus, formattedStartTime, formattedEndTime, taskId]
      )

      const [updatedTask] = await pool.query<ITask[]>('SELECT * FROM tasks WHERE id = ?', [taskId])

      const successResponse: TaskDetailResponse = { success: true, data: { task: updatedTask[0] } }
      return res.json(successResponse)
    } catch (error) {
      console.error('更新任务错误:', error)
      const errorResponse: TaskDetailResponse = {
        success: false,
        error: error instanceof Error ? error.message : '更新任务失败',
      }
      return res.status(500).json(errorResponse)
    }
  }

  static async delete(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      const taskId = parseInt(req.params.id, 10)

      if (!userId) {
        return res.status(401).json({ success: false, error: '未授权访问' })
      }
      if (Number.isNaN(taskId)) {
        return res.status(400).json({ success: false, error: '无效的任务ID' })
      }

      // 检查任务是否存在以及用户是否有权限删除
      const userRole = req.user?.role
      let checkQuery: string
      let checkParams: any[]

      if (userRole === 'admin' || userRole === 'teacher') {
        checkQuery = 'SELECT id FROM tasks WHERE id = ?'
        checkParams = [taskId]
      } else {
        checkQuery =
          'SELECT id FROM tasks WHERE id = ? AND id IN (SELECT task_id FROM task_assignments WHERE user_id = ?)'
        checkParams = [taskId, userId]
      }

      const [existingTask] = await pool.query<RowDataPacket[]>(checkQuery, checkParams)

      if (existingTask.length === 0) {
        return res.status(404).json({ success: false, error: '任务不存在或无权限删除' })
      }

      await pool.query('DELETE FROM task_assignments WHERE task_id = ?', [taskId])
      await pool.query('DELETE FROM tasks WHERE id = ?', [taskId])

      return res.json({ success: true, data: null })
    } catch (error) {
      console.error('删除任务错误:', error)
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '删除任务失败',
      })
    }
  }

  static async submit(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      const taskId = parseInt(req.params.id, 10)
      const { answers, time_spent } = req.body

      if (!userId) {
        return res.status(401).json({ success: false, error: '未授权访问' })
      }
      if (Number.isNaN(taskId)) {
        return res.status(400).json({ success: false, error: '无效的任务ID' })
      }

      // 获取任务信息
      const [tasks] = await pool.query<ITask[]>('SELECT * FROM tasks WHERE id = ?', [taskId])
      if (tasks.length === 0) {
        return res.status(404).json({ success: false, error: '任务不存在' })
      }

      const task = tasks[0]
      const examId = task.exam_id
      if (!examId) {
        return res.status(400).json({ success: false, error: '任务没有关联的考试' })
      }

      const connection = await pool.getConnection()
      try {
        await connection.beginTransaction()

        // 检查是否已有提交记录
        const [existingResults] = await connection.query<RowDataPacket[]>(
          'SELECT * FROM exam_results WHERE exam_id = ? AND user_id = ?',
          [examId, userId]
        )

        let resultId: number
        if (existingResults.length > 0) {
          resultId = Number(existingResults[0].id)
        } else {
          // 创建新的结果记录
          const [resultInsert] = await connection.query<ResultSetHeader>(
            'INSERT INTO exam_results (exam_id, user_id, status, start_time) VALUES (?, ?, "in_progress", NOW())',
            [examId, userId]
          )
          resultId = resultInsert.insertId
        }

        // 获取考试题目
        const [questions] = await connection.query<RowDataPacket[]>(
          `SELECT q.id, q.correct_answer, pq.score
           FROM questions q
           JOIN paper_questions pq ON q.id = pq.question_id
           JOIN papers p ON pq.paper_id = p.id
           JOIN exams e ON e.id = ?
           WHERE e.id = ?`,
          [examId, examId]
        )

        let totalScore = 0
        let correctCount = 0 // ✅ 修复：统计正确题数
        const answerRecords: Array<[number, number, string, boolean]> = []

        // 计算分数并记录答案
        for (const question of questions) {
          const qid = Number(question.id)
          const userAnswer = answers?.[qid]
          const isCorrect = userAnswer === question.correct_answer

          if (isCorrect) {
            totalScore += Number(question.score || 0)
            correctCount += 1
          }

          answerRecords.push([resultId, qid, userAnswer ?? '', isCorrect])
        }

        // 删除旧的答案记录
        await connection.query('DELETE FROM answer_records WHERE exam_result_id = ?', [resultId])

        // 插入新的答案记录（批量）
        if (answerRecords.length > 0) {
          await connection.query(
            'INSERT INTO answer_records (exam_result_id, question_id, user_answer, is_correct) VALUES ?',
            [answerRecords]
          )
        }

        // 更新结果
        await connection.query(
          'UPDATE exam_results SET score = ?, submit_time = NOW(), status = "submitted", answers = ?, time_spent = ? WHERE id = ?',
          [totalScore, JSON.stringify(answers ?? {}), time_spent || 0, resultId]
        )

        // 更新任务状态
        await connection.query('UPDATE tasks SET status = "completed" WHERE id = ?', [taskId])

        await connection.commit()

        // 自动收集错题到错题本（异步）
        try {
          const { WrongQuestionController } = await import('./wrong-question.controller.js')
          const wrongQuestionReq = { ...req, body: { exam_result_id: resultId } }
          setImmediate(() => {
            WrongQuestionController.autoCollectWrongQuestions(
              wrongQuestionReq as AuthRequest,
              {
                json: () => {},
                status: () => ({ json: () => {} }),
              } as any
            ).catch(error => {
              console.error('自动收集错题失败:', error)
            })
          })
        } catch (error) {
          console.error('导入错题控制器失败:', error)
        }

        // 异步记录学习进度
        setImmediate(async () => {
          try {
            const { learningProgressController } = await import('./learning-progress.controller.js')
            const studyTime = Math.floor(Math.random() * 45) + 15 // 模拟学习时长15-60分钟
            await learningProgressController
              .recordProgress(
                {
                  user: req.user,
                  body: {
                    studyTime: studyTime,
                    questionsAnswered: questions.length,
                    correctAnswers: correctCount, // ✅ 使用已计算的正确题数
                    studyContent: `任务：${taskId}`,
                  },
                } as any,
                {
                  json: () => {},
                  status: () => ({ json: () => {} }),
                } as any
              )
              .catch(error => {
                console.error('记录学习进度失败:', error)
              })
          } catch (error) {
            console.error('导入学习进度控制器失败:', error)
          }
        })

        // 异步更新排行榜数据
        setImmediate(async () => {
          try {
            const { LeaderboardService } = await import('../services/leaderboard.service.js')
            const leaderboardService = new LeaderboardService()
            const accuracy = questions.length > 0 ? (correctCount / questions.length) * 100 : 0 // ✅ 使用 correctCount

            // 更新分数排行榜
            await leaderboardService.updateLeaderboardRanking(1, userId!, totalScore)

            // 更新正确率排行榜
            await leaderboardService.updateLeaderboardRanking(3, userId!, accuracy)

            // 检查并颁发成就
            await leaderboardService.checkAndAwardRankingAchievements(userId!)
          } catch (error) {
            console.error('更新排行榜失败:', error)
          }
        })

        return res.json({ success: true, data: null })
      } catch (error) {
        // 事务回滚

        await connection.rollback()
        throw error
      } finally {
        connection.release()
      }
    } catch (error) {
      console.error('提交任务错误:', error)
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '提交任务失败',
      })
    }
  }

  // 发布任务
  static async publish(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const userId = req.user?.id
      const userRole = req.user?.role
      const taskId = parseInt(req.params.id, 10)

      if (!userId) return res.status(401).json({ success: false, error: '未授权访问' })
      if (userRole !== 'admin' && userRole !== 'teacher')
        return res.status(403).json({ success: false, error: '权限不足，只有管理员和教师可以发布任务' })
      if (Number.isNaN(taskId)) return res.status(400).json({ success: false, error: '无效的任务ID' })

      const [tasks] = await pool.query<ITask[]>('SELECT * FROM tasks WHERE id = ?', [taskId])
      if (tasks.length === 0) return res.status(404).json({ success: false, error: '任务不存在' })

      const task = tasks[0]
      if (task.status === 'published') return res.status(400).json({ success: false, error: '任务已经发布' })
      if (!task.title || !task.start_time || !task.end_time)
        return res.status(400).json({ success: false, error: '任务信息不完整，无法发布' })

      const now = new Date()
      const startTime = new Date(task.start_time)
      const endTime = new Date(task.end_time)
      if (endTime <= startTime) return res.status(400).json({ success: false, error: '结束时间必须晚于开始时间' })
      if (endTime <= now) return res.status(400).json({ success: false, error: '结束时间不能早于当前时间' })

      await pool.query('UPDATE tasks SET status = "published", updated_at = NOW() WHERE id = ?', [taskId])

      const [assignedUsers] = await pool.query<RowDataPacket[]>(
        'SELECT user_id FROM task_assignments WHERE task_id = ?',
        [taskId]
      )

      for (const assignment of assignedUsers) {
        await pool.query(
          `INSERT INTO notifications (user_id, title, content, type, is_read, created_at) 
           VALUES (?, ?, ?, 'task', false, NOW())`,
          [
            assignment.user_id,
            '新任务发布',
            `任务「${
              task.title
            }」已发布，请及时完成。开始时间：${startTime.toLocaleString()}，结束时间：${endTime.toLocaleString()}`,
          ]
        )
      }

      return res.json({ success: true, data: { message: '任务发布成功', taskId } })
    } catch (error) {
      console.error('发布任务错误:', error)
      return res.status(500).json({ success: false, error: '发布任务失败' })
    }
  }

  // 下线任务
  static async unpublish(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const userId = req.user?.id
      const userRole = req.user?.role
      const taskId = parseInt(req.params.id, 10)
      const { reason } = req.body

      if (!userId) return res.status(401).json({ success: false, error: '未授权访问' })
      if (userRole !== 'admin' && userRole !== 'teacher')
        return res.status(403).json({ success: false, error: '权限不足，只有管理员和教师可以下线任务' })
      if (Number.isNaN(taskId)) return res.status(400).json({ success: false, error: '无效的任务ID' })

      const [tasks] = await pool.query<ITask[]>('SELECT * FROM tasks WHERE id = ?', [taskId])
      if (tasks.length === 0) return res.status(404).json({ success: false, error: '任务不存在' })

      const task = tasks[0]
      if (task.status === 'unpublished') return res.status(400).json({ success: false, error: '任务已经下线' })
      if (task.status !== 'published')
        return res.status(400).json({ success: false, error: '只有已发布的任务才能下线' })

      await pool.query('UPDATE tasks SET status = "unpublished", updated_at = NOW() WHERE id = ?', [taskId])

      const [assignedUsers] = await pool.query<RowDataPacket[]>(
        'SELECT user_id FROM task_assignments WHERE task_id = ?',
        [taskId]
      )

      const notificationContent = reason
        ? `任务「${task.title}」已下线。下线原因：${reason}`
        : `任务「${task.title}」已下线。`

      for (const assignment of assignedUsers) {
        await pool.query(
          `INSERT INTO notifications (user_id, title, content, type, is_read, created_at) 
           VALUES (?, ?, ?, 'task', false, NOW())`,
          [assignment.user_id, '任务下线通知', notificationContent]
        )
      }

      return res.json({ success: true, data: { message: '任务下线成功', taskId } })
    } catch (error) {
      console.error('下线任务错误:', error)
      return res.status(500).json({ success: false, error: '下线任务失败' })
    }
  }

  // 批量发布任务
  static async batchPublish(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const userId = req.user?.id
      const userRole = req.user?.role
      const { taskIds } = req.body

      if (!userId) return res.status(401).json({ success: false, error: '未授权访问' })
      if (userRole !== 'admin' && userRole !== 'teacher')
        return res.status(403).json({ success: false, error: '权限不足，只有管理员和教师可以批量发布任务' })
      if (!Array.isArray(taskIds) || taskIds.length === 0)
        return res.status(400).json({ success: false, error: '请提供有效的任务ID列表' })

      const results: Array<{ taskId: number; status: 'success' }> = []
      const errors: Array<{ taskId: number; error: string }> = []

      for (const taskId of taskIds) {
        try {
          const [tasks] = await pool.query<ITask[]>('SELECT * FROM tasks WHERE id = ? AND status != "published"', [
            taskId,
          ])

          if (tasks.length === 0) {
            errors.push({ taskId, error: '任务不存在或已发布' })
            continue
          }

          const task = tasks[0]
          if (!task.title || !task.start_time || !task.end_time) {
            errors.push({ taskId, error: '任务信息不完整' })
            continue
          }

          await pool.query('UPDATE tasks SET status = "published", updated_at = NOW() WHERE id = ?', [taskId])
          results.push({ taskId, status: 'success' })
        } catch (error) {
          errors.push({ taskId, error: error instanceof Error ? error.message : '发布失败' })
        }
      }

      return res.json({
        success: true,
        data: {
          message: '批量发布完成',
          results,
          errors,
          successCount: results.length,
          errorCount: errors.length,
        },
      })
    } catch (error) {
      console.error('批量发布任务错误:', error)
      return res.status(500).json({ success: false, error: '批量发布任务失败' })
    }
  }

  // 批量下线任务
  static async batchUnpublish(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const userId = req.user?.id
      const userRole = req.user?.role
      const { taskIds, reason } = req.body

      if (!userId) return res.status(401).json({ success: false, error: '未授权访问' })
      if (userRole !== 'admin' && userRole !== 'teacher')
        return res.status(403).json({ success: false, error: '权限不足，只有管理员和教师可以批量下线任务' })
      if (!Array.isArray(taskIds) || taskIds.length === 0)
        return res.status(400).json({ success: false, error: '请提供有效的任务ID列表' })

      const results: Array<{ taskId: number; status: 'success' }> = []
      const errors: Array<{ taskId: number; error: string }> = []

      for (const taskId of taskIds) {
        try {
          const [tasks] = await pool.query<ITask[]>('SELECT * FROM tasks WHERE id = ? AND status = "published"', [
            taskId,
          ])

          if (tasks.length === 0) {
            errors.push({ taskId, error: '任务不存在或未发布' })
            continue
          }

          await pool.query('UPDATE tasks SET status = "unpublished", updated_at = NOW() WHERE id = ?', [taskId])
          results.push({ taskId, status: 'success' })
        } catch (error) {
          errors.push({ taskId, error: error instanceof Error ? error.message : '下线失败' })
        }
      }

      return res.json({
        success: true,
        data: {
          message: '批量下线完成',
          results,
          errors,
          successCount: results.length,
          errorCount: errors.length,
        },
      })
    } catch (error) {
      console.error('批量下线任务错误:', error)
      return res.status(500).json({ success: false, error: '批量下线任务失败' })
    }
  }
}
