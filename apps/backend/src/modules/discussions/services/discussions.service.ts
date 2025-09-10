// apps/backend/src/modules/discussions/services/discussions.service.ts
import { DiscussionRepository } from '../repositories/discussion.repository.js'

export class DiscussionsService {
  static async markAsSolution(replyId: number, discussionId: number, userId: number): Promise<boolean> {
    const owner = await DiscussionRepository.findOwner(discussionId)
    if (!owner || owner.user_id !== userId) return false

    // 取消当前讨论的所有解决标记、标记指定回复为解决方案
    await DiscussionRepository.clearSolutions(discussionId)
    const ok = await DiscussionRepository.markReplyAsSolution(replyId, discussionId)
    if (!ok) return false

    // 给被标记为解决方案的回复作者加积分/统计
    const replyAuthorId = await DiscussionRepository.getReplyAuthorId(replyId)
    if (replyAuthorId) {
      await DiscussionRepository.incUserSolutionStats(replyAuthorId)
    }
    return true
  }

  static async togglePin(discussionId: number, userId: number): Promise<boolean> {
    if (!(await DiscussionRepository.isAdmin(userId))) return false
    await DiscussionRepository.togglePin(discussionId)
    return true
  }

  static async toggleLock(discussionId: number, userId: number): Promise<boolean> {
    if (!(await DiscussionRepository.isAdmin(userId))) return false
    await DiscussionRepository.toggleLock(discussionId)
    return true
  }

  static async toggleFeatured(discussionId: number, userId: number): Promise<boolean> {
    if (!(await DiscussionRepository.isAdmin(userId))) return false
    await DiscussionRepository.toggleFeatured(discussionId)
    return true
  }

  static async toggleFollow(discussionId: number, userId: number): Promise<{ is_followed: boolean }> {
    return DiscussionRepository.toggleFollow(userId, discussionId)
  }

  static async reportContent(
    userId: number,
    targetType: 'discussion' | 'reply',
    targetId: number,
    reason: string,
    description?: string
  ): Promise<boolean> {
    return DiscussionRepository.reportContent(userId, targetType, targetId, reason, description)
  }
}
