import { TaskRepository } from '../repositories/task.repository.js'
import type {
  CreateTaskInput,
  TaskListQuery,
  TaskListResult,
  TaskWithAssigned,
  UpdateTaskInput,
} from '../domain/task.model'
import { log } from '@/infrastructure/logging/logger'

function sanitizeIds(arr: unknown): number[] {
  if (!Array.isArray(arr)) return []
  const s = new Set<number>()
  for (const v of arr) {
    const n = Number(v)
    if (Number.isFinite(n) && n > 0) s.add(n)
  }
  return Array.from(s)
}
function uniqueNums(arr: number[]) {
  return Array.from(new Set(arr.filter(n => Number.isFinite(n) && n > 0)))
}

export class TaskService {
  private readonly repo: TaskRepository

  constructor(repo = new TaskRepository()) {
    this.repo = repo
  }

  async list(q: TaskListQuery): Promise<TaskListResult> {
    return this.repo.list(q)
  }

  async get(taskId: number, userId: number, role: 'admin' | 'teacher' | 'student'): Promise<TaskWithAssigned | null> {
    return this.repo.getForAccess(taskId, userId, role)
  }

  async create(
      input: CreateTaskInput & { paper_id?: number; assigned_department_ids?: number[] }
  ): Promise<TaskWithAssigned> {
    const {
      creatorId,
      title,
      description,
      status,
      start_time,
      end_time,
      exam_id,
      paper_id, // 新增：由前端直传的试卷ID
      type = 'practice',
      assigned_user_ids,
      assigned_department_ids = [],
    } = input

    // 1) 计算最终分配用户：部门展开 + 指定用户
    const deptUserIds = await this.findUsersByDepartments(assigned_department_ids)
    const cleanUsers = uniqueNums([...(assigned_user_ids || []), ...deptUserIds])
    const assignees = cleanUsers.length ? cleanUsers : [creatorId]

    // 校验用户是否存在
    const existing = await this.repo.findExistingUserIds(assignees)
    if (existing.length !== assignees.length) {
      const existSet = new Set(existing)
      const missing = assignees.filter(id => !existSet.has(id))
      throw new Error(`部分指定的分配用户不存在：${missing.join(', ')}`)
    }

    // 2) 状态兜底
    const dbStatus =
        status &&
        ['not_started', 'in_progress', 'completed', 'published', 'unpublished', 'draft', 'expired'].includes(status)
            ? status
            : 'not_started'

    // 3) 处理考试：优先使用现成 exam_id；否则新建，并写入 paper_id
    let finalExamId = exam_id ?? null
    if (type === 'exam') {
      if (finalExamId) {
        if (paper_id) await this.repo.updateExamPaper(finalExamId, paper_id)
      } else {
        finalExamId = await this.repo.createExam({
          title,
          description: description ?? '',
          paper_id: paper_id ?? null,
          duration: 60,
          start_time: this.asDateTime(start_time),
          end_time: this.asDateTime(end_time),
          created_by: creatorId,
        })
      }
    }

    // 4) 插入任务
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

    // 5) 写入分配
    await this.repo.replaceAssignments(taskId, existing, creatorId)

    // 读取并返回
    const task = await this.repo.getForAccess(taskId, creatorId, 'admin')
    if (!task) throw new Error('创建任务失败')
    if (paper_id) (task as any).paper_id = paper_id
    return task
  }

  // 展开部门 → 用户ID列表
  private async findUsersByDepartments(deptIds: number[]): Promise<number[]> {
    const ids = uniqueNums(deptIds || [])
    if (!ids.length) return []
    try {
      return await this.repo.findUserIdsByDepartmentIds(ids)
    } catch {
      return []
    }
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

  // 提交与评分：SQL 已移到仓储
  async submit(taskId: number, userId: number, payload: { answers: Record<string, string>; time_spent?: number }) {
    const task = await this.repo.getForAccess(taskId, userId, 'student')
    if (!task) throw new Error('任务不存在')
    const examId = task.exam_id
    if (!examId) throw new Error('任务没有关联的考试')

    const { score, correctCount, questionCount, examResultId } = await this.repo.submitAndGrade({
      examId,
      userId,
      answers: payload.answers || {},
      time_spent: payload.time_spent || 0,
      taskId,
    })

    // 异步：错题 + 学习进度 + 排行榜/成就
    setImmediate(async () => {
      try {
        const { WrongQuestionController } = await import('../../wrong-questions/controllers/wrong-question.controller.js')
        const reqLike: any = { user: { id: userId }, body: { exam_result_id: examResultId } }
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
                questionsAnswered: questionCount,
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
        const accuracy = questionCount > 0 ? (correctCount / questionCount) * 100 : 0
        await svc.updateLeaderboardRanking(1, userId, score)
        await svc.updateLeaderboardRanking(3, userId, accuracy)
        await svc.checkAndAwardRankingAchievements(userId)
      } catch (e) {
        log.error('更新排行榜失败:', e)
      }
    })

    return { score, correctCount }
  }

  private asDateTime(v?: string | Date) {
    if (!v) return null
    const d = new Date(v)
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 19).replace('T', ' ')
  }
}
