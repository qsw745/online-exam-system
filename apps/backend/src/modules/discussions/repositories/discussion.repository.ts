// apps/backend/src/modules/discussions/repositories/discussion.repository.ts
import { pool } from '@config/database.js'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import type { IDiscussion, IDiscussionReply, IDiscussionCategory, IDiscussionTag } from '../domain/discussion.types.js'

export class DiscussionRepository {
  static async increaseView(id: number) {
    await pool.query('UPDATE discussions SET view_count = view_count + 1 WHERE id = ?', [id])
  }

  static async queryList(userId: number | null, whereSql: string, params: any[], limit: number, offset: number) {
    const sql = `
      SELECT d.*, u.username, u.avatar_url as avatar, dc.name as category_name, dc.color as category_color,
             ${
               userId
                 ? `
             EXISTS(SELECT 1 FROM discussion_likes dl WHERE dl.user_id = ? AND dl.target_type = 'discussion' AND dl.target_id = d.id) as is_liked,
             EXISTS(SELECT 1 FROM discussion_bookmarks db WHERE db.user_id = ? AND db.discussion_id = d.id) as is_bookmarked,
             EXISTS(SELECT 1 FROM discussion_follows df WHERE df.user_id = ? AND df.discussion_id = d.id) as is_followed
             `
                 : 'FALSE as is_liked, FALSE as is_bookmarked, FALSE as is_followed'
             }
      FROM discussions d
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN discussion_categories dc ON d.category_id = dc.id
      ${whereSql}
      LIMIT ? OFFSET ?`
    const queryParams = userId ? [userId, userId, userId, ...params, limit, offset] : [...params, limit, offset]
    const [rows] = await pool.query<IDiscussion[]>(sql, queryParams)
    return rows
  }

