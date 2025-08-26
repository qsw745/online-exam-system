import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { pool } from '../config/database.js';

interface LearningProgressData {
  userId: number;
  subjectId?: number;
  studyTime: number;
  questionsAnswered: number;
  correctAnswers: number;
  studyContent?: string;
}

interface LearningGoalData {
  userId: number;
  goalType: string;
  targetValue: number;
  startDate: string;
  endDate: string;
  subjectId?: number;
  description?: string;
}

interface LearningProgress extends RowDataPacket {
  id: number;
  user_id: number;
  subject_id?: number;
  study_date: string;
  time_spent: number;
  total_questions: number;
  correct_answers: number;
  accuracy_rate: number;
  created_at: string;
  updated_at: string;
}

interface LearningGoal extends RowDataPacket {
  id: number;
  user_id: number;
  goal_type: string;
  target_value: number;
  current_value: number;
  start_date: string;
  end_date: string;
  status: string;
  subject_id?: number;
  description?: string;
  created_at: string;
  updated_at: string;
}

interface LearningTrack extends RowDataPacket {
  id: number;
  user_id: number;
  activity_type: string;
  activity_data: string;
  subject_id?: number;
  created_at: string;
}

interface LearningStatistics extends RowDataPacket {
  id: number;
  user_id: number;
  subject_id?: number;
  stat_date: string;
  total_study_time: number;
  total_questions: number;
  correct_questions: number;
  accuracy_rate: number;
  study_streak: number;
  created_at: string;
  updated_at: string;
}

interface LearningAchievement extends RowDataPacket {
  id: number;
  user_id: number;
  achievement_type: string;
  achievement_name: string;
  achievement_description: string;
  achievement_data: string;
  unlocked_at: string;
}

export class LearningProgressService {
  // 记录学习进度
  async recordProgress(data: LearningProgressData): Promise<LearningProgress> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const accuracyRate = data.questionsAnswered > 0 ? 
        (data.correctAnswers / data.questionsAnswered) * 100 : 0;

