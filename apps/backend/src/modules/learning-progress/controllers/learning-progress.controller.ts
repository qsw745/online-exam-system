import type { Response } from 'express'
import type { AuthRequest } from 'types/auth.js'
import type { ApiResponse } from 'types/response.js'
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
  async recordProgress(req: AuthRequest, res: Response<ApiResponse<LearningProgress>>) {
    try {
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: '用户未登录' })
      const { subjectId, studyTime, questionsAnswered, correctAnswers, studyContent } = req.body
      const progress = await service.recordProgress({
        userId,
        subjectId,
        studyTime,
        questionsAnswered,
        correctAnswers,
        studyContent,
      })
      res.json({ success: true, message: '学习进度记录成功', data: progress })
    } catch (e) {
      res
        .status(500)
        .json({ success: false, error: 'INTERNAL_ERROR', message: (e as Error).message || '记录学习进度失败' })
    }
  }

  async getProgressStats(req: AuthRequest, res: Response<ApiResponse<ProgressStats>>) {
    try {
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: '用户未登录' })
      const stats = await service.getProgressStats(
        userId,
        String(req.query.period || '7d'),
        req.query.subjectId ? Number(req.query.subjectId) : undefined
      )
      res.json({ success: true, data: stats })
    } catch (e) {
      res
        .status(500)
        .json({ success: false, error: 'INTERNAL_ERROR', message: (e as Error).message || '获取学习进度统计失败' })
    }
  }

  async getLearningTrack(req: AuthRequest, res: Response<ApiResponse<LearningTrack[]>>) {
    try {
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: '用户未登录' })
      const { startDate, endDate, subjectId } = req.query
      const data = await service.getLearningTrack(
        userId,
        String(startDate),
        String(endDate),
        subjectId ? Number(subjectId) : undefined
      )
      res.json({ success: true, data })
    } catch (e) {
      res
        .status(500)
        .json({ success: false, error: 'INTERNAL_ERROR', message: (e as Error).message || '获取学习轨迹失败' })
    }
  }

  async setLearningGoal(req: AuthRequest, res: Response<ApiResponse<LearningGoal>>) {
    try {
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: '用户未登录' })
      const goal = await service.setLearningGoal({ userId, ...req.body })
      res.json({ success: true, message: '学习目标设置成功', data: goal })
    } catch (e) {
      res
        .status(500)
        .json({ success: false, error: 'INTERNAL_ERROR', message: (e as Error).message || '设置学习目标失败' })
    }
  }

  async getLearningGoals(req: AuthRequest, res: Response<ApiResponse<LearningGoal[]>>) {
    try {
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: '用户未登录' })
      const goals = await service.getLearningGoals(userId, req.query.status as string, req.query.goalType as string)
      res.json({ success: true, data: goals })
    } catch (e) {
      res
        .status(500)
        .json({ success: false, error: 'INTERNAL_ERROR', message: (e as Error).message || '获取学习目标失败' })
    }
  }

  async updateGoalProgress(req: AuthRequest, res: Response<ApiResponse<LearningGoal>>) {
    try {
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: '用户未登录' })
      const goal = await service.updateGoalProgress(
        Number(req.params.goalId),
        userId,
        Number(req.body.currentValue),
        req.body.status
      )
      res.json({ success: true, message: '学习目标进度更新成功', data: goal })
    } catch (e) {
      res
        .status(500)
        .json({ success: false, error: 'INTERNAL_ERROR', message: (e as Error).message || '更新学习目标进度失败' })
    }
  }

  async getLearningAchievements(req: AuthRequest, res: Response<ApiResponse<LearningAchievement[]>>) {
    try {
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: '用户未登录' })
      const achievements = await service.getLearningAchievements(userId)
      res.json({ success: true, data: achievements })
    } catch (e) {
      res
        .status(500)
        .json({ success: false, error: 'INTERNAL_ERROR', message: (e as Error).message || '获取学习成就失败' })
    }
  }

  async unlockAchievement(req: AuthRequest, res: Response<ApiResponse<LearningAchievement>>) {
    try {
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: '用户未登录' })
      const ach = await service.unlockAchievement(userId, String(req.body.achievementType), req.body.achievementData)
      res.json({ success: true, message: '学习成就解锁成功', data: ach })
    } catch (e) {
      res
        .status(500)
        .json({ success: false, error: 'INTERNAL_ERROR', message: (e as Error).message || '解锁学习成就失败' })
    }
  }

  async getLearningReport(req: AuthRequest, res: Response<ApiResponse<LearningReport>>) {
    try {
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: '用户未登录' })
      const report = await service.getLearningReport(
        userId,
        String(req.query.period || 'week'),
        req.query.subjectId ? Number(req.query.subjectId) : undefined
      )
      res.json({ success: true, message: '获取学习报告成功', data: report })
    } catch (e) {
      res
        .status(500)
        .json({ success: false, error: 'INTERNAL_ERROR', message: (e as Error).message || '获取学习报告失败' })
    }
  }

  async getProgressRecords(req: AuthRequest, res: Response<ApiResponse<ProgressRecord[]>>) {
    try {
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: '用户未登录' })
      const { start_date, end_date, subject, limit = 20 } = req.query
      const records = await service.getProgressRecords(
        userId,
        start_date as string | undefined,
        end_date as string | undefined,
        subject as string | undefined,
        Number(limit)
      )
      res.json({ success: true, message: '获取学习记录成功', data: records })
    } catch (e) {
      res
        .status(500)
        .json({ success: false, error: 'INTERNAL_ERROR', message: (e as Error).message || '获取学习记录失败' })
    }
  }

  async getSubjects(req: AuthRequest, res: Response<ApiResponse<Subject[]>>) {
    try {
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: '用户未登录' })
      const subjects = await service.getSubjects(userId)
      res.json({ success: true, message: '获取科目列表成功', data: subjects })
    } catch (e) {
      res
        .status(500)
        .json({ success: false, error: 'INTERNAL_ERROR', message: (e as Error).message || '获取科目列表失败' })
    }
  }
}

export const learningProgressController = new LearningProgressController()