  static async count(whereSql: string, params: any[]) {
    const [rows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) as total FROM discussions d ${whereSql}`, params)
    return Number(rows[0]?.total ?? 0)
  }

  static async getCategories() {
    const [rows] = await pool.query<IDiscussionCategory[]>(
      `SELECT dc.*, COUNT(d.id) as discussions_count
       FROM discussion_categories dc
       LEFT JOIN discussions d ON dc.id = d.category_id
       WHERE dc.is_active = TRUE
       GROUP BY dc.id
       ORDER BY dc.sort_order ASC`
    )
    return rows
  }

  static async getById(userId: number | null, id: number) {
    const sql = `
      SELECT d.*, u.username, u.avatar_url as avatar, dc.name as category_name, dc.color as category_color,
             ${
               userId
                 ? `
             EXISTS(SELECT 1 FROM discussion_likes dl WHERE dl.user_id = ? AND dl.target_type = 'discussion' AND dl.target_id = d.id) as is_liked,
             EXISTS(SELECT 1 FROM discussion_bookmarks db WHERE db.user_id = ? AND db.discussion_id = d.id) as is_bookmarked,
             EXISTS(SELECT 1 FROM discussion_follows df WHERE df.user_id = ? AND df.discussion_id = d.id) as is_followed
             `
                 : 'FALSE as is_liked, FALSE as is_bookmarked, FALSE as is_followed'
             }
      FROM discussions d
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN discussion_categories dc ON d.category_id = dc.id
      WHERE d.id = ?`
    const params = userId ? [userId, userId, userId, id] : [id]
    const [rows] = await pool.query<IDiscussion[]>(sql, params)
    return rows[0]
  }

  static async getTopReplies(userId: number | null, discussionId: number, limit: number, offset: number) {
    const sql = `
      SELECT dr.*, u.username, u.avatar_url as avatar,
             ${
               userId
                 ? `EXISTS(SELECT 1 FROM discussion_likes dl WHERE dl.user_id = ? AND dl.target_type = 'reply' AND dl.target_id = dr.id) as is_liked`
                 : 'FALSE as is_liked'
             }
      FROM discussion_replies dr
      LEFT JOIN users u ON dr.user_id = u.id
      WHERE dr.discussion_id = ? AND dr.parent_id IS NULL
      ORDER BY dr.is_solution DESC, dr.created_at ASC
      LIMIT ? OFFSET ?`
    const params = userId ? [userId, discussionId, limit, offset] : [discussionId, limit, offset]
    const [rows] = await pool.query<IDiscussionReply[]>(sql, params)
    return rows
  }

  static async getChildReplies(userId: number | null, parentId: number) {
    const sql = `
      SELECT dr.*, u.username, u.avatar_url as avatar,
             ${
               userId
                 ? `EXISTS(SELECT 1 FROM discussion_likes dl WHERE dl.user_id = ? AND dl.target_type = 'reply' AND dl.target_id = dr.id) as is_liked`
                 : 'FALSE as is_liked'
             }
      FROM discussion_replies dr
      LEFT JOIN users u ON dr.user_id = u.id
      WHERE dr.parent_id = ?
      ORDER BY dr.created_at ASC`
    const params = userId ? [userId, parentId] : [parentId]
    const [rows] = await pool.query<IDiscussionReply[]>(sql, params)
    return rows
  }

  static async insertDiscussion(userId: number, payload: any) {
    const [ret] = await pool.query<ResultSetHeader>(
      `INSERT INTO discussions (user_id, category_id, title, content, tags, related_type, related_id, last_reply_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        userId,
        payload.category_id ?? null,
        payload.title,
        payload.content,
        JSON.stringify(payload.tags ?? []),
        payload.related_type ?? 'general',
        payload.related_id ?? null,
      ]
    )
    return ret.insertId
  }

  static async updateDiscussion(userId: number, id: number, payload: any) {
    const [ret] = await pool.query<ResultSetHeader>(
      'UPDATE discussions SET title = ?, content = ?, category_id = ?, tags = ? WHERE id = ? AND user_id = ?',
      [payload.title, payload.content, payload.category_id ?? null, JSON.stringify(payload.tags ?? []), id, userId]
    )
    return ret.affectedRows > 0
  }

  static async findOwner(id: number) {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM discussions WHERE id = ?', [id])
    return rows[0]
  }

  static async deleteById(id: number) {
    const [ret] = await pool.query<ResultSetHeader>('DELETE FROM discussions WHERE id = ?', [id])
    return ret.affectedRows > 0
  }

  static async insertReply(discussionId: number, userId: number, content: string, parent_id?: number | null) {
    const [ret] = await pool.query<ResultSetHeader>(
      'INSERT INTO discussion_replies (discussion_id, user_id, parent_id, content) VALUES (?, ?, ?, ?)',
      [discussionId, userId, parent_id ?? null, content]
    )
    return ret.insertId
  }

  static async bumpReplyMeta(discussionId: number, userId: number, parent_id?: number | null) {
    await pool.query(
      'UPDATE discussions SET reply_count = reply_count + 1, last_reply_at = NOW(), last_reply_user_id = ? WHERE id = ?',
      [userId, discussionId]
    )
    if (parent_id)
      await pool.query('UPDATE discussion_replies SET reply_count = reply_count + 1 WHERE id = ?', [parent_id])
  }

  static async toggleLike(userId: number, target_type: 'discussion' | 'reply', target_id: number) {
    const [exists] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM discussion_likes WHERE user_id = ? AND target_type = ? AND target_id = ?',
      [userId, target_type, target_id]
    )
    if (exists.length > 0) {
      await pool.query('DELETE FROM discussion_likes WHERE user_id = ? AND target_type = ? AND target_id = ?', [
        userId,
        target_type,
        target_id,
      ])
    } else {
      await pool.query('INSERT INTO discussion_likes (user_id, target_type, target_id) VALUES (?, ?, ?)', [
        userId,
        target_type,
        target_id,
      ])
    }
    const tableName = target_type === 'discussion' ? 'discussions' : 'discussion_replies'
    const [countRows] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as like_count FROM discussion_likes WHERE target_type = ? AND target_id = ?',
      [target_type, target_id]
    )
    const likeCount = Number(countRows[0]?.like_count ?? 0)
    await pool.query(`UPDATE ${tableName} SET like_count = ? WHERE id = ?`, [likeCount, target_id])
    return { is_liked: exists.length === 0, like_count: likeCount }
  }

  static async toggleBookmark(userId: number, discussionId: number) {
    const [exists] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM discussion_bookmarks WHERE user_id = ? AND discussion_id = ?',
      [userId, discussionId]
    )
    if (exists.length > 0) {
      await pool.query('DELETE FROM discussion_bookmarks WHERE user_id = ? AND discussion_id = ?', [
        userId,
        discussionId,
      ])
      return { is_bookmarked: false }
    } else {
      await pool.query('INSERT INTO discussion_bookmarks (user_id, discussion_id) VALUES (?, ?)', [
        userId,
        discussionId,
      ])
      return { is_bookmarked: true }
    }
  }
}
