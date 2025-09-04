import { pool } from '@config/database.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export class DiscussionsService {
  // 标记回复为解决方案
  static async markAsSolution(replyId: number, discussionId: number, userId: number): Promise<boolean> {
    try {
      // 检查权限（只有讨论作者可以标记解决方案）
      const [discussions] = await pool.query<RowDataPacket[]>(
        'SELECT user_id FROM discussions WHERE id = ?',
        [discussionId]
      );
      
      if (discussions.length === 0 || discussions[0].user_id !== userId) {
        return false;
      }
      
      // 取消其他解决方案标记
      await pool.query(
        'UPDATE discussion_replies SET is_solution = FALSE WHERE discussion_id = ?',
        [discussionId]
      );
      
      // 标记新的解决方案
      await pool.query(
        'UPDATE discussion_replies SET is_solution = TRUE WHERE id = ? AND discussion_id = ?',
        [replyId, discussionId]
      );
      
      // 更新用户统计
      const [replies] = await pool.query<RowDataPacket[]>(
        'SELECT user_id FROM discussion_replies WHERE id = ?',
        [replyId]
      );
      
      if (replies.length > 0) {
        await pool.query(
          `INSERT INTO user_discussion_stats (user_id, solutions_count, reputation_score)
           VALUES (?, 1, 10)
           ON DUPLICATE KEY UPDATE
           solutions_count = solutions_count + 1,
           reputation_score = reputation_score + 10`,
          [replies[0].user_id]
        );
      }
      
      return true;
    } catch (error) {
      console.error('标记解决方案错误:', error);
      return false;
    }
  }
  
  // 置顶/取消置顶讨论
  static async togglePin(discussionId: number, userId: number): Promise<boolean> {
    try {
      // 检查管理员权限
      const [users] = await pool.query<RowDataPacket[]>(
        'SELECT role FROM users WHERE id = ?',
        [userId]
      );
      
      if (users.length === 0 || users[0].role !== 'admin') {
        return false;
      }
      
      // 切换置顶状态
      await pool.query(
        'UPDATE discussions SET is_pinned = NOT is_pinned WHERE id = ?',
        [discussionId]
      );
      
      return true;
    } catch (error) {
      console.error('置顶操作错误:', error);
      return false;
    }
  }
  
  // 锁定/解锁讨论
  static async toggleLock(discussionId: number, userId: number): Promise<boolean> {
    try {
      // 检查管理员权限
      const [users] = await pool.query<RowDataPacket[]>(
        'SELECT role FROM users WHERE id = ?',
        [userId]
      );
      
      if (users.length === 0 || users[0].role !== 'admin') {
        return false;
      }
      
      // 切换锁定状态
      await pool.query(
        'UPDATE discussions SET is_locked = NOT is_locked WHERE id = ?',
        [discussionId]
      );
      
      return true;
    } catch (error) {
      console.error('锁定操作错误:', error);
      return false;
    }
  }
  
  // 设置/取消精选讨论
  static async toggleFeatured(discussionId: number, userId: number): Promise<boolean> {
    try {
      // 检查管理员权限
      const [users] = await pool.query<RowDataPacket[]>(
        'SELECT role FROM users WHERE id = ?',
        [userId]
      );
      
      if (users.length === 0 || users[0].role !== 'admin') {
        return false;
      }
      
      // 切换精选状态
      await pool.query(
        'UPDATE discussions SET is_featured = NOT is_featured WHERE id = ?',
        [discussionId]
      );
      
      return true;
    } catch (error) {
      console.error('精选操作错误:', error);
      return false;
    }
  }
  
  // 关注/取消关注讨论
  static async toggleFollow(discussionId: number, userId: number): Promise<{ is_followed: boolean }> {
    try {
      // 检查是否已关注
      const [existing] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM discussion_follows WHERE user_id = ? AND discussion_id = ?',
        [userId, discussionId]
      );
      
      let isFollowed: boolean;
      
      if (existing.length > 0) {
        // 取消关注
        await pool.query(
          'DELETE FROM discussion_follows WHERE user_id = ? AND discussion_id = ?',
          [userId, discussionId]
        );
        isFollowed = false;
      } else {
        // 添加关注
        await pool.query(
          'INSERT INTO discussion_follows (user_id, discussion_id) VALUES (?, ?)',
          [userId, discussionId]
        );
        isFollowed = true;
      }
      
      return { is_followed: isFollowed };
    } catch (error) {
      console.error('关注操作错误:', error);
      throw error;
    }
  }
  
  // 举报讨论或回复
  static async reportContent(
    userId: number,
    targetType: 'discussion' | 'reply',
    targetId: number,
    reason: string,
    description?: string
  ): Promise<boolean> {
    try {
      // 检查是否已举报
      const [existing] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM discussion_reports WHERE user_id = ? AND target_type = ? AND target_id = ?',
        [userId, targetType, targetId]
      );
      
      if (existing.length > 0) {
        return false; // 已举报过
      }
      
      await pool.query(
        'INSERT INTO discussion_reports (user_id, target_type, target_id, reason, description) VALUES (?, ?, ?, ?, ?)',
        [userId, targetType, targetId, reason, description || null]
      );
      
      return true;
    } catch (error) {
      console.error('举报操作错误:', error);
      return false;
    }
  }
  
  // 获取用户的收藏讨论列表
  static async getUserBookmarks(
    userId: number,
    page: number = 1,
    limit: number = 20
  ): Promise<{ discussions: any[]; total: number }> {
    try {
      const offset = (page - 1) * limit;
      
      // 查询收藏的讨论
      const [discussions] = await pool.query<RowDataPacket[]>(
        `SELECT d.*, u.username, u.avatar, dc.name as category_name, dc.color as category_color,
                db.created_at as bookmarked_at
         FROM discussion_bookmarks db
         JOIN discussions d ON db.discussion_id = d.id
         LEFT JOIN users u ON d.user_id = u.id
         LEFT JOIN discussion_categories dc ON d.category_id = dc.id
         WHERE db.user_id = ?
         ORDER BY db.created_at DESC
         LIMIT ? OFFSET ?`,
        [userId, limit, offset]
      );
      
      // 查询总数
      const [countResult] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as total FROM discussion_bookmarks WHERE user_id = ?',
        [userId]
      );
      
      return {
        discussions,
        total: countResult[0].total
      };
    } catch (error) {
      console.error('获取用户收藏错误:', error);
      throw error;
    }
  }
  
  // 获取用户参与的讨论
  static async getUserParticipations(
    userId: number,
    page: number = 1,
    limit: number = 20
  ): Promise<{ discussions: any[]; total: number }> {
    try {
      const offset = (page - 1) * limit;
      
      // 查询用户参与的讨论（发起的或回复过的）
      const [discussions] = await pool.query<RowDataPacket[]>(
        `SELECT DISTINCT d.*, u.username, u.avatar, dc.name as category_name, dc.color as category_color,
                CASE WHEN d.user_id = ? THEN 'author' ELSE 'participant' END as participation_type
         FROM discussions d
         LEFT JOIN users u ON d.user_id = u.id
         LEFT JOIN discussion_categories dc ON d.category_id = dc.id
         WHERE d.user_id = ? OR d.id IN (
           SELECT DISTINCT discussion_id FROM discussion_replies WHERE user_id = ?
         )
         ORDER BY d.last_reply_at DESC
         LIMIT ? OFFSET ?`,
        [userId, userId, userId, limit, offset]
      );
      
      // 查询总数
      const [countResult] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(DISTINCT d.id) as total
         FROM discussions d
         WHERE d.user_id = ? OR d.id IN (
           SELECT DISTINCT discussion_id FROM discussion_replies WHERE user_id = ?
         )`,
        [userId, userId]
      );
      
      return {
        discussions,
        total: countResult[0].total
      };
    } catch (error) {
      console.error('获取用户参与讨论错误:', error);
      throw error;
    }
  }
  
  // 搜索讨论
  static async searchDiscussions(
    keyword: string,
    filters: {
      category_id?: number;
      tags?: string[];
      user_id?: number;
      date_range?: { start: Date; end: Date };
    } = {},
    page: number = 1,
    limit: number = 20
  ): Promise<{ discussions: any[]; total: number }> {
    try {
      const offset = (page - 1) * limit;
      
      let whereClause = 'WHERE (d.title LIKE ? OR d.content LIKE ?)';
      const params: any[] = [`%${keyword}%`, `%${keyword}%`];
      
      if (filters.category_id) {
        whereClause += ' AND d.category_id = ?';
        params.push(filters.category_id);
      }
      
      if (filters.user_id) {
        whereClause += ' AND d.user_id = ?';
        params.push(filters.user_id);
      }
      
      if (filters.tags && filters.tags.length > 0) {
        const tagConditions = filters.tags.map(() => 'JSON_CONTAINS(d.tags, ?)');
        whereClause += ` AND (${tagConditions.join(' OR ')})`;
        filters.tags.forEach(tag => params.push(JSON.stringify(tag)));
      }
      
      if (filters.date_range) {
        whereClause += ' AND d.created_at BETWEEN ? AND ?';
        params.push(filters.date_range.start, filters.date_range.end);
      }
      
      // 查询讨论
      const [discussions] = await pool.query<RowDataPacket[]>(
        `SELECT d.*, u.username, u.avatar, dc.name as category_name, dc.color as category_color
         FROM discussions d
         LEFT JOIN users u ON d.user_id = u.id
         LEFT JOIN discussion_categories dc ON d.category_id = dc.id
         ${whereClause}
         ORDER BY d.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );
      
      // 查询总数
      const [countResult] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM discussions d ${whereClause}`,
        params
      );
      
      return {
        discussions,
        total: countResult[0].total
      };
    } catch (error) {
      console.error('搜索讨论错误:', error);
      throw error;
    }
  }
  
  // 获取讨论统计信息
  static async getDiscussionStats(): Promise<any> {
    try {
      // 总讨论数
      const [totalDiscussions] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as total FROM discussions'
      );
      
      // 总回复数
      const [totalReplies] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as total FROM discussion_replies'
      );
      
      // 活跃用户数（最近30天有发帖或回复）
      const [activeUsers] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(DISTINCT user_id) as total
         FROM (
           SELECT user_id FROM discussions WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
           UNION
           SELECT user_id FROM discussion_replies WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         ) as active_users`
      );
      
      // 今日新增讨论数
      const [todayDiscussions] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as total FROM discussions WHERE DATE(created_at) = CURDATE()'
      );
      
      // 热门分类
      const [popularCategories] = await pool.query<RowDataPacket[]>(
        `SELECT dc.name, dc.color, COUNT(d.id) as discussions_count
         FROM discussion_categories dc
         LEFT JOIN discussions d ON dc.id = d.category_id
         WHERE dc.is_active = TRUE
         GROUP BY dc.id
         ORDER BY discussions_count DESC
         LIMIT 5`
      );
      
      return {
        total_discussions: totalDiscussions[0].total,
        total_replies: totalReplies[0].total,
        active_users: activeUsers[0].total,
        today_discussions: todayDiscussions[0].total,
        popular_categories: popularCategories
      };
    } catch (error) {
      console.error('获取讨论统计错误:', error);
      throw error;
    }
  }
  
  // 清理过期数据
  static async cleanupExpiredData(): Promise<void> {
    try {
      // 清理30天前的访问日志（如果有的话）
      // 这里可以根据需要添加清理逻辑
      
      // 更新用户声誉分数
      await pool.query(
        `UPDATE user_discussion_stats uds
         SET reputation_score = (
           SELECT COALESCE(
             (SELECT SUM(like_count) FROM discussions WHERE user_id = uds.user_id) * 2 +
             (SELECT SUM(like_count) FROM discussion_replies WHERE user_id = uds.user_id) +
             (SELECT COUNT(*) FROM discussion_replies WHERE user_id = uds.user_id AND is_solution = TRUE) * 10,
             0
           )
         )`
      );
      
      console.log('讨论区数据清理完成');
    } catch (error) {
      console.error('清理过期数据错误:', error);
    }
  }
}
