// apps/backend/src/modules/discussions/controllers/discussions.controller.ts
import type { Response } from 'express'
import type { AuthRequest } from '../../types/auth.js'
import type { ApiResponse } from '../../types/response.js'
import type { IDiscussion, IDiscussionReply, IDiscussionCategory, IDiscussionTag } from '../domain/discussion.types.js'
import { DiscussionRepository } from '../repositories/discussion.repository.js'
import { DiscussionsService } from '../services/discussions.service.js'
import { pool } from '@/config/database.js'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'

export class DiscussionsController {
  static async getDiscussions(
    req: AuthRequest,
    res: Response<ApiResponse<{ discussions: IDiscussion[]; total: number; categories: IDiscussionCategory[] }>>
  ) {
    try {
      const userId = req.user?.id ?? null
      const {
        page = 1,
        limit = 20,
        category_id,
        sort = 'latest',
        search,
        related_type,
        related_id,
        is_featured,
      } = req.query as any
      const offset = (Number(page) - 1) * Number(limit)

      let where = 'WHERE 1=1'
      const params: any[] = []
      if (category_id) {
        where += ' AND d.category_id = ?'
        params.push(category_id)
      }
      if (search) {
        where += ' AND (d.title LIKE ? OR d.content LIKE ?)'
        params.push(`%${search}%`, `%${search}%`)
      }
      if (related_type && related_id) {
        where += ' AND d.related_type = ? AND d.related_id = ?'
        params.push(related_type, related_id)
      }
      if (is_featured === 'true') where += ' AND d.is_featured = TRUE'

      switch (sort) {
        case 'hot':
          where +=
            ' ORDER BY d.is_pinned DESC, (d.like_count + d.reply_count * 2 + d.view_count * 0.1) DESC, d.created_at DESC'
          break
        case 'replies':
          where += ' ORDER BY d.is_pinned DESC, d.reply_count DESC, d.created_at DESC'
          break
        case 'likes':
          where += ' ORDER BY d.is_pinned DESC, d.like_count DESC, d.created_at DESC'
          break
        default:
          where += ' ORDER BY d.is_pinned DESC, d.last_reply_at DESC, d.created_at DESC'
      }

      const discussions = await DiscussionRepository.queryList(userId, where, params, Number(limit), offset)
      const total = await DiscussionRepository.count(
        'WHERE 1=1' + (params.length ? where.split('ORDER BY')[0].slice(8) : ''),
        params
      )
      const categories = await DiscussionRepository.getCategories()

      return res.json({ success: true, data: { discussions, total, categories } })
    } catch (e) {
      console.error('获取讨论列表错误:', e)
      return res.status(500).json({ success: false, error: '获取讨论列表失败' })
    }
  }

  static async getDiscussionDetail(
    req: AuthRequest,
    res: Response<ApiResponse<{ discussion: IDiscussion; replies: IDiscussionReply[] }>>
  ) {
    try {
      const userId = req.user?.id ?? null
      const id = Number(req.params.id)
      const { page = 1, limit = 20 } = req.query as any
      if (Number.isNaN(id)) return res.status(400).json({ success: false, error: '无效的讨论ID' })

      await DiscussionRepository.increaseView(id)
      const discussion = await DiscussionRepository.getById(userId, id)
      if (!discussion) return res.status(404).json({ success: false, error: '讨论不存在' })

      const offset = (Number(page) - 1) * Number(limit)
      const replies = await DiscussionRepository.getTopReplies(userId, id, Number(limit), offset)
      for (const r of replies) {
        r.children = await DiscussionRepository.getChildReplies(userId, r.id)
      }
      return res.json({ success: true, data: { discussion, replies } })
    } catch (e) {
      console.error('获取讨论详情错误:', e)
      return res.status(500).json({ success: false, error: '获取讨论详情失败' })
    }
  }

  static async createDiscussion(req: AuthRequest, res: Response<ApiResponse<{ discussion_id: number }>>) {
    try {
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ success: false, error: '未授权访问' })
      const id = await DiscussionRepository.insertDiscussion(userId, req.body)

