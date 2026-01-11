// ✅ 最小 Node shim：避免没有 @types/node 时 setImmediate 报错 2304
declare function setImmediate(callback: (...args: any[]) => void, ...args: any[]): any

import { log } from '@/infrastructure/logging/logger'
import type {
  CreateTaskInput,
  TaskListQuery,
  TaskListResult,
  TaskWithAssigned,
  UpdateTaskInput,
} from '../domain/task.model.js'
import { TaskRepository } from '../repositories/task.repository.js'
import { ConfigRepository } from '@/modules/configs/repositories/config.repository'

let RC: any = null,
  RL: any = null,
  RClient: any = null
;(async () => {
  try {
    RC = (await import('@/common/redis/cache')).default || (await import('@/common/redis/cache'))
  } catch {}
  try {
    RL = (await import('@/common/redis/lock')).default || (await import('@/common/redis/lock'))
  } catch {}
  try {
    RClient = (await import('@/common/redis/client')).default || (await import('@/common/redis/client'))
  } catch {}
})()

const TASK_TTL = 90
const kList = (q: any) => `task:list:${JSON.stringify(q)}`
const kTask = (id: number, u: number, r: string) => `task:${id}:${u}:${r}`
const kExam = (id: number, u: number) => `task:${id}:exam:${u}`

async function cget<T = any>(k: string) {
  try {
    const v = await RC?.get?.(k)
    return v ? JSON.parse(v) : null
  } catch {
    return null
  }
}
async function cset(k: string, v: any, ttl = TASK_TTL) {
  try {
    await RC?.set?.(k, JSON.stringify(v), ttl)
  } catch {}
}
async function cdel(...ks: string[]) {
  try {
    for (const k of ks) await RC?.del?.(k)
  } catch {}
}
async function cdelByPattern(p: string) {
  try {
    const ks = await RC?.keys?.(p)
    if (ks?.length) await RC?.del?.(ks)
  } catch {}
}
async function publishToUser(uid: number, payload: any) {
  try {
    await RClient?.publish?.(`ws:user:${uid}`, JSON.stringify(payload))
  } catch {}
}

function uniqueNums(arr: number[]) {
  return Array.from(new Set(arr.filter(n => Number.isFinite(n) && n > 0)))
}

function makeResLike() {
  return {
    ok: (_data?: any, _msg?: string) => {},
    created: (_data?: any, _msg?: string) => {},
    badRequest: (_msg?: string, _extra?: any) => {},
    unauthorized: () => {},
    forbidden: (_msg?: string) => {},
    notFound: (_msg?: string) => {},
    internal: (_msg?: string, _extra?: any) => {},
    json: (_: any) => {},
    status: (_code: number) => ({ json: (_: any) => {} }),
  }
}

export class TaskService {
  private readonly repo: TaskRepository
  constructor(repo = new TaskRepository()) {
    this.repo = repo
  }

  async list(q: TaskListQuery): Promise<TaskListResult> {
    const ck = kList(q)
    const hit = await cget<TaskListResult>(ck)
    if (hit) return hit
    const data = await this.repo.list(q)
    await cset(ck, data, 60)
    return data
  }

  async get(taskId: number, userId: number, role: 'admin' | 'teacher' | 'student') {
    const ck = kTask(taskId, userId, role)
    const hit = await cget(ck)
    if (hit) return hit
    const d = await this.repo.getForAccess(taskId, userId, role)
    if (d) await cset(ck, d, 60)
    return d
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
      paper_id,
      type = 'practice',
      assigned_user_ids,
      assigned_department_ids = [],
    } = input

    const deptUserIds = await this.findUsersByDepartments(assigned_department_ids)
    const cleanUsers = uniqueNums([...(assigned_user_ids || []), ...deptUserIds])
    const assignees = cleanUsers.length ? cleanUsers : [creatorId]

    const existing = await this.repo.findExistingUserIds(assignees)
    if (existing.length !== assignees.length) {
      const existSet = new Set(existing)
      const missing = assignees.filter(id => !existSet.has(id))
      throw new Error(`部分指定的分配用户不存在：${missing.join(', ')}`)
    }

    const dbStatus =
      status &&
      ['not_started', 'in_progress', 'completed', 'published', 'unpublished', 'draft', 'expired'].includes(status)
        ? status
        : 'not_started'

