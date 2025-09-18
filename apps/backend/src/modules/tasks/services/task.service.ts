// apps/backend/src/modules/tasks/services/task.service.ts
import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import { pool } from '@/config/database.js'
import { TaskRepository } from '../repositories/task.repository.js'
import type {
  CreateTaskInput,
  TaskListQuery,
  TaskListResult,
  TaskWithAssigned,
  UpdateTaskInput,
} from '../domain/task.model'
import {log} from "@/infrastructure/logging/logger";
function sanitizeIds(arr: unknown): number[] {
  if (!Array.isArray(arr)) return []
  const s = new Set<number>()
  for (const v of arr) {
    const n = Number(v)
    if (Number.isFinite(n) && n > 0) s.add(n)
  }
  return Array.from(s)
}
export class TaskService {
  private readonly repo: TaskRepository
  private readonly db: Pool

  constructor(repo = new TaskRepository(), db: Pool = pool) {
    this.repo = repo
    this.db = db
  }

  async list(q: TaskListQuery): Promise<TaskListResult> {
    return this.repo.list(q)
  }

  async get(taskId: number, userId: number, role: 'admin' | 'teacher' | 'student'): Promise<TaskWithAssigned | null> {
    return this.repo.getForAccess(taskId, userId, role)
  }

  async create(input: CreateTaskInput): Promise<TaskWithAssigned> {
    const {
      creatorId,
      title,
      description,
      status,
      start_time,
      end_time,
      exam_id,
      type = 'practice',
      assigned_user_ids,
    } = input

    // ✅ 二次清洗 & 兜底为创建者本人
    const cleanAssignees = sanitizeIds(assigned_user_ids)
    const assignees = cleanAssignees.length ? cleanAssignees : [creatorId]

    // ✅ 校验用户是否存在，并给出缺失列表
    const existing = await this.repo.findExistingUserIds(assignees)
    if (existing.length !== assignees.length) {
      const existSet = new Set(existing)
      const missing = assignees.filter(id => !existSet.has(id))
      // 让 Controller 能识别并返回 400
      throw new Error(`部分指定的分配用户不存在：${missing.join(', ')}`)
    }

    // 状态映射
    const dbStatus =
        status &&
        ['not_started', 'in_progress', 'completed', 'published', 'unpublished', 'draft', 'expired'].includes(status)
            ? status
            : 'not_started'

    // 若无 exam_id 但给了时间，则顺手建一条考试
    let finalExamId = exam_id ?? null
    if (!finalExamId && (start_time || end_time)) {
      const [ret] = await this.db.query<ResultSetHeader>(
          'INSERT INTO exams (title, description, duration, start_time, end_time, created_by) VALUES (?, ?, ?, ?, ?, ?)',
          [title, description ?? '', 60, this.asDateTime(start_time), this.asDateTime(end_time), creatorId]
      )
      finalExamId = ret.insertId
    }

    const taskId = await this.repo.insertTask({
      user_id: creatorId,
      title,
      description,
      status: dbStatus,
      start_time: this.asDateTime(start_time) ?? undefined,
      end_time: this.asDateTime(end_time) ?? undefined,
      exam_id: finalExamId,
      type,
    })

    await this.repo.replaceAssignments(taskId, existing, creatorId)

    // 新建者读取
    const task = await this.repo.getForAccess(taskId, creatorId, 'admin')
    if (!task) throw new Error('创建任务失败')
    return task
  }
  async update(
    taskId: number,
    userScope: { userId: number; role: 'admin' | 'teacher' | 'student' },
    patch: UpdateTaskInput
  ): Promise<TaskWithAssigned> {
    const ok = await this.repo.updateTask(taskId, userScope, patch)
    if (!ok) throw new Error('任务不存在或无权限修改')
    const task = await this.repo.getForAccess(taskId, userScope.userId, userScope.role)
    if (!task) throw new Error('任务不存在或无权限访问')
    return task
  }

  async remove(taskId: number, userScope: { userId: number; role: 'admin' | 'teacher' | 'student' }): Promise<void> {
    const ok = await this.repo.deleteTask(taskId, userScope)
    if (!ok) throw new Error('任务不存在或无权限删除')
  }

