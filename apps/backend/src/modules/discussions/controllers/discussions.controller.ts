/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AuthRequest } from '@/types/auth'
import type { ApiResponse } from '@/types/response'
import { CODES } from '@/types/response'
import type { Response } from 'express'
import type { IDiscussion, IDiscussionCategory, IDiscussionReply, IDiscussionTag } from '../domain/discussion.model'
import { DiscussionRepository } from '../repositories/discussion.repository'
import { DiscussionsService } from '../services/discussions.service'

export class DiscussionsController {
  // ------ 浏览 +1（带 TTL 去重） ------
  static async viewed(req: AuthRequest, res: Response<ApiResponse<{ increased: boolean }>>) {
    try {
      const discussionId = Number(req.params.id)
      if (Number.isNaN(discussionId)) return (res as any).badRequest('无效的讨论ID', { code: CODES.VALIDATION_ERROR })

      const shouldIncrease = await DiscussionsService.ensureViewOnce(req, discussionId, 600)
      if (shouldIncrease) await DiscussionRepository.increaseView(discussionId)
      return (res as any).ok({ increased: shouldIncrease }, '浏览记录完成')
    } catch (e: any) {
      console.error('记录浏览错误:', e)
      return (res as any).internal('记录浏览失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  // ------ 获取某个讨论的回复列表（GET /discussions/:id/replies） ------
  static async getReplies(req: AuthRequest, res: Response<ApiResponse<any[]>>) {
    try {
      const userId = req.user?.id ?? null
      const discussionId = Number(req.params.id)
      if (Number.isNaN(discussionId)) return (res as any).badRequest('无效的讨论ID', { code: CODES.VALIDATION_ERROR })
      const list = await DiscussionRepository.getRepliesFlat(userId, discussionId)
      return (res as any).ok(list, '获取成功')
    } catch (e) {
      console.error('获取回复列表错误:', e)
      return (res as any).internal('获取回复列表失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  // ------ 点赞帖子（兼容 URL 与 body 两种方式） ------
  static async toggleLike(req: AuthRequest, res: Response<ApiResponse<{ is_liked: boolean; like_count: number }>>) {
    try {
      const userId = req.user?.id
      if (!userId) return (res as any).unauthorized('未授权访问', { code: CODES.AUTH_UNAUTHORIZED })

      const urlId = Number(req.params.id)
      if (!Number.isNaN(urlId)) {
        const result = await DiscussionRepository.toggleLike(userId, 'discussion', urlId)
        return (res as any).ok(result, '操作成功')
      }

      const { target_type, target_id } = (req.body ?? {}) as {
        target_type?: 'discussion' | 'reply'
        target_id?: any
      }
      if (!target_type || Number.isNaN(Number(target_id))) {
        return (res as any).badRequest('缺少或无效的目标参数', { code: CODES.VALIDATION_ERROR })
      }
      const result = await DiscussionRepository.toggleLike(userId, target_type, Number(target_id))
      return (res as any).ok(result, '操作成功')
    } catch (e) {
      console.error('点赞操作错误:', e)
      return (res as any).internal('点赞操作失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  // ------ 点赞回复 ------
  static async toggleReplyLike(
      req: AuthRequest,
      res: Response<ApiResponse<{ is_liked: boolean; like_count: number }>>
  ) {
    try {
      const userId = req.user?.id
      const replyId = Number(req.params.replyId)
      if (!userId) return (res as any).unauthorized('未授权访问', { code: CODES.AUTH_UNAUTHORIZED })
      if (Number.isNaN(replyId)) return (res as any).badRequest('无效的回复ID', { code: CODES.VALIDATION_ERROR })
      const result = await DiscussionRepository.toggleLike(userId, 'reply', replyId)
      return (res as any).ok(result, '操作成功')
    } catch (e) {
      console.error('点赞回复错误:', e)
      return (res as any).internal('点赞回复失败', { code: CODES.INTERNAL_ERROR })
    }
  }

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

      return (res as any).ok({ discussions, total, categories }, '获取成功')
    } catch (e) {
      console.error('获取讨论列表错误:', e)
      return (res as any).internal('获取讨论列表失败', { code: CODES.INTERNAL_ERROR })
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
      if (Number.isNaN(id)) return (res as any).badRequest('无效的讨论ID', { code: CODES.VALIDATION_ERROR })

      await DiscussionRepository.increaseView(id)
      const discussion = await DiscussionRepository.getById(userId, id)
      if (!discussion) return (res as any).fail(CODES.NOT_FOUND, 404, '讨论不存在')

      const offset = (Number(page) - 1) * Number(limit)
      const replies = await DiscussionRepository.getTopReplies(userId, id, Number(limit), offset)
      for (const r of replies) {
        r.children = await DiscussionRepository.getChildReplies(userId, r.id)
      }
      return (res as any).ok({ discussion, replies }, '获取成功')
    } catch (e) {
      console.error('获取讨论详情错误:', e)
      return (res as any).internal('获取讨论详情失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async createDiscussion(req: AuthRequest, res: Response<ApiResponse<{ discussion_id: number }>>) {
    try {
      const userId = req.user?.id
      if (!userId) return (res as any).unauthorized('未授权访问', { code: CODES.AUTH_UNAUTHORIZED })

      const id = await DiscussionRepository.insertDiscussion(userId, req.body)

      // 用户统计与标签（已下沉至 Repository）
      await DiscussionRepository.increaseUserDiscussionStats(userId)
      const tags: string[] = Array.isArray(req.body?.tags) ? req.body.tags : []
      if (tags.length) await DiscussionRepository.increaseTagsUsage(tags)

      return (res as any).created({ discussion_id: id }, '创建成功')
    } catch (e) {
      console.error('创建讨论错误:', e)
      return (res as any).internal('创建讨论失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async updateDiscussion(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      const id = Number(req.params.id)
      if (!userId) return (res as any).unauthorized('未授权访问', { code: CODES.AUTH_UNAUTHORIZED })
      if (Number.isNaN(id)) return (res as any).badRequest('无效的讨论ID', { code: CODES.VALIDATION_ERROR })

      const ok = await DiscussionRepository.updateDiscussion(userId, id, req.body)
      if (!ok) return (res as any).fail(CODES.NOT_FOUND, 404, '讨论不存在或无权修改')
      return (res as any).ok(null, '更新成功')
    } catch (e) {
      console.error('更新讨论错误:', e)
      return (res as any).internal('更新讨论失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async deleteDiscussion(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const currentUserId = req.user?.id
      const id = Number(req.params.id)
      if (!currentUserId) return (res as any).unauthorized('未授权访问', { code: CODES.AUTH_UNAUTHORIZED })
      if (Number.isNaN(id)) return (res as any).badRequest('无效的讨论ID', { code: CODES.VALIDATION_ERROR })

      const d = await DiscussionRepository.findOwner(id)
      if (!d) return (res as any).fail(CODES.NOT_FOUND, 404, '讨论不存在')

      const isAdmin = await DiscussionRepository.isAdmin(currentUserId)
      const isAuthor = d.user_id === currentUserId
      if (!isAuthor && !isAdmin) return (res as any).forbidden('无权删除此讨论', { code: CODES.AUTH_FORBIDDEN })

      await DiscussionRepository.deleteById(id)
      await DiscussionRepository.decreaseUserDiscussionsCount(d.user_id)

      return (res as any).ok(null, '删除成功')
    } catch (e) {
      console.error('删除讨论错误:', e)
      return (res as any).internal('删除讨论失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async createReply(req: AuthRequest, res: Response<ApiResponse<{ reply_id: number }>>) {
    try {
      const userId = req.user?.id
      const discussionId = Number(req.params.id)
      const { content, parent_id } = req.body
      if (!userId) return (res as any).unauthorized('未授权访问', { code: CODES.AUTH_UNAUTHORIZED })
      if (Number.isNaN(discussionId)) return (res as any).badRequest('无效的讨论ID', { code: CODES.VALIDATION_ERROR })

      const isLocked = await DiscussionRepository.isDiscussionLocked(discussionId)
      if (isLocked) return (res as any).forbidden('讨论已锁定，无法回复', { code: CODES.AUTH_FORBIDDEN })

      const id = await DiscussionRepository.insertReply(discussionId, userId, content, parent_id ?? null)
      await DiscussionRepository.bumpReplyMeta(discussionId, userId, parent_id ?? null)
      await DiscussionRepository.increaseUserReplyStats(userId)

      return (res as any).created({ reply_id: id }, '回复已创建')
    } catch (e) {
      console.error('创建回复错误:', e)
      return (res as any).internal('创建回复失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async toggleBookmark(req: AuthRequest, res: Response<ApiResponse<{ is_bookmarked: boolean }>>) {
    try {
      const userId = req.user?.id
      const discussionId = Number(req.params.id)
      if (!userId) return (res as any).unauthorized('未授权访问', { code: CODES.AUTH_UNAUTHORIZED })
      if (Number.isNaN(discussionId)) return (res as any).badRequest('无效的讨论ID', { code: CODES.VALIDATION_ERROR })
      const data = await DiscussionRepository.toggleBookmark(userId, discussionId)
      return (res as any).ok(data, '操作成功')
    } catch (e) {
      console.error('收藏操作错误:', e)
      return (res as any).internal('收藏操作失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  // —— 管理/增强 —— //
  static async markAsSolution(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      const { id, replyId } = req.params
      if (!userId) return (res as any).unauthorized('未授权访问', { code: CODES.AUTH_UNAUTHORIZED })
      const ok = await DiscussionsService.markAsSolution(Number(replyId), Number(id), userId)
      if (!ok) return (res as any).forbidden('无权限或目标不存在', { code: CODES.AUTH_FORBIDDEN })
      return (res as any).ok(null, '操作成功')
    } catch (e) {
      console.error('标记解决方案错误:', e)
      return (res as any).internal('标记解决方案失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async togglePin(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const ok = await DiscussionsService.togglePin(Number(req.params.id), Number(req.user?.id))
      if (!ok) return (res as any).forbidden('无权限', { code: CODES.AUTH_FORBIDDEN })
      return (res as any).ok(null, '置顶状态已切换')
    } catch (e) {
      console.error('置顶操作错误:', e)
      return (res as any).internal('置顶操作失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async toggleLock(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const ok = await DiscussionsService.toggleLock(Number(req.params.id), Number(req.user?.id))
      if (!ok) return (res as any).forbidden('无权限', { code: CODES.AUTH_FORBIDDEN })
      return (res as any).ok(null, '锁定状态已切换')
    } catch (e) {
      console.error('锁定操作错误:', e)
      return (res as any).internal('锁定操作失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async toggleFeatured(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const ok = await DiscussionsService.toggleFeatured(Number(req.params.id), Number(req.user?.id))
      if (!ok) return (res as any).forbidden('无权限', { code: CODES.AUTH_FORBIDDEN })
      return (res as any).ok(null, '精选状态已切换')
    } catch (e) {
      console.error('精选操作错误:', e)
      return (res as any).internal('精选操作失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async getCategories(_req: AuthRequest, res: Response<ApiResponse<IDiscussionCategory[]>>) {
    try {
      const categories = await DiscussionRepository.getCategories()
      return (res as any).ok(categories, '获取成功')
    } catch (e) {
      console.error('获取讨论分类错误:', e)
      return (res as any).internal('获取讨论分类失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async getPopularTags(req: AuthRequest, res: Response<ApiResponse<IDiscussionTag[]>>) {
    try {
      const limit = Number(req.query.limit ?? 20)
      const tags = await DiscussionRepository.getPopularTags(limit)
      return (res as any).ok(tags, '获取成功')
    } catch (e) {
      console.error('获取热门标签错误:', e)
      return (res as any).internal('获取热门标签失败', { code: CODES.INTERNAL_ERROR })
    }
  }

  static async getUserStats(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const userId = req.user?.id
      if (!userId) return (res as any).unauthorized('未授权访问', { code: CODES.AUTH_UNAUTHORIZED })
      const userStats = await DiscussionRepository.getUserDiscussionStats(userId)
      return (res as any).ok(userStats, '获取成功')
    } catch (e) {
      console.error('获取用户讨论统计错误:', e)
      return (res as any).internal('获取用户讨论统计失败', { code: CODES.INTERNAL_ERROR })
    }
  }
}
