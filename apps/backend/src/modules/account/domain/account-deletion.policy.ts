export const ACCOUNT_DELETION_CONFIRMATION = '删除问衡账号'
export const ACCOUNT_DELETION_GRACE_DAYS = 30

export type AccountDeletionPreview = {
  status: 'NOT_REQUESTED'
  confirmationPhrase: string
  graceDays: number
  scheduledFor: string
  modes: Array<{
    mode: 'IMMEDIATE' | 'GRACE_PERIOD'
    scheduledFor: string
    cancellable: boolean
    targetCompletionHours: number | null
  }>
  deleteOrAnonymize: string[]
  conditionalRetention: string[]
  disclaimer: string
}

export function isValidDeletionConfirmation(value: unknown): boolean {
  return value === ACCOUNT_DELETION_CONFIRMATION
}

export function buildAccountDeletionPreview(now = new Date()): AccountDeletionPreview {
  const scheduledFor = new Date(now.getTime() + ACCOUNT_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000)
  return {
    status: 'NOT_REQUESTED',
    confirmationPhrase: ACCOUNT_DELETION_CONFIRMATION,
    graceDays: ACCOUNT_DELETION_GRACE_DAYS,
    scheduledFor: scheduledFor.toISOString(),
    modes: [
      {
        mode: 'IMMEDIATE',
        scheduledFor: now.toISOString(),
        cancellable: false,
        targetCompletionHours: 24,
      },
      {
        mode: 'GRACE_PERIOD',
        scheduledFor: scheduledFor.toISOString(),
        cancellable: true,
        targetCompletionHours: null,
      },
    ],
    deleteOrAnonymize: [
      '个人资料、头像与非必要联系方式',
      '个人收藏、错题、学习偏好与可删除学习记录',
      '人脸凭据模板及未被法定义务要求保留的监考资料',
    ],
    conditionalRetention: [
      '依法必须保留的交易、财税与安全审计记录',
      '考试组织者在成绩申诉或争议处理期限内依法保留的答卷与成绩记录',
      '为处理投诉、侵权或安全事件所必需的最小范围记录',
    ],
    disclaimer: '提交注销申请不等于数据已经立即完成物理删除；系统将在宽限期结束后执行可删除数据的清理或匿名化。',
  }
}
