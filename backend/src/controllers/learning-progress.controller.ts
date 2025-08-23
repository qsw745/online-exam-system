import { Request, Response } from 'express';
import { LearningProgressService } from '../services/learning-progress.service';
import { ApiResponse } from '../types/api';

export class LearningProgressController {
  private learningProgressService: LearningProgressService;

  constructor() {
    this.learningProgressService = new LearningProgressService();
  }

  // 记录学习进度
  async recordProgress(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: '用户未登录' });
        return;
      }

      const { subjectId, studyTime, questionsAnswered, correctAnswers, studyContent } = req.body;

      const progress = await this.learningProgressService.recordProgress({
        userId,
        subjectId,
        studyTime,
        questionsAnswered,
        correctAnswers,
        studyContent
      });

      const response: ApiResponse = {
        success: true,
        message: '学习进度记录成功',
        data: progress
      };
      res.json(response);
    } catch (error) {
      console.error('记录学习进度失败:', error);
      res.status(500).json({ success: false, message: '记录学习进度失败' });
    }
  }

  // 获取学习进度统计
  async getProgressStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: '用户未登录' });
        return;
      }

      const { period = '7d', subjectId } = req.query;
      
      const stats = await this.learningProgressService.getProgressStats(
        userId,
        period as string,
        subjectId ? parseInt(subjectId as string) : undefined
      );

      const response: ApiResponse = {
        success: true,
        data: stats
      };
      res.json(response);
    } catch (error) {
      console.error('获取学习进度统计失败:', error);
      res.status(500).json({ success: false, message: '获取学习进度统计失败' });
    }
  }

  // 获取学习轨迹
  async getLearningTrack(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: '用户未登录' });
        return;
      }

      const { startDate, endDate, subjectId } = req.query;
      
      const track = await this.learningProgressService.getLearningTrack(
        userId,
        startDate as string,
        endDate as string,
        subjectId ? parseInt(subjectId as string) : undefined
      );

      const response: ApiResponse = {
        success: true,
        data: track
      };
      res.json(response);
    } catch (error) {
      console.error('获取学习轨迹失败:', error);
      res.status(500).json({ success: false, message: '获取学习轨迹失败' });
    }
  }

  // 设置学习目标
  async setLearningGoal(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: '用户未登录' });
        return;
      }

      const { goalType, targetValue, startDate, endDate, subjectId, description } = req.body;

      const goal = await this.learningProgressService.setLearningGoal({
        userId,
        goalType,
        targetValue,
        startDate,
        endDate,
        subjectId,
        description
      });

      const response: ApiResponse = {
        success: true,
        message: '学习目标设置成功',
        data: goal
      };
      res.json(response);
    } catch (error) {
      console.error('设置学习目标失败:', error);
      res.status(500).json({ success: false, message: '设置学习目标失败' });
    }
  }

  // 获取学习目标
  async getLearningGoals(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: '用户未登录' });
        return;
      }

      const { status, goalType } = req.query;
      
      const goals = await this.learningProgressService.getLearningGoals(
        userId,
        status as string,
        goalType as string
      );

      const response: ApiResponse = {
        success: true,
        data: goals
      };
      res.json(response);
    } catch (error) {
      console.error('获取学习目标失败:', error);
      res.status(500).json({ success: false, message: '获取学习目标失败' });
    }
  }

  // 更新学习目标进度
  async updateGoalProgress(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: '用户未登录' });
        return;
      }

      const { goalId } = req.params;
      const { currentValue, status } = req.body;

      const goal = await this.learningProgressService.updateGoalProgress(
        parseInt(goalId),
        userId,
        currentValue,
        status
      );

      const response: ApiResponse = {
        success: true,
        message: '学习目标进度更新成功',
        data: goal
      };
      res.json(response);
    } catch (error) {
      console.error('更新学习目标进度失败:', error);
      res.status(500).json({ success: false, message: '更新学习目标进度失败' });
    }
  }

  // 获取学习成就
  async getLearningAchievements(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: '用户未登录' });
        return;
      }

      const achievements = await this.learningProgressService.getLearningAchievements(userId);

      const response: ApiResponse = {
        success: true,
        data: achievements
      };
      res.json(response);
    } catch (error) {
      console.error('获取学习成就失败:', error);
      res.status(500).json({ success: false, message: '获取学习成就失败' });
    }
  }

  // 解锁学习成就
  async unlockAchievement(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: '用户未登录' });
        return;
      }

      const { achievementType, achievementData } = req.body;

      const achievement = await this.learningProgressService.unlockAchievement(
        userId,
        achievementType,
        achievementData
      );

      const response: ApiResponse = {
        success: true,
        message: '学习成就解锁成功',
        data: achievement
      };
      res.json(response);
    } catch (error) {
      console.error('解锁学习成就失败:', error);
      res.status(500).json({ success: false, message: '解锁学习成就失败' });
    }
  }

  // 获取学习报告
  async getLearningReport(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: '用户未登录' });
        return;
      }

      const { period = 'week', subjectId } = req.query;
      
      const report = await this.learningProgressService.getLearningReport(
        userId,
        period as string,
        subjectId ? parseInt(subjectId as string) : undefined
      );

      const response: ApiResponse = {
        success: true,
        message: '获取学习报告成功',
        data: report
      };
      res.json(response);
    } catch (error) {
      console.error('获取学习报告失败:', error);
      res.status(500).json({ success: false, message: '获取学习报告失败' });
    }
  }

  // 获取学习记录
  async getProgressRecords(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: '用户未登录' });
        return;
      }

      const { start_date, end_date, subject, limit = 20 } = req.query;

      const records = await this.learningProgressService.getProgressRecords(
        userId,
        start_date as string,
        end_date as string,
        subject as string,
        parseInt(limit as string)
      );

      const response: ApiResponse = {
        success: true,
        message: '获取学习记录成功',
        data: records
      };
      res.json(response);
    } catch (error) {
      console.error('获取学习记录失败:', error);
      res.status(500).json({ success: false, message: '获取学习记录失败' });
    }
  }

  // 获取科目列表
  async getSubjects(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: '用户未登录' });
        return;
      }

      const subjects = await this.learningProgressService.getSubjects(userId);

      const response: ApiResponse = {
        success: true,
        message: '获取科目列表成功',
        data: subjects
      };
      res.json(response);
    } catch (error) {
      console.error('获取科目列表失败:', error);
      res.status(500).json({ success: false, message: '获取科目列表失败' });
    }
  }
}

export const learningProgressController = new LearningProgressController();