  async publish(taskId: number, operator: { id: number; role: 'admin' | 'teacher' | 'student' }): Promise<void> {
    if (operator.role !== 'admin' && operator.role !== 'teacher')
      throw new Error('权限不足，只有管理员和教师可以发布任务')

    const task = await this.repo.getForAccess(taskId, operator.id, 'admin')
    if (!task) throw new Error('任务不存在')
    if (task.status === 'published') throw new Error('任务已经发布')
    if (!task.title || !task.start_time || !task.end_time) throw new Error('任务信息不完整，无法发布')
    const now = new Date()
    if (new Date(task.end_time!) <= new Date(task.start_time!)) throw new Error('结束时间必须晚于开始时间')
    if (new Date(task.end_time!) <= now) throw new Error('结束时间不能早于当前时间')

    await this.repo.setStatus(taskId, 'published')

    const assignees = await this.repo.getAssignedUserIds(taskId)
    const msg = `任务「${task.title}」已发布，请及时完成。开始时间：${new Date(
      task.start_time!
    ).toLocaleString()}，结束时间：${new Date(task.end_time!).toLocaleString()}`
    await Promise.all(assignees.map(uid => this.repo.insertNotification(uid, '新任务发布', msg)))
  }

  async unpublish(
    taskId: number,
    operator: { id: number; role: 'admin' | 'teacher' | 'student' },
    reason?: string
  ): Promise<void> {
    if (operator.role !== 'admin' && operator.role !== 'teacher')
      throw new Error('权限不足，只有管理员和教师可以下线任务')

    const task = await this.repo.getForAccess(taskId, operator.id, 'admin')
    if (!task) throw new Error('任务不存在')
    if (task.status === 'unpublished') throw new Error('任务已经下线')
    if (task.status !== 'published') throw new Error('只有已发布的任务才能下线')

    await this.repo.setStatus(taskId, 'unpublished')

    const assignees = await this.repo.getAssignedUserIds(taskId)
    const content = reason ? `任务「${task.title}」已下线。下线原因：${reason}` : `任务「${task.title}」已下线。`
    await Promise.all(assignees.map(uid => this.repo.insertNotification(uid, '任务下线通知', content)))
  }

  async batchPublish(taskIds: number[], operator: { id: number; role: 'admin' | 'teacher' | 'student' }) {
    if (operator.role !== 'admin' && operator.role !== 'teacher')
      throw new Error('权限不足，只有管理员和教师可以批量发布任务')
    const results: Array<{ taskId: number; status: 'success' }> = []
    const errors: Array<{ taskId: number; error: string }> = []

    for (const taskId of taskIds) {
      try {
        const task = await this.repo.getForAccess(taskId, operator.id, 'admin')
        if (!task || task.status === 'published') {
          errors.push({ taskId, error: '任务不存在或已发布' })
          continue
        }
        if (!task.title || !task.start_time || !task.end_time) {
          errors.push({ taskId, error: '任务信息不完整' })
          continue
        }
        await this.repo.setStatus(taskId, 'published')
        results.push({ taskId, status: 'success' })
      } catch (e: any) {
        errors.push({ taskId, error: e?.message || '发布失败' })
      }
    }
    return { results, errors, successCount: results.length, errorCount: errors.length }
  }

  async batchUnpublish(taskIds: number[], operator: { id: number; role: 'admin' | 'teacher' | 'student' }) {
    if (operator.role !== 'admin' && operator.role !== 'teacher')
      throw new Error('权限不足，只有管理员和教师可以批量下线任务')
    const results: Array<{ taskId: number; status: 'success' }> = []
    const errors: Array<{ taskId: number; error: string }> = []

    for (const taskId of taskIds) {
      try {
        const task = await this.repo.getForAccess(taskId, operator.id, 'admin')
        if (!task || task.status !== 'published') {
          errors.push({ taskId, error: '任务不存在或未发布' })
          continue
        }
        await this.repo.setStatus(taskId, 'unpublished')
        results.push({ taskId, status: 'success' })
      } catch (e: any) {
        errors.push({ taskId, error: e?.message || '下线失败' })
      }
    }
    return { results, errors, successCount: results.length, errorCount: errors.length }
  }

