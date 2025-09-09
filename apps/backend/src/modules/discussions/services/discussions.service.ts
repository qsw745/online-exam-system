// apps/backend/src/modules/discussions/services/discussions.service.ts
import { pool } from '@config/database.js'
import type { RowDataPacket } from 'mysql2'
import { DiscussionRepository } from '../repositories/discussion.repository.js'

export class DiscussionsService {
  static async markAsSolution(replyId: number, discussionId: number, userId: number): Promise<boolean> {
    const [owner] = await pool.query<RowDataPacket[]>('SELECT user_id FROM discussions WHERE id = ?', [discussionId])
    if (owner.length === 0 || owner[0].user_id !== userId) return false
    await pool.query('UPDATE discussion_replies SET is_solution = FALSE WHERE discussion_id = ?', [discussionId])
    await pool.query('UPDATE discussion_replies SET is_solution = TRUE WHERE id = ? AND discussion_id = ?', [
      replyId,
      discussionId,
    ])
    const [replyRows] = await pool.query<RowDataPacket[]>('SELECT user_id FROM discussion_replies WHERE id = ?', [
      replyId,
    ])
    if (replyRows.length > 0) {
      await pool.query(
        `INSERT INTO user_discussion_stats (user_id, solutions_count, reputation_score)
         VALUES (?, 1, 10)
         ON DUPLICATE KEY UPDATE solutions_count = solutions_count + 1, reputation_score = reputation_score + 10`,
        [replyRows[0].user_id]
      )
    }
    return true
  }

  static async togglePin(discussionId: number, userId: number): Promise<boolean> {
    if (!(await this.isAdmin(userId))) return false
    await pool.query('UPDATE discussions SET is_pinned = NOT is_pinned WHERE id = ?', [discussionId])
    return true
  }

  static async toggleLock(discussionId: number, userId: number): Promise<boolean> {
    if (!(await this.isAdmin(userId))) return false
    await pool.query('UPDATE discussions SET is_locked = NOT is_locked WHERE id = ?', [discussionId])
    return true
  }

  static async toggleFeatured(discussionId: number, userId: number): Promise<boolean> {
    if (!(await this.isAdmin(userId))) return false
    await pool.query('UPDATE discussions SET is_featured = NOT is_featured WHERE id = ?', [discussionId])
    return true
  }

  static async toggleFollow(discussionId: number, userId: number): Promise<{ is_followed: boolean }> {
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM discussion_follows WHERE user_id = ? AND discussion_id = ?',
      [userId, discussionId]
    )
    if (existing.length > 0) {
      await pool.query('DELETE FROM discussion_follows WHERE user_id = ? AND discussion_id = ?', [userId, discussionId])
      return { is_followed: false }
    } else {
      await pool.query('INSERT INTO discussion_follows (user_id, discussion_id) VALUES (?, ?)', [userId, discussionId])
      return { is_followed: true }
    }
  }

  static async reportContent(
    userId: number,
    targetType: 'discussion' | 'reply',
    targetId: number,
    reason: string,
    description?: string
  ): Promise<boolean> {
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM discussion_reports WHERE user_id = ? AND target_type = ? AND target_id = ?',
      [userId, targetType, targetId]
    )
    if (existing.length > 0) return false
    await pool.query(
      'INSERT INTO discussion_reports (user_id, target_type, target_id, reason, description) VALUES (?, ?, ?, ?, ?)',
      [userId, targetType, targetId, reason, description ?? null]
    )
    return true
  }

  private static async isAdmin(userId: number) {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT role FROM users WHERE id = ?', [userId])
    return rows[0]?.role === 'admin'
  }
}
