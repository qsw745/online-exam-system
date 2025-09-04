import { Request, Response } from 'express';
import { pool } from '@config/database.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { AuthRequest } from 'types/auth.js';
import { ApiResponse } from 'types/response.js';

interface IDiscussion extends RowDataPacket {
  id: number;
  user_id: number;
  category_id: number;
  title: string;
  content: string;
  tags: string[];
  related_type: 'question' | 'exam' | 'task' | 'general';
  related_id: number;
  is_pinned: boolean;
  is_locked: boolean;
  is_featured: boolean;
  view_count: number;
  reply_count: number;
  like_count: number;
  last_reply_at: Date;
  last_reply_user_id: number;
  created_at: Date;
  updated_at: Date;
  username?: string;
  avatar?: string;
  category_name?: string;
  category_color?: string;
  is_liked?: boolean;
  is_bookmarked?: boolean;
  is_followed?: boolean;
}

interface IDiscussionReply extends RowDataPacket {
  id: number;
  discussion_id: number;
  user_id: number;
  parent_id: number;
  content: string;
  is_solution: boolean;
  like_count: number;
  reply_count: number;
  created_at: Date;
  updated_at: Date;
  username?: string;
  avatar?: string;
  is_liked?: boolean;
  children?: IDiscussionReply[];
}

interface IDiscussionCategory extends RowDataPacket {
  id: number;
  name: string;
  description: string;
  icon: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  discussions_count?: number;
}

interface IDiscussionTag extends RowDataPacket {
  id: number;
  name: string;
  color: string;
  usage_count: number;
}

export class DiscussionsController {
  // 获取讨论列表
  static async getDiscussions(
    req: AuthRequest,
    res: Response<ApiResponse<{ discussions: IDiscussion[]; total: number; categories: IDiscussionCategory[] }>>
  ) {
    try {
      const userId = req.user?.id
      const {
        page = 1,
        limit = 20,
        category_id,
        sort = 'latest',
        search,
        related_type,
        related_id,
        is_featured,
      } = req.query

      const offset = (parseInt(page as string) - 1) * parseInt(limit as string)

      // 构建查询条件
      let whereClause = 'WHERE 1=1'
      const params: any[] = []

      if (category_id) {
        whereClause += ' AND d.category_id = ?'
        params.push(category_id)
      }

      if (search) {
        whereClause += ' AND (d.title LIKE ? OR d.content LIKE ?)'
        params.push(`%${search}%`, `%${search}%`)
      }

      if (related_type && related_id) {
        whereClause += ' AND d.related_type = ? AND d.related_id = ?'
        params.push(related_type, related_id)
      }

      if (is_featured === 'true') {
        whereClause += ' AND d.is_featured = TRUE'
      }

      // 构建排序条件
      let orderClause = ''
      switch (sort) {
        case 'hot':
          orderClause =
            'ORDER BY d.is_pinned DESC, (d.like_count + d.reply_count * 2 + d.view_count * 0.1) DESC, d.created_at DESC'
          break
        case 'replies':
          orderClause = 'ORDER BY d.is_pinned DESC, d.reply_count DESC, d.created_at DESC'
          break
        case 'likes':
          orderClause = 'ORDER BY d.is_pinned DESC, d.like_count DESC, d.created_at DESC'
          break
        default:
          orderClause = 'ORDER BY d.is_pinned DESC, d.last_reply_at DESC, d.created_at DESC'
      }

      // 查询讨论列表
      const discussionQuery = `
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
        ${whereClause}
        ${orderClause}
        LIMIT ? OFFSET ?
      `

      const queryParams = userId
        ? [userId, userId, userId, ...params, parseInt(limit as string), offset]
        : [...params, parseInt(limit as string), offset]
      const [discussions] = await pool.query<IDiscussion[]>(discussionQuery, queryParams)

      // 查询总数
      const countQuery = `SELECT COUNT(*) as total FROM discussions d ${whereClause}`
      const [countResult] = await pool.query<RowDataPacket[]>(countQuery, params)
      const total = countResult[0].total

      // 查询分类列表
      const [categories] = await pool.query<IDiscussionCategory[]>(
        `SELECT dc.*, COUNT(d.id) as discussions_count
         FROM discussion_categories dc
         LEFT JOIN discussions d ON dc.id = d.category_id
         WHERE dc.is_active = TRUE
         GROUP BY dc.id
         ORDER BY dc.sort_order ASC`
      )

      return res.json({
        success: true,
        data: {
          discussions,
          total,
          categories,
        },
      })
    } catch (error) {
      console.error('获取讨论列表错误:', error)
      return res.status(500).json({
        success: false,
        error: '获取讨论列表失败',
      })
    }
  }