  // 与考试/答题相关：保持与你原逻辑一致（事务 + 记录答案 + 排行/成就异步）
  async submit(taskId: number, userId: number, payload: { answers: Record<string, string>; time_spent?: number }) {
    // 读取任务
    const task = await this.repo.getForAccess(taskId, userId, 'student')
    if (!task) throw new Error('任务不存在')
    const examId = task.exam_id
    if (!examId) throw new Error('任务没有关联的考试')

    const conn = await this.db.getConnection()
    try {
      await conn.beginTransaction()

      // exam_results 取或建
      const [exists] = await conn.query<RowDataPacket[]>(
        'SELECT id FROM exam_results WHERE exam_id = ? AND user_id = ?',
        [examId, userId]
      )
      let resultId: number
      if (exists.length) {
        resultId = Number(exists[0].id)
      } else {
        const [ret] = await conn.query<ResultSetHeader>(
          'INSERT INTO exam_results (exam_id, user_id, status, start_time) VALUES (?, ?, "in_progress", NOW())',
          [examId, userId]
        )
        resultId = ret.insertId
      }

      // 取题 & 分值
      const [qs] = await conn.query<RowDataPacket[]>(
        `SELECT q.id, q.correct_answer, pq.score
           FROM questions q
           JOIN paper_questions pq ON q.id = pq.question_id
           JOIN papers p ON pq.paper_id = p.id
           JOIN exams e ON e.id = ?
          WHERE e.id = ?`,
        [examId, examId]
      )

      let totalScore = 0
      let correctCount = 0
      const answerRows: Array<[number, number, string, number]> = []
      for (const row of qs) {
        const qid = Number(row.id)
        const ua = payload.answers?.[qid]
        const ok = ua === row.correct_answer
        if (ok) {
          totalScore += Number(row.score || 0)
          correctCount += 1
        }
        answerRows.push([resultId, qid, ua ?? '', ok ? 1 : 0])
      }

      // 覆盖写入答案
      await conn.query('DELETE FROM answer_records WHERE exam_result_id = ?', [resultId])
      if (answerRows.length) {
        await conn.query('INSERT INTO answer_records (exam_result_id, question_id, user_answer, is_correct) VALUES ?', [
          answerRows,
        ])
      }

      await conn.query(
        'UPDATE exam_results SET score = ?, submit_time = NOW(), status = "submitted", answers = ?, time_spent = ? WHERE id = ?',
        [totalScore, JSON.stringify(payload.answers || {}), payload.time_spent || 0, resultId]
      )
      await conn.query('UPDATE tasks SET status = "completed" WHERE id = ?', [taskId])

      await conn.commit()

      // 异步：错题 + 学习进度 + 排行榜/成就
      setImmediate(async () => {
        try {
          const { WrongQuestionController } = await import(
            '../../wrong-questions/controllers/wrong-question.controller.js'
          )
          const reqLike: any = { user: { id: userId }, body: { exam_result_id: resultId } }
          const resLike: any = { json: () => {}, status: () => ({ json: () => {} }) }
          await WrongQuestionController.autoCollectWrongQuestions(reqLike, resLike)
        } catch (e) {
          log.error('自动收集错题失败:', e)
        }

        try {
          const { learningProgressController } = await import('../../learning-progress/learning-progress.controller.js')
          const studyTime = Math.floor(Math.random() * 45) + 15
          await learningProgressController.recordProgress(
            {
              user: { id: userId },
              body: {
                studyTime,
                questionsAnswered: qs.length,
                correctAnswers: correctCount,
                studyContent: `任务：${taskId}`,
              },
            } as any,
            { json: () => {}, status: () => ({ json: () => {} }) } as any
          )
        } catch (e) {
          log.error('记录学习进度失败:', e)
        }

        try {
          const { LeaderboardService } = await import('../../leaderboard/services/leaderboard.service.js')
          const svc = new LeaderboardService()
          const accuracy = qs.length > 0 ? (correctCount / qs.length) * 100 : 0
          await svc.updateLeaderboardRanking(1, userId, totalScore)
          await svc.updateLeaderboardRanking(3, userId, accuracy)
          await svc.checkAndAwardRankingAchievements(userId)
        } catch (e) {
          log.error('更新排行榜失败:', e)
        }
      })

      return { score: totalScore, correctCount }
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  }

  private asDateTime(v?: string | Date) {
    if (!v) return null
    const d = new Date(v)
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 19).replace('T', ' ')
  }
}