      // 用户统计与标签
      await pool.query(
        `INSERT INTO user_discussion_stats (user_id, discussions_count, last_active_at)
         VALUES (?, 1, NOW())
         ON DUPLICATE KEY UPDATE discussions_count = discussions_count + 1, last_active_at = NOW()`,
        [userId]
      )
      const tags: string[] = Array.isArray(req.body?.tags) ? req.body.tags : []
      for (const tag of tags) {
        await pool.query(
          `INSERT INTO discussion_tags (name, usage_count) VALUES (?, 1)
           ON DUPLICATE KEY UPDATE usage_count = usage_count + 1`,
          [tag]
        )
      }
      return res.json({ success: true, data: { discussion_id: id } })
    } catch (e) {
      console.error('创建讨论错误:', e)
      return res.status(500).json({ success: false, error: '创建讨论失败' })
    }
  }

  static async updateDiscussion(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      const id = Number(req.params.id)
      if (!userId) return res.status(401).json({ success: false, error: '未授权访问' })
      if (Number.isNaN(id)) return res.status(400).json({ success: false, error: '无效的讨论ID' })

      const ok = await DiscussionRepository.updateDiscussion(userId, id, req.body)
      if (!ok) return res.status(404).json({ success: false, error: '讨论不存在或无权修改' })
      return res.json({ success: true, data: null })
    } catch (e) {
      console.error('更新讨论错误:', e)
      return res.status(500).json({ success: false, error: '更新讨论失败' })
    }
  }

  static async deleteDiscussion(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const currentUserId = req.user?.id
      const id = Number(req.params.id)
      if (!currentUserId) return res.status(401).json({ success: false, error: '未授权访问' })
      if (Number.isNaN(id)) return res.status(400).json({ success: false, error: '无效的讨论ID' })

      const d = await DiscussionRepository.findOwner(id)
      if (!d) return res.status(404).json({ success: false, error: '讨论不存在' })

      const [users] = await pool.query<RowDataPacket[]>('SELECT role FROM users WHERE id = ?', [currentUserId])
      const isAuthor = d.user_id === currentUserId
      const isAdmin = users[0]?.role === 'admin'
      if (!isAuthor && !isAdmin) return res.status(403).json({ success: false, error: '无权删除此讨论' })

      await DiscussionRepository.deleteById(id)
      await pool.query(
        `UPDATE user_discussion_stats 
         SET discussions_count = GREATEST(discussions_count - 1, 0)
         WHERE user_id = ?`,
        [d.user_id]
      )
      return res.json({ success: true, data: null })
    } catch (e) {
      console.error('删除讨论错误:', e)
      return res.status(500).json({ success: false, error: '删除讨论失败' })
    }
  }

  static async createReply(req: AuthRequest, res: Response<ApiResponse<{ reply_id: number }>>) {
    try {
      const userId = req.user?.id
      const discussionId = Number(req.params.id)
      const { content, parent_id } = req.body
      if (!userId) return res.status(401).json({ success: false, error: '未授权访问' })
      if (Number.isNaN(discussionId)) return res.status(400).json({ success: false, error: '无效的讨论ID' })

      const [d] = await pool.query<RowDataPacket[]>('SELECT is_locked FROM discussions WHERE id = ?', [discussionId])
      if (!d?.length && !Array.isArray(d)) {
        /* noop */
      }
      const isLocked = (d as any)[0]?.is_locked
      if (isLocked) return res.status(403).json({ success: false, error: '讨论已锁定，无法回复' })

      const id = await DiscussionRepository.insertReply(discussionId, userId, content, parent_id ?? null)
      await DiscussionRepository.bumpReplyMeta(discussionId, userId, parent_id ?? null)
      await pool.query(
        `INSERT INTO user_discussion_stats (user_id, replies_count, last_active_at)
         VALUES (?, 1, NOW())
         ON DUPLICATE KEY UPDATE replies_count = replies_count + 1, last_active_at = NOW()`,
        [userId]
      )
      return res.json({ success: true, data: { reply_id: id } })
    } catch (e) {
      console.error('创建回复错误:', e)
      return res.status(500).json({ success: false, error: '创建回复失败' })
    }
  }

  static async toggleLike(req: AuthRequest, res: Response<ApiResponse<{ is_liked: boolean; like_count: number }>>) {
    try {
      const userId = req.user?.id
      const { target_type, target_id } = req.body
      if (!userId) return res.status(401).json({ success: false, error: '未授权访问' })
      if (!['discussion', 'reply'].includes(target_type)) {
        return res.status(400).json({ success: false, error: '无效的目标类型' })
      }
      const result = await DiscussionRepository.toggleLike(userId, target_type, Number(target_id))
      return res.json({ success: true, data: result })
    } catch (e) {
      console.error('点赞操作错误:', e)
      return res.status(500).json({ success: false, error: '点赞操作失败' })
    }
  }

  static async toggleBookmark(req: AuthRequest, res: Response<ApiResponse<{ is_bookmarked: boolean }>>) {
    try {
      const userId = req.user?.id
      const discussionId = Number(req.params.id)
      if (!userId) return res.status(401).json({ success: false, error: '未授权访问' })
      if (Number.isNaN(discussionId)) return res.status(400).json({ success: false, error: '无效的讨论ID' })
      const data = await DiscussionRepository.toggleBookmark(userId, discussionId)
      return res.json({ success: true, data })
    } catch (e) {
      console.error('收藏操作错误:', e)
      return res.status(500).json({ success: false, error: '收藏操作失败' })
    }
  }

  // 以下是“管理/增强”能力
  static async markAsSolution(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      const { id, replyId } = req.params
      if (!userId) return res.status(401).json({ success: false, error: '未授权访问' })
      const ok = await DiscussionsService.markAsSolution(Number(replyId), Number(id), userId)
      if (!ok) return res.status(403).json({ success: false, error: '无权限或目标不存在' })
      return res.json({ success: true, data: null })
    } catch (e) {
      console.error('标记解决方案错误:', e)
      return res.status(500).json({ success: false, error: '标记解决方案失败' })
    }
  }

  static async togglePin(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const ok = await DiscussionsService.togglePin(Number(req.params.id), Number(req.user?.id))
      if (!ok) return res.status(403).json({ success: false, error: '无权限' })
      return res.json({ success: true, data: null })
    } catch (e) {
      console.error('置顶操作错误:', e)
      return res.status(500).json({ success: false, error: '置顶操作失败' })
    }
  }

  static async toggleLock(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const ok = await DiscussionsService.toggleLock(Number(req.params.id), Number(req.user?.id))
      if (!ok) return res.status(403).json({ success: false, error: '无权限' })
      return res.json({ success: true, data: null })
    } catch (e) {
      console.error('锁定操作错误:', e)
      return res.status(500).json({ success: false, error: '锁定操作失败' })
    }
  }

  static async toggleFeatured(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const ok = await DiscussionsService.toggleFeatured(Number(req.params.id), Number(req.user?.id))
      if (!ok) return res.status(403).json({ success: false, error: '无权限' })
      return res.json({ success: true, data: null })
    } catch (e) {
      console.error('精选操作错误:', e)
      return res.status(500).json({ success: false, error: '精选操作失败' })
    }
  }

  static async getCategories(_req: AuthRequest, res: Response<ApiResponse<IDiscussionCategory[]>>) {
    try {
      const categories = await DiscussionRepository.getCategories()
      return res.json({ success: true, data: categories })
    } catch (e) {
      console.error('获取讨论分类错误:', e)
      return res.status(500).json({ success: false, error: '获取讨论分类失败' })
    }
  }

  static async getPopularTags(req: AuthRequest, res: Response<ApiResponse<IDiscussionTag[]>>) {
    try {
      const limit = Number(req.query.limit ?? 20)
      const [tags] = await pool.query<IDiscussionTag[]>(
        'SELECT * FROM discussion_tags ORDER BY usage_count DESC LIMIT ?',
        [limit]
      )
      return res.json({ success: true, data: tags })
    } catch (e) {
      console.error('获取热门标签错误:', e)
      return res.status(500).json({ success: false, error: '获取热门标签失败' })
    }
  }

  static async getUserStats(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ success: false, error: '未授权访问' })
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
      return res.json({ success: true, data: userStats })
    } catch (e) {
      console.error('获取用户讨论统计错误:', e)
      return res.status(500).json({ success: false, error: '获取用户讨论统计失败' })
    }
  }
}
