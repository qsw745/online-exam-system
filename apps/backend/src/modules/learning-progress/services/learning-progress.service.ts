import { pool } from '@/config/database.js'
import type {
  LearningAchievement,
  LearningGoal,
  LearningGoalData,
  LearningProgress,
  LearningProgressData,
  LearningReport,
  LearningTrack,
  ProgressRecord,
  ProgressStats,
  Subject,
} from '../domain/learning-progress.model.js'
import { LearningProgressRepository } from '../repositories/learning-progress.repository.js'

export class LearningProgressService {
  private repo = new LearningProgressRepository()

  // 记录学习进度
  async recordProgress(data: LearningProgressData): Promise<LearningProgress> {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      const acc = data.questionsAnswered > 0 ? (data.correctAnswers / data.questionsAnswered) * 100 : 0
      await this.repo.upsertProgress(
        conn,
        data.userId,
        data.subjectId ?? null,
        data.studyTime,
        data.questionsAnswered,
        data.correctAnswers,
        acc
      )
      await this.repo.insertTrack(
        conn,
        data.userId,
        {
          studyTime: data.studyTime,
          questionsAnswered: data.questionsAnswered,
          correctAnswers: data.correctAnswers,
          accuracyRate: acc,
        },
        data.subjectId ?? null
      )

      const today = new Date().toISOString().split('T')[0]
      const agg = await this.repo.aggregateToday(conn, data.userId, data.subjectId ?? null, today)
      const totalStudy = agg?.total_study_time ?? 0
      const totalQ = agg?.total_questions ?? 0
      const totalC = agg?.correct_questions ?? 0
      const accuracy = totalQ > 0 ? (totalC / totalQ) * 100 : 0
      const streak = await this.repo.streak(conn, data.userId, data.subjectId ?? null)
      await this.repo.upsertStatistics(conn, data.userId, data.subjectId ?? null, today, {
        study: totalStudy,
        q: totalQ,
        c: totalC,
        acc: accuracy,
        streak,
      })

      await conn.commit()

      const [rows] = await pool.execute<LearningProgress[]>(
        `SELECT * FROM learning_progress WHERE user_id=? AND subject_id <=> ? AND study_date=CURDATE()`,
        [data.userId, data.subjectId ?? null]
      )
      return rows[0]
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  }

  // 统计
  async getProgressStats(userId: number, period: string, subjectId?: number): Promise<ProgressStats> {
    const days = period === '90d' ? 90 : period === '30d' ? 30 : 7
    const daily = await this.repo.dailyStats(userId, subjectId, days)
    const total = await this.repo.totalStats(userId, subjectId, days)
    return {
      dailyStats: daily.map(d => ({
        date: d.date,
        total_study_time: d.total_study_time ?? 0,
        total_questions: d.total_questions ?? 0,
        correct_answers: d.correct_answers ?? 0,
        avg_accuracy: d.avg_accuracy ?? 0,
      })),
      totalStats: {
        total_study_time: total?.total_study_time ?? 0,
        total_questions: total?.total_questions ?? 0,
        correct_answers: total?.correct_answers ?? 0,
        avg_accuracy: total?.avg_accuracy ?? 0,
        study_days: total?.study_days ?? 0,
      },
      period,
    }
  }

  // 轨迹 & 目标
  getLearningTrack(userId: number, start: string, end: string, subjectId?: number): Promise<LearningTrack[]> {
    return this.repo.getTrack(userId, start, end, subjectId)
  }

  setLearningGoal(data: LearningGoalData): Promise<LearningGoal> {
    return this.repo.insertGoal(data)
  }

  getLearningGoals(userId: number, status?: string, goalType?: string): Promise<LearningGoal[]> {
    return this.repo.listGoals(userId, status, goalType)
  }

  updateGoalProgress(goalId: number, userId: number, currentValue: number, status?: string): Promise<LearningGoal> {
    return this.repo.updateGoal(goalId, userId, currentValue, status)
  }

  // 成就
  getLearningAchievements(userId: number): Promise<LearningAchievement[]> {
    return this.repo.listAchievements(userId)
  }

  async unlockAchievement(userId: number, type: string, data: any): Promise<LearningAchievement> {
    const existed = await this.repo.findAchievement(userId, type)
    if (existed) return existed
    const meta = this.getAchievementInfo(type)
    return this.repo.insertAchievement(userId, { type, name: meta.name, description: meta.description, data })
  }

  private getAchievementInfo(type: string) {
    const m: Record<string, { name: string; description: string }> = {
      first_study: { name: '初学者', description: '完成第一次学习' },
      study_streak_7: { name: '坚持不懈', description: '连续学习7天' },
      study_streak_30: { name: '学习达人', description: '连续学习30天' },
      questions_100: { name: '百题斩', description: '累计答题100道' },
      questions_1000: { name: '千题王', description: '累计答题1000道' },
      accuracy_90: { name: '精准射手', description: '单日正确率达到90%' },
      study_time_10h: { name: '勤奋学者', description: '单日学习时长达到10小时' },
    }
    return m[type] || { name: '未知成就', description: '未知成就描述' }
  }

  // 报告
  async getLearningReport(userId: number, period: string, subjectId?: number): Promise<LearningReport> {
    const days = period === 'year' ? 365 : period === 'quarter' ? 90 : period === 'week' ? 7 : 30
    const stats = await this.repo.reportStats(userId, subjectId, days)
    const goals = await this.repo.reportGoals(userId, subjectId, days)
    const ach = await this.repo.reportAchievements(userId, days)
    return {
      period,
      statistics: {
        total_study_time: stats?.total_study_time ?? 0,
        total_questions: stats?.total_questions ?? 0,
        correct_questions: stats?.correct_questions ?? 0,
        avg_accuracy: stats?.avg_accuracy ?? 0,
        max_streak: stats?.max_streak ?? 0,
        study_days: stats?.study_days ?? 0,
      },
      goals: {
        total_goals: goals?.total_goals ?? 0,
        completed_goals: goals?.completed_goals ?? 0,
        in_progress_goals: goals?.in_progress_goals ?? 0,
      },
      achievements: { total_achievements: ach?.total_achievements ?? 0 },
      generatedAt: new Date().toISOString(),
    }
  }

  // 记录 / 科目
  getProgressRecords(
    userId: number,
    start?: string,
    end?: string,
    subject?: string,
    limit?: number
  ): Promise<ProgressRecord[]> {
    return this.repo.listRecords(userId, start, end, subject, limit ?? 20)
  }

  getSubjects(userId: number): Promise<Subject[]> {
    return this.repo.listSubjects(userId)
  }
}
