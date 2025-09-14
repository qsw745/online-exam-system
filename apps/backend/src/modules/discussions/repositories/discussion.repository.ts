// apps/backend/src/modules/discussions/repositories/discussion.repository.ts
import { pool } from '@/config/database.js'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import type { IDiscussion, IDiscussionCategory, IDiscussionReply } from '../domain/discussion.model.js'

export class DiscussionRepository {
  // ===== 列表 / 详情 =====
  static async increaseView(id: number) {
    await pool.query('UPDATE discussions SET view_count = view_count + 1 WHERE id = ?', [id])
  }
  /**
   * 视图去重锁：同一个 viewer_key 在 TTL(秒) 内只允许统计一次
   * 返回 true 表示“应当 +1”，false 表示“TTL 未过，不加”
   */
  static async acquireViewLock(discussionId: number, viewerKey: string, ttlSeconds: number): Promise<boolean> {
    // 1) 已存在且过期 -> 刷新过期时间，允许 +1
    const [upd] = await pool.query<ResultSetHeader>(
      `UPDATE discussion_view_locks
         SET expires_at = DATE_ADD(NOW(), INTERVAL ? SECOND)
       WHERE discussion_id = ? AND viewer_key = ? AND expires_at < NOW()`,
      [ttlSeconds, discussionId, viewerKey]
    )
    if (upd.affectedRows > 0) return true

    // 2) 不存在 -> 插入（首次），允许 +1
    const [ins] = await pool.query<ResultSetHeader>(
      `INSERT IGNORE INTO discussion_view_locks (discussion_id, viewer_key, expires_at)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))`,
      [discussionId, viewerKey, ttlSeconds]
    )
    if (ins.affectedRows > 0) return true

    // 3) 存在且未过期 -> 不允许 +1
    return false
  }
  // 扁平获取某讨论下的全部回复（含作者 & 是否已点赞），按创建时间升序
  static async getRepliesFlat(userId: number | null, discussionId: number) {
    const sql = `
    SELECT dr.*, u.username, u.avatar_url as avatar,
           ${
             userId
               ? `EXISTS(
                    SELECT 1 FROM discussion_likes dl
                    WHERE dl.user_id = ? AND dl.target_type = 'reply' AND dl.target_id = dr.id
                  ) as is_liked`
               : 'FALSE as is_liked'
           }
    FROM discussion_replies dr
    LEFT JOIN users u ON dr.user_id = u.id
    WHERE dr.discussion_id = ?
    ORDER BY dr.created_at ASC
  `
    const params = userId ? [userId, discussionId] : [discussionId]
    const [rows] = await pool.query<IDiscussionReply[]>(sql, params)
    return rows
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

  // ===== 写操作（讨论 / 回复）=====
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
    const [rows] = await pool.query<RowDataPacket[]>('SELECT user_id FROM discussions WHERE id = ?', [id])
    return rows[0] as { user_id: number } | undefined
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

  // ===== 点赞 / 收藏 =====
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
    const likeCount = Number((countRows as any)[0]?.like_count ?? 0)
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

  // ===== 关注（之前在 Service，这里下沉到 Repo）=====
  static async toggleFollow(userId: number, discussionId: number): Promise<{ is_followed: boolean }> {
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

  // ===== 举报（之前在 Service，这里下沉到 Repo）=====
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

  // ===== 管理辅助 =====
  static async isAdmin(userId: number): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT role FROM users WHERE id = ?', [userId])
    return (rows[0] as any)?.role === 'admin'
  }

  static async clearSolutions(discussionId: number) {
    await pool.query('UPDATE discussion_replies SET is_solution = FALSE WHERE discussion_id = ?', [discussionId])
  }

  static async markReplyAsSolution(replyId: number, discussionId: number): Promise<boolean> {
    const [ret] = await pool.query<ResultSetHeader>(
      'UPDATE discussion_replies SET is_solution = TRUE WHERE id = ? AND discussion_id = ?',
      [replyId, discussionId]
    )
    return ret.affectedRows > 0
  }

  static async getReplyAuthorId(replyId: number): Promise<number | null> {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT user_id FROM discussion_replies WHERE id = ?', [replyId])
    return rows[0] ? Number(rows[0].user_id) : null
  }

  static async incUserSolutionStats(userId: number) {
    await pool.query(
      `INSERT INTO user_discussion_stats (user_id, solutions_count, reputation_score)
       VALUES (?, 1, 10)
       ON DUPLICATE KEY UPDATE solutions_count = solutions_count + 1, reputation_score = reputation_score + 10`,
      [userId]
    )
  }

  static async togglePin(discussionId: number) {
    await pool.query('UPDATE discussions SET is_pinned = NOT is_pinned WHERE id = ?', [discussionId])
  }

  static async toggleLock(discussionId: number) {
    await pool.query('UPDATE discussions SET is_locked = NOT is_locked WHERE id = ?', [discussionId])
  }

  static async toggleFeatured(discussionId: number) {
    await pool.query('UPDATE discussions SET is_featured = NOT is_featured WHERE id = ?', [discussionId])
  }
}