    let finalExamId = exam_id ?? null
    if (type === 'exam') {
      if (!paper_id && !finalExamId) {
        throw new Error('考试任务必须关联试卷')
      }
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
    await this.repo.replaceDepartmentAssignments(taskId, assigned_department_ids ?? [], creatorId)
    await this.repo.replaceAssignments(taskId, existing, creatorId)

    const task = await this.repo.getForAccess(taskId, creatorId, 'admin')
    if (!task) throw new Error('创建任务失败')
    if (paper_id) (task as any).paper_id = paper_id
    return task
  }

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
    patch: UpdateTaskInput & { assigned_user_ids?: number[]; assigned_department_ids?: number[] }
  ): Promise<TaskWithAssigned> {
    const existing = await this.repo.getForAccess(taskId, userScope.userId, userScope.role)
    if (!existing) throw new Error('任务不存在或无权限修改')

    let targetExamId = patch.exam_id ?? (existing as any).exam_id ?? null
    const targetType = (patch.type as any) || (existing as any).type || 'practice'
    const paperId = (patch.paper_id as any) ?? (existing as any).paper_id ?? null

    if (targetType === 'exam') {
      if (!targetExamId && !paperId) throw new Error('考试任务必须选择试卷')
      if (!targetExamId) {
        targetExamId = await this.repo.createExam({
          title: patch.title ?? existing.title,
          description: patch.description ?? existing.description ?? '',
          paper_id: paperId ?? null,
          duration: 60,
          start_time: this.asDateTime(patch.start_time ?? existing.start_time),
          end_time: this.asDateTime(patch.end_time ?? existing.end_time),
          created_by: userScope.userId,
        })
      } else if (paperId) {
        await this.repo.updateExamPaper(targetExamId, paperId)
      }
    }

    const ok = await this.repo.updateTask(taskId, userScope, { ...patch, exam_id: targetExamId, type: targetType })
    if (!ok) throw new Error('任务不存在或无权限修改')

    const deptIds = Array.isArray(patch.assigned_department_ids) ? patch.assigned_department_ids : undefined
    const userIds = Array.isArray(patch.assigned_user_ids) ? patch.assigned_user_ids : undefined

    if (deptIds || userIds) {
      if (deptIds) {
        await this.repo.replaceDepartmentAssignments(taskId, deptIds, userScope.userId)
      }
      const deptUsers = deptIds?.length ? await this.findUsersByDepartments(deptIds) : []
      const explicitUsers = userIds?.length ? await this.repo.findExistingUserIds(userIds) : []
      const allUsers = Array.from(new Set([...(explicitUsers || []), ...(deptUsers || [])]))
      if (allUsers.length) {
        await this.repo.replaceAssignments(taskId, allUsers, userScope.userId)
      } else {
        await this.repo.replaceAssignments(taskId, [], userScope.userId)
      }
    }

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
    await Promise.all(
      assignees.map(uid =>
        this.repo.insertNotification(uid as any, '新任务发布', msg, `/tasks/detail/${taskId}`) as any
      )
    )
  }

  async unpublish(taskId: number, operator: { id: number; role: 'admin' | 'teacher' | 'student' }, reason?: string) {
    if (operator.role !== 'admin' && operator.role !== 'teacher')
      throw new Error('权限不足，只有管理员和教师可以下线任务')

    const task = await this.repo.getForAccess(taskId, operator.id, 'admin')
    if (!task) throw new Error('任务不存在')
    if (task.status === 'unpublished') throw new Error('任务已经下线')
    if (task.status !== 'published') throw new Error('只有已发布的任务才能下线')

    await this.repo.setStatus(taskId, 'unpublished')

    const assignees = await this.repo.getAssignedUserIds(taskId)
    const content = reason ? `任务「${task.title}」已下线。下线原因：${reason}` : `任务「${task.title}」已下线。`
    await Promise.all(
      assignees.map(uid =>
        this.repo.insertNotification(uid as any, '任务下线通知', content, `/tasks/detail/${taskId}`) as any
      )
    )
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

    // ✅ 用 shim 声明的 setImmediate，不依赖 @types/node
    setImmediate(async () => {
      try {
        const { WrongQuestionController } = await import(
          '../../wrong-questions/controllers/wrong-question.controller.js'
        )
        const reqLike: any = { user: { id: userId }, body: { exam_result_id: examResultId } }
        const resLike = makeResLike() as any
        await WrongQuestionController.autoCollectWrongQuestions(reqLike, resLike)
      } catch (e) {
        log.error('自动收集错题失败:', e)
      }

      try {
        const { learningProgressController } = await import(
          '../../learning-progress/controllers/learning-progress.controller.js'
        )
        const accuracy = questionCount > 0 ? Math.round((correctCount / questionCount) * 100) : 0
        await learningProgressController.recordProgress(
          {
            user: { id: userId },
            body: {
              studyTime: Math.floor(Math.random() * 45) + 15,
              questionsAnswered: questionCount,
              correctAnswers: correctCount,
              studyContent: `任务：${taskId}（正确率 ${accuracy}%）`,
            },
          } as any
        )
      } catch (e) {
        log.error('记录学习进度失败:', e)
      }

      try {
        const { LeaderboardService } = await import('../../leaderboard/services/leaderboard.service.js')
        const svc: any = new LeaderboardService()
        const accuracy = questionCount > 0 ? (correctCount / questionCount) * 100 : 0

        if (typeof svc.updateLeaderboardRanking === 'function') {
          await svc.updateLeaderboardRanking(1, userId, score)
          await svc.updateLeaderboardRanking(3, userId, accuracy)
          if (typeof svc.checkAndAwardRankingAchievements === 'function') {
            await svc.checkAndAwardRankingAchievements(userId)
          }
        } else if (typeof svc.update === 'function') {
          await svc.update('score', userId, score)
          await svc.update('accuracy', userId, accuracy)
          if (typeof svc.award === 'function') await svc.award(userId, { score, accuracy })
        }
      } catch (e) {
        log.error('更新排行榜失败:', e)
      }
    })

    return { score, correctCount }
  }

  /** 🔥 开始/继续考试（兼容传 taskId 或 examId 的情况） */
  async getExam(originalId: number, userId: number, role: 'admin' | 'teacher' | 'student') {
    let task = await this.repo.getForAccess(originalId, userId, role)
    let taskId = originalId
    const isStudent = role === 'student'
    if (!task) {
      if (isStudent) {
        const maybeTaskId = await this.repo.findTaskIdByExamForUser(originalId, userId)
        if (maybeTaskId) {
          task = await this.repo.getForAccess(maybeTaskId, userId, 'student')
          taskId = maybeTaskId
        }
      } else {
        const anyTaskId = await this.repo.findAnyTaskIdByExam(originalId)
        if (anyTaskId) {
          task = await this.repo.getForAccess(anyTaskId, userId, isStudent ? 'student' : 'admin')
          taskId = anyTaskId
        }
      }
    }

    if (!task) throw new Error('无权限：该任务未分配给你或不存在')

    const meta = await this.repo.getExamMetaByTask(taskId)
    if (!meta) throw new Error('任务不存在')
    if (meta.type !== 'exam') throw new Error('该任务不是考试类型')
    if (meta.exam_id == null) throw new Error('任务未关联考试（exam_id 为空）')
    if (meta.paper_id == null) throw new Error('考试未关联试卷（paper_id 为空）')

    const now = new Date()
    if (meta.start_time && new Date(meta.start_time) > now) {
      throw new Error('考试尚未开始')
    }
    if (meta.end_time && new Date(meta.end_time) < now) {
      throw new Error('考试已结束')
    }

    const result = await this.repo.ensureExamResultStandalone(meta.exam_id, userId)
    const questions = await this.repo.getQuestionsViewByPaperId(meta.paper_id)
    const antiCheat = await this.getAntiCheatSetting()

    return {
      taskId: meta.taskId,
      examId: meta.exam_id,
      paperId: meta.paper_id,
      duration: meta.duration ?? 60,
      status: result.status,
      startedAt: result.start_time,
      endTime: meta.end_time,
      title: meta.title,
      description: meta.description ?? null,
      questions,
      antiCheat,
    }
  }

  private asDateTime(v?: string | Date) {
    if (!v) return null
    const d = new Date(v)
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 19).replace('T', ' ')
  }

  private async getAntiCheatSetting() {
    try {
      const cfg = await ConfigRepository.getByKey('exam.anticheat.level')
      const value = (cfg?.config_value || 'basic').toLowerCase()
      if (value === 'strict') {
        return { level: 'strict', maxSwitches: 1, disableCopy: true, autoSubmit: true }
      }
      if (value === 'none' || value === 'off') {
        return { level: 'none', maxSwitches: Number.MAX_SAFE_INTEGER, disableCopy: false, autoSubmit: false }
      }
      return { level: 'basic', maxSwitches: 3, disableCopy: true, autoSubmit: false }
    } catch {
      return { level: 'basic', maxSwitches: 3, disableCopy: true, autoSubmit: false }
    }
  }
}