      // 插入学习进度记录
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO learning_progress 
         (user_id, subject_id, study_date, time_spent, total_questions, correct_answers, accuracy_rate)
         VALUES (?, ?, CURDATE(), ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         time_spent = time_spent + VALUES(time_spent),
         total_questions = total_questions + VALUES(total_questions),
         correct_answers = correct_answers + VALUES(correct_answers),
         accuracy_rate = (correct_answers / total_questions) * 100,
         updated_at = CURRENT_TIMESTAMP`,
        [data.userId, data.subjectId, data.studyTime, data.questionsAnswered, data.correctAnswers, accuracyRate]
      );

      // 记录学习轨迹
      await connection.execute(
        `INSERT INTO learning_tracks (user_id, activity_type, activity_data, subject_id)
         VALUES (?, 'study_session', ?, ?)`,
        [data.userId, JSON.stringify({
          studyTime: data.studyTime,
          questionsAnswered: data.questionsAnswered,
          correctAnswers: data.correctAnswers,
          accuracyRate
        }), data.subjectId]
      );

      // 更新学习统计
      await this.updateLearningStatistics(connection, data.userId, data.subjectId);

      await connection.commit();

      // 获取更新后的进度记录
      const [progressRows] = await connection.execute<LearningProgress[]>(
        `SELECT * FROM learning_progress 
         WHERE user_id = ? AND subject_id = ? AND study_date = CURDATE()`,
        [data.userId, data.subjectId]
      );

      return progressRows[0];
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // 更新学习统计
  private async updateLearningStatistics(connection: any, userId: number, subjectId?: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    // 计算今日学习数据
    const [todayData] = await connection.execute(
      `SELECT 
         SUM(time_spent) as total_study_time,
         SUM(total_questions) as total_questions,
         SUM(correct_answers) as correct_questions
       FROM learning_progress 
       WHERE user_id = ? AND subject_id = ? AND study_date = ?`,
      [userId, subjectId, today]
    );

    const data = todayData[0];
    const accuracyRate = data.total_questions > 0 ? 
      (data.correct_questions / data.total_questions) * 100 : 0;

    // 计算学习连续天数
    const [streakData] = await connection.execute(
      `SELECT COUNT(*) as streak FROM (
         SELECT study_date FROM learning_progress 
         WHERE user_id = ? AND subject_id = ? 
         AND study_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
         GROUP BY study_date
         ORDER BY study_date DESC
       ) as daily_study`,
      [userId, subjectId]
    );

    // 插入或更新统计数据
    await connection.execute(
      `INSERT INTO learning_statistics 
       (user_id, subject_id, stat_date, total_study_time, total_questions, correct_questions, accuracy_rate, study_streak)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       total_study_time = VALUES(total_study_time),
       total_questions = VALUES(total_questions),
       correct_questions = VALUES(correct_questions),
       accuracy_rate = VALUES(accuracy_rate),
       study_streak = VALUES(study_streak),
       updated_at = CURRENT_TIMESTAMP`,
      [userId, subjectId, today, data.total_study_time, data.total_questions, 
       data.correct_questions, accuracyRate, streakData[0].streak]
    );
  }

  // 获取学习进度统计
  async getProgressStats(userId: number, period: string, subjectId?: number): Promise<any> {
    let dateCondition = '';
    let days = 7;
    
    switch (period) {
      case '7d':
        days = 7;
        break;
      case '30d':
        days = 30;
        break;
      case '90d':
        days = 90;
        break;
      default:
        days = 7;
    }
    
    dateCondition = `AND study_date >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)`;
    
    const subjectCondition = subjectId ? 'AND subject_id = ?' : '';
    const params = subjectId ? [userId, subjectId] : [userId];

    const [rows] = await pool.execute<LearningProgress[]>(
      `SELECT 
         DATE(study_date) as date,
         SUM(time_spent) as total_study_time,
         SUM(total_questions) as total_questions,
         SUM(correct_answers) as correct_answers,
         AVG(accuracy_rate) as avg_accuracy
       FROM learning_progress 
       WHERE user_id = ? ${subjectCondition} ${dateCondition}
       GROUP BY DATE(study_date)
       ORDER BY DATE(study_date) ASC`,
      params
    );

    // 获取总体统计
    const [totalStats] = await pool.execute(
      `SELECT 
         SUM(time_spent) as total_study_time,
         SUM(total_questions) as total_questions,
         SUM(correct_answers) as correct_answers,
         AVG(accuracy_rate) as avg_accuracy,
         COUNT(DISTINCT study_date) as study_days
       FROM learning_progress 
       WHERE user_id = ? ${subjectCondition} ${dateCondition}`,
      params
    );

    return {
      dailyStats: rows,
      totalStats: totalStats[0],
      period
    };
  }

  // 获取学习轨迹
  async getLearningTrack(userId: number, startDate: string, endDate: string, subjectId?: number): Promise<LearningTrack[]> {
    const subjectCondition = subjectId ? 'AND subject_id = ?' : '';
    const params = subjectId ? [userId, startDate, endDate, subjectId] : [userId, startDate, endDate];

    const [rows] = await pool.execute<LearningTrack[]>(
      `SELECT * FROM learning_tracks 
       WHERE user_id = ? AND DATE(created_at) BETWEEN ? AND ? ${subjectCondition}
       ORDER BY created_at DESC`,
      params
    );

    return rows;
  }

  // 设置学习目标
  async setLearningGoal(data: LearningGoalData): Promise<LearningGoal> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO learning_goals 
       (user_id, goal_type, target_value, start_date, end_date, subject_id, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [data.userId, data.goalType, data.targetValue, data.startDate, data.endDate, data.subjectId, data.description]
    );

    const [rows] = await pool.execute<LearningGoal[]>(
      'SELECT * FROM learning_goals WHERE id = ?',
      [result.insertId]
    );

    return rows[0];
  }

  // 获取学习目标
  async getLearningGoals(userId: number, status?: string, goalType?: string): Promise<LearningGoal[]> {
    let whereConditions = ['user_id = ?'];
    let params: any[] = [userId];

    if (status) {
      whereConditions.push('status = ?');
      params.push(status);
    }

    if (goalType) {
      whereConditions.push('goal_type = ?');
      params.push(goalType);
    }

    const [rows] = await pool.execute<LearningGoal[]>(
      `SELECT * FROM learning_goals 
       WHERE ${whereConditions.join(' AND ')}
       ORDER BY created_at DESC`,
      params
    );

    return rows;
  }

  // 更新学习目标进度
  async updateGoalProgress(goalId: number, userId: number, currentValue: number, status?: string): Promise<LearningGoal> {
    const updateFields = ['current_value = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const params = [currentValue];

    if (status) {
      updateFields.push('status = ?');
      params.push(status);
    }

    params.push(goalId, userId);

    await pool.execute(
      `UPDATE learning_goals SET ${updateFields.join(', ')}
       WHERE id = ? AND user_id = ?`,
      params
    );

    const [rows] = await pool.execute<LearningGoal[]>(
      'SELECT * FROM learning_goals WHERE id = ? AND user_id = ?',
      [goalId, userId]
    );

    return rows[0];
  }

  // 获取学习成就
  async getLearningAchievements(userId: number): Promise<LearningAchievement[]> {
    const [rows] = await pool.execute<LearningAchievement[]>(
      'SELECT * FROM learning_achievements WHERE user_id = ? ORDER BY unlocked_at DESC',
      [userId]
    );

    return rows;
  }

  // 解锁学习成就
  async unlockAchievement(userId: number, achievementType: string, achievementData: any): Promise<LearningAchievement> {
    // 检查是否已经解锁该成就
    const [existing] = await pool.execute<LearningAchievement[]>(
      'SELECT * FROM learning_achievements WHERE user_id = ? AND achievement_type = ?',
      [userId, achievementType]
    );

    if (existing.length > 0) {
      return existing[0];
    }

    // 根据成就类型生成成就信息
    const achievementInfo = this.getAchievementInfo(achievementType, achievementData);

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO learning_achievements 
       (user_id, achievement_type, achievement_name, achievement_description, achievement_data)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, achievementType, achievementInfo.name, achievementInfo.description, JSON.stringify(achievementData)]
    );

    const [rows] = await pool.execute<LearningAchievement[]>(
      'SELECT * FROM learning_achievements WHERE id = ?',
      [result.insertId]
    );

    return rows[0];
  }

  // 获取成就信息
  private getAchievementInfo(achievementType: string, data: any): { name: string; description: string } {
    const achievements: { [key: string]: { name: string; description: string } } = {
      'first_study': {
        name: '初学者',
        description: '完成第一次学习'
      },
      'study_streak_7': {
        name: '坚持不懈',
        description: '连续学习7天'
      },
      'study_streak_30': {
        name: '学习达人',
        description: '连续学习30天'
      },
      'questions_100': {
        name: '百题斩',
        description: '累计答题100道'
      },
      'questions_1000': {
        name: '千题王',
        description: '累计答题1000道'
      },
      'accuracy_90': {
        name: '精准射手',
        description: '单日正确率达到90%'
      },
      'study_time_10h': {
        name: '勤奋学者',
        description: '单日学习时长达到10小时'
      }
    };

    return achievements[achievementType] || { name: '未知成就', description: '未知成就描述' };
  }

  // 获取学习报告
  async getLearningReport(userId: number, period: string, subjectId?: number): Promise<any> {
    let dateCondition = '';
    let days = 30;
    
    switch (period) {
      case 'week':
        days = 7;
        break;
      case 'month':
        days = 30;
        break;
      case 'quarter':
        days = 90;
        break;
      case 'year':
        days = 365;
        break;
      default:
        days = 30;
    }
    
    dateCondition = `AND stat_date >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)`;
    
    const subjectCondition = subjectId ? 'AND subject_id = ?' : '';
    const params = subjectId ? [userId, subjectId] : [userId];

    // 获取学习统计数据
    const [statsRows] = await pool.execute(
      `SELECT 
         SUM(total_study_time) as total_study_time,
         SUM(total_questions) as total_questions,
         SUM(correct_questions) as correct_questions,
         AVG(accuracy_rate) as avg_accuracy,
         MAX(study_streak) as max_streak,
         COUNT(DISTINCT stat_date) as study_days
       FROM learning_statistics 
       WHERE user_id = ? ${subjectCondition} ${dateCondition}`,
      params
    );

    // 获取学习目标完成情况
    const [goalsRows] = await pool.execute(
      `SELECT 
         COUNT(*) as total_goals,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_goals,
         SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_goals
       FROM learning_goals 
       WHERE user_id = ? ${subjectCondition} 
       AND start_date >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)`,
      params
    );

    // 获取学习成就
    const [achievementsRows] = await pool.execute(
      `SELECT COUNT(*) as total_achievements
       FROM learning_achievements 
       WHERE user_id = ? 
       AND unlocked_at >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)`,
      [userId]
    );

    return {
      period,
      statistics: statsRows[0],
      goals: goalsRows[0],
      achievements: achievementsRows[0],
      generatedAt: new Date().toISOString()
    };
  }

  // 获取学习记录
  async getProgressRecords(userId: number, startDate: string, endDate: string, subject?: string, limit: number = 20): Promise<any[]> {
    // 构建动态SQL查询 - 使用字符串拼接避免参数绑定问题
    let sql = `SELECT 
         lp.id,
         lp.user_id,
         COALESCE(lp.subject_id, 0) as subject_id,
         lp.subject_id as subject,
         lp.total_questions as questions_count,
         lp.correct_answers as correct_count,
         lp.time_spent as study_time,
         lp.accuracy_rate,
         lp.study_date as created_at
       FROM learning_progress lp
       WHERE 1=1`;
    
    if (userId) {
      sql += ` AND lp.user_id = ${userId}`;
    }
    
    if (subject && subject !== 'all') {
      sql += ` AND lp.subject_id = ${parseInt(subject)}`;
    }
    
    if (startDate && endDate) {
      sql += ` AND lp.study_date >= '${startDate}' AND lp.study_date <= '${endDate}'`;
    }
    
    sql += ' ORDER BY lp.study_date DESC, lp.id DESC';
    
    if (limit) {
      sql += ` LIMIT ${parseInt(limit.toString())}`;
    }

    const [rows] = await pool.execute(sql);

    return rows as any[];
  }

  // 获取科目列表
  async getSubjects(userId: number): Promise<any[]> {
    const [rows] = await pool.execute(
      `SELECT DISTINCT 
         COALESCE(lp.subject_id, 0) as id,
         CONCAT('科目 ', COALESCE(lp.subject_id, '未分类')) as name
       FROM learning_progress lp
       WHERE lp.user_id = ? AND lp.subject_id IS NOT NULL
       ORDER BY id`,
      [userId]
    );

    return rows as any[];
  }
}