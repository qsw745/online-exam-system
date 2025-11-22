import type { AuthRequest } from '@/types/auth.js'
import type { Res } from '@/types/response.js'
import type {
  LearningAchievement,
  LearningGoal,
  LearningProgress,
  LearningReport,
  LearningTrack,
  ProgressRecord,
  ProgressStats,
  Subject,
} from '../domain/learning-progress.model.js'
import { LearningProgressService } from '../services/learning-progress.service.js'

const service = new LearningProgressService()

export class LearningProgressController {
  async recordProgress(req: AuthRequest, res?: Res) {
    try {
      const userId = req.user?.id
      if (!userId) return res ? res.unauthorized('用户未登录') : undefined
      const { subjectId, studyTime, questionsAnswered, correctAnswers, studyContent } = req.body
      const progress = await service.recordProgress({
        userId,
        subjectId,
        studyTime,
        questionsAnswered,
        correctAnswers,
        studyContent,
      })
      if (res?.ok) return res.ok<LearningProgress>(progress, '学习进度记录成功')
      return progress
    } catch (e: any) {
      if (res?.internal) return res.internal(e?.message || '记录学习进度失败')
      throw e
    }
  }

  async getProgressStats(req: AuthRequest, res: Res) {
    try {
      const userId = req.user?.id
      if (!userId) return res.unauthorized('用户未登录')
      const stats = await service.getProgressStats(
        userId,
        String(req.query.period || '7d'),
        req.query.subjectId ? Number(req.query.subjectId) : undefined
      )
      return res.ok<ProgressStats>(stats)
    } catch (e: any) {
      return res.internal(e?.message || '获取学习进度统计失败')
    }
  }

  async getLearningTrack(req: AuthRequest, res: Res) {
    try {
      const userId = req.user?.id
      if (!userId) return res.unauthorized('用户未登录')
      const { startDate, endDate, subjectId } = req.query
      const data = await service.getLearningTrack(
        userId,
        String(startDate),
        String(endDate),
        subjectId ? Number(subjectId) : undefined
      )
      return res.ok<LearningTrack[]>(data)
    } catch (e: any) {
      return res.internal(e?.message || '获取学习轨迹失败')
    }
  }

  async setLearningGoal(req: AuthRequest, res: Res) {
    try {
      const userId = req.user?.id
      if (!userId) return res.unauthorized('用户未登录')
      const goal = await service.setLearningGoal({ userId, ...req.body })
      return res.ok<LearningGoal>(goal, '学习目标设置成功')
    } catch (e: any) {
      return res.internal(e?.message || '设置学习目标失败')
    }
  }

  async getLearningGoals(req: AuthRequest, res: Res) {
    try {
      const userId = req.user?.id
      if (!userId) return res.unauthorized('用户未登录')
      const goals = await service.getLearningGoals(userId, req.query.status as string, req.query.goalType as string)
      return res.ok<LearningGoal[]>(goals)
    } catch (e: any) {
      return res.internal(e?.message || '获取学习目标失败')
    }
  }

  async updateGoalProgress(req: AuthRequest, res: Res) {
    try {
      const userId = req.user?.id
      if (!userId) return res.unauthorized('用户未登录')
      const goal = await service.updateGoalProgress(
        Number(req.params.goalId),
        userId,
        Number(req.body.currentValue),
        req.body.status
      )
      return res.ok<LearningGoal>(goal, '学习目标进度更新成功')
    } catch (e: any) {
      return res.internal(e?.message || '更新学习目标进度失败')
    }
  }

  async getLearningAchievements(req: AuthRequest, res: Res) {
    try {
      const userId = req.user?.id
      if (!userId) return res.unauthorized('用户未登录')
      const achievements = await service.getLearningAchievements(userId)
      return res.ok<LearningAchievement[]>(achievements)
    } catch (e: any) {
      return res.internal(e?.message || '获取学习成就失败')
    }
  }

  async unlockAchievement(req: AuthRequest, res: Res) {
    try {
      const userId = req.user?.id
      if (!userId) return res.unauthorized('用户未登录')
      const ach = await service.unlockAchievement(userId, String(req.body.achievementType), req.body.achievementData)
      return res.ok<LearningAchievement>(ach, '学习成就解锁成功')
    } catch (e: any) {
      return res.internal(e?.message || '解锁学习成就失败')
    }
  }

  async getLearningReport(req: AuthRequest, res: Res) {
    try {
      const userId = req.user?.id
      if (!userId) return res.unauthorized('用户未登录')
      const report = await service.getLearningReport(
        userId,
        String(req.query.period || 'week'),
        req.query.subjectId ? Number(req.query.subjectId) : undefined
      )
      return res.ok<LearningReport>(report, '获取学习报告成功')
    } catch (e: any) {
      return res.internal(e?.message || '获取学习报告失败')
    }
  }

  async getProgressRecords(req: AuthRequest, res: Res) {
    try {
      const userId = req.user?.id
      if (!userId) return res.unauthorized('用户未登录')
      const { start_date, end_date, subject, limit = 20 } = req.query
      const records = await service.getProgressRecords(
        userId,
        start_date as string | undefined,
        end_date as string | undefined,
        subject as string | undefined,
        Number(limit)
      )
      return res.ok<ProgressRecord[]>(records, '获取学习记录成功')
    } catch (e: any) {
      return res.internal(e?.message || '获取学习记录失败')
    }
  }

  async getSubjects(req: AuthRequest, res: Res) {
    try {
      const userId = req.user?.id
      if (!userId) return res.unauthorized('用户未登录')
      const subjects = await service.getSubjects(userId)
      return res.ok<Subject[]>(subjects, '获取科目列表成功')
    } catch (e: any) {
      return res.internal(e?.message || '获取科目列表失败')
    }
  }
}

export const learningProgressController = new LearningProgressController()