  // 获取讨论详情
  static async getDiscussionDetail(
    req: AuthRequest,
    res: Response<ApiResponse<{ discussion: IDiscussion; replies: IDiscussionReply[] }>>
  ) {
    try {
      const userId = req.user?.id
      const discussionId = parseInt(req.params.id)
      const { page = 1, limit = 20 } = req.query

      if (isNaN(discussionId)) {
        return res.status(400).json({
          success: false,
          error: '无效的讨论ID',
        })
      }

      // 增加浏览次数
      await pool.query('UPDATE discussions SET view_count = view_count + 1 WHERE id = ?', [discussionId])

      // 查询讨论详情
      const discussionQuery = `
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
        WHERE d.id = ?
      `

      const queryParams = userId ? [userId, userId, userId, discussionId] : [discussionId]
      const [discussions] = await pool.query<IDiscussion[]>(discussionQuery, queryParams)

      if (discussions.length === 0) {
        return res.status(404).json({
          success: false,
          error: '讨论不存在',
        })
      }

      const discussion = discussions[0]

      // 查询回复列表
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string)
      const repliesQuery = `
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
        LIMIT ? OFFSET ?
      `

      const repliesParams = userId
        ? [userId, discussionId, parseInt(limit as string), offset]
        : [discussionId, parseInt(limit as string), offset]
      const [replies] = await pool.query<IDiscussionReply[]>(repliesQuery, repliesParams)

      // 查询子回复
      for (const reply of replies) {
        const childRepliesQuery = `
          SELECT dr.*, u.username, u.avatar,
                 ${
                   userId
                     ? `EXISTS(SELECT 1 FROM discussion_likes dl WHERE dl.user_id = ? AND dl.target_type = 'reply' AND dl.target_id = dr.id) as is_liked`
                     : 'FALSE as is_liked'
                 }
          FROM discussion_replies dr
          LEFT JOIN users u ON dr.user_id = u.id
          WHERE dr.parent_id = ?
          ORDER BY dr.created_at ASC
        `

        const childParams = userId ? [userId, reply.id] : [reply.id]
        const [childReplies] = await pool.query<IDiscussionReply[]>(childRepliesQuery, childParams)
        reply.children = childReplies
      }

      return res.json({
        success: true,
        data: {
          discussion,
          replies,
        },
      })
    } catch (error) {
      console.error('获取讨论详情错误:', error)
      return res.status(500).json({
        success: false,
        error: '获取讨论详情失败',
      })
    }
  }

  // 创建讨论
  static async createDiscussion(req: AuthRequest, res: Response<ApiResponse<{ discussion_id: number }>>) {
    try {
      const userId = req.user?.id
      const { title, content, category_id, tags, related_type, related_id } = req.body

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: '未授权访问',
        })
      }

      const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO discussions (user_id, category_id, title, content, tags, related_type, related_id, last_reply_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          userId,
          category_id || null,
          title,
          content,
          JSON.stringify(tags || []),
          related_type || 'general',
          related_id || null,
        ]
      )

      // 更新用户统计
      await pool.query(
        `INSERT INTO user_discussion_stats (user_id, discussions_count, last_active_at)
         VALUES (?, 1, NOW())
         ON DUPLICATE KEY UPDATE
         discussions_count = discussions_count + 1,
         last_active_at = NOW()`,
        [userId]
      )

      // 更新标签使用次数
      if (tags && Array.isArray(tags)) {
        for (const tag of tags) {
          await pool.query(
            `INSERT INTO discussion_tags (name, usage_count)
             VALUES (?, 1)
             ON DUPLICATE KEY UPDATE usage_count = usage_count + 1`,
            [tag]
          )
        }
      }

      return res.json({
        success: true,
        data: { discussion_id: result.insertId },
      })
    } catch (error) {
      console.error('创建讨论错误:', error)
      return res.status(500).json({
        success: false,
        error: '创建讨论失败',
      })
    }
  }

  // 更新讨论
  static async updateDiscussion(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      const discussionId = parseInt(req.params.id)
      const { title, content, category_id, tags } = req.body

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: '未授权访问',
        })
      }

      if (isNaN(discussionId)) {
        return res.status(400).json({
          success: false,
          error: '无效的讨论ID',
        })
      }

      // 检查权限
      const [discussions] = await pool.query<IDiscussion[]>('SELECT * FROM discussions WHERE id = ? AND user_id = ?', [
        discussionId,
        userId,
      ])

      if (discussions.length === 0) {
        return res.status(404).json({
          success: false,
          error: '讨论不存在或无权修改',
        })
      }

      await pool.query('UPDATE discussions SET title = ?, content = ?, category_id = ?, tags = ? WHERE id = ?', [
        title,
        content,
        category_id || null,
        JSON.stringify(tags || []),
        discussionId,
      ])

      return res.json({
        success: true,
        data: null,
      })
    } catch (error) {
      console.error('更新讨论错误:', error)
      return res.status(500).json({
        success: false,
        error: '更新讨论失败',
      })
    }
  }

  // 删除讨论
  static async deleteDiscussion(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      const discussionId = parseInt(req.params.id)

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: '未授权访问',
        })
      }

      if (isNaN(discussionId)) {
        return res.status(400).json({
          success: false,
          error: '无效的讨论ID',
        })
      }

      // 检查权限（作者或管理员）
      const [discussions] = await pool.query<IDiscussion[]>('SELECT * FROM discussions WHERE id = ?', [discussionId])

      if (discussions.length === 0) {
        return res.status(404).json({
          success: false,
          error: '讨论不存在',
        })
      }

      const discussion = discussions[0]

      // 检查用户权限
      const [users] = await pool.query<RowDataPacket[]>('SELECT role FROM users WHERE id = ?', [userId])

      const isAuthor = discussion.user_id === userId
      const isAdmin = users[0]?.role === 'admin'

      if (!isAuthor && !isAdmin) {
        return res.status(403).json({
          success: false,
          error: '无权删除此讨论',
        })
      }

      await pool.query('DELETE FROM discussions WHERE id = ?', [discussionId])

      // 更新用户统计
      await pool.query(
        `UPDATE user_discussion_stats 
         SET discussions_count = GREATEST(discussions_count - 1, 0)
         WHERE user_id = ?`,
        [discussion.user_id]
      )

      return res.json({
        success: true,
        data: null,
      })
    } catch (error) {
      console.error('删除讨论错误:', error)
      return res.status(500).json({
        success: false,
        error: '删除讨论失败',
      })
    }
  }

  // 创建回复
  static async createReply(req: AuthRequest, res: Response<ApiResponse<{ reply_id: number }>>) {
    try {
      const userId = req.user?.id
      const discussionId = parseInt(req.params.id)
      const { content, parent_id } = req.body

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: '未授权访问',
        })
      }

      if (isNaN(discussionId)) {
        return res.status(400).json({
          success: false,
          error: '无效的讨论ID',
        })
      }

      // 检查讨论是否存在且未锁定
      const [discussions] = await pool.query<IDiscussion[]>('SELECT * FROM discussions WHERE id = ?', [discussionId])

      if (discussions.length === 0) {
        return res.status(404).json({
          success: false,
          error: '讨论不存在',
        })
      }

      if (discussions[0].is_locked) {
        return res.status(403).json({
          success: false,
          error: '讨论已锁定，无法回复',
        })
      }

      const [result] = await pool.query<ResultSetHeader>(
        'INSERT INTO discussion_replies (discussion_id, user_id, parent_id, content) VALUES (?, ?, ?, ?)',
        [discussionId, userId, parent_id || null, content]
      )

      // 更新讨论回复数和最后回复时间
      await pool.query(
        'UPDATE discussions SET reply_count = reply_count + 1, last_reply_at = NOW(), last_reply_user_id = ? WHERE id = ?',
        [userId, discussionId]
      )

      // 如果是子回复，更新父回复的回复数
      if (parent_id) {
        await pool.query('UPDATE discussion_replies SET reply_count = reply_count + 1 WHERE id = ?', [parent_id])
      }

      // 更新用户统计
      await pool.query(
        `INSERT INTO user_discussion_stats (user_id, replies_count, last_active_at)
         VALUES (?, 1, NOW())
         ON DUPLICATE KEY UPDATE
         replies_count = replies_count + 1,
         last_active_at = NOW()`,
        [userId]
      )

      return res.json({
        success: true,
        data: { reply_id: result.insertId },
      })
    } catch (error) {
      console.error('创建回复错误:', error)
      return res.status(500).json({
        success: false,
        error: '创建回复失败',
      })
    }
  }

  // 点赞/取消点赞
  static async toggleLike(req: AuthRequest, res: Response<ApiResponse<{ is_liked: boolean; like_count: number }>>) {
    try {
      const userId = req.user?.id
      const { target_type, target_id } = req.body

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: '未授权访问',
        })
      }

      if (!['discussion', 'reply'].includes(target_type)) {
        return res.status(400).json({
          success: false,
          error: '无效的目标类型',
        })
      }

      // 检查是否已点赞
      const [existing] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM discussion_likes WHERE user_id = ? AND target_type = ? AND target_id = ?',
        [userId, target_type, target_id]
      )

      let isLiked: boolean

      if (existing.length > 0) {
        // 取消点赞
        await pool.query('DELETE FROM discussion_likes WHERE user_id = ? AND target_type = ? AND target_id = ?', [
          userId,
          target_type,
          target_id,
        ])
        isLiked = false
      } else {
        // 添加点赞
        await pool.query('INSERT INTO discussion_likes (user_id, target_type, target_id) VALUES (?, ?, ?)', [
          userId,
          target_type,
          target_id,
        ])
        isLiked = true
      }

      // 更新点赞数
      const tableName = target_type === 'discussion' ? 'discussions' : 'discussion_replies'
      const [countResult] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as like_count FROM discussion_likes WHERE target_type = ? AND target_id = ?`,
        [target_type, target_id]
      )

      const likeCount = countResult[0].like_count

      await pool.query(`UPDATE ${tableName} SET like_count = ? WHERE id = ?`, [likeCount, target_id])

      return res.json({
        success: true,
        data: {
          is_liked: isLiked,
          like_count: likeCount,
        },
      })
    } catch (error) {
      console.error('点赞操作错误:', error)
      return res.status(500).json({
        success: false,
        error: '点赞操作失败',
      })
    }
  }

  // 收藏/取消收藏讨论
  static async toggleBookmark(req: AuthRequest, res: Response<ApiResponse<{ is_bookmarked: boolean }>>) {
    try {
      const userId = req.user?.id
      const discussionId = parseInt(req.params.id)

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: '未授权访问',
        })
      }

      if (isNaN(discussionId)) {
        return res.status(400).json({
          success: false,
          error: '无效的讨论ID',
        })
      }

      // 检查是否已收藏
      const [existing] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM discussion_bookmarks WHERE user_id = ? AND discussion_id = ?',
        [userId, discussionId]
      )

      let isBookmarked: boolean

      if (existing.length > 0) {
        // 取消收藏
        await pool.query('DELETE FROM discussion_bookmarks WHERE user_id = ? AND discussion_id = ?', [
          userId,
          discussionId,
        ])
        isBookmarked = false
      } else {
        // 添加收藏
        await pool.query('INSERT INTO discussion_bookmarks (user_id, discussion_id) VALUES (?, ?)', [
          userId,
          discussionId,
        ])
        isBookmarked = true
      }

      return res.json({
        success: true,
        data: { is_bookmarked: isBookmarked },
      })
    } catch (error) {
      console.error('收藏操作错误:', error)
      return res.status(500).json({
        success: false,
        error: '收藏操作失败',
      })
    }
  }

  // 获取讨论分类
  static async getCategories(req: AuthRequest, res: Response<ApiResponse<IDiscussionCategory[]>>) {
    try {
      const [categories] = await pool.query<IDiscussionCategory[]>(
        `SELECT dc.*, COUNT(d.id) as discussions_count
         FROM discussion_categories dc
         LEFT JOIN discussions d ON dc.id = d.category_id
         WHERE dc.is_active = TRUE
         GROUP BY dc.id
         ORDER BY dc.sort_order ASC`
      )

      return res.json({
        success: true,
        data: categories,
      })
    } catch (error) {
      console.error('获取讨论分类错误:', error)
      return res.status(500).json({
        success: false,
        error: '获取讨论分类失败',
      })
    }
  }

  // 获取热门标签
  static async getPopularTags(req: AuthRequest, res: Response<ApiResponse<IDiscussionTag[]>>) {
    try {
      const limit = parseInt(req.query.limit as string) || 20

      const [tags] = await pool.query<IDiscussionTag[]>(
        'SELECT * FROM discussion_tags ORDER BY usage_count DESC LIMIT ?',
        [limit]
      )

      return res.json({
        success: true,
        data: tags,
      })
    } catch (error) {
      console.error('获取热门标签错误:', error)
      return res.status(500).json({
        success: false,
        error: '获取热门标签失败',
      })
    }
  }

  // 获取用户讨论统计
  static async getUserStats(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const userId = req.user?.id

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: '未授权访问',
        })
      }

      const [stats] = await pool.query<RowDataPacket[]>('SELECT * FROM user_discussion_stats WHERE user_id = ?', [
        userId,
      ])

      const userStats = stats[0] || {
        discussions_count: 0,
        replies_count: 0,
        likes_received: 0,
        solutions_count: 0,
        reputation_score: 0,
      }

      return res.json({
        success: true,
        data: userStats,
      })
    } catch (error) {
      console.error('获取用户讨论统计错误:', error)
      return res.status(500).json({
        success: false,
        error: '获取用户讨论统计失败',
      })
    }
  }
}
