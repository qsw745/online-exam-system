import { describe, expect, it } from 'vitest'

import {
  HOLDABLE_CATEGORY_CODES,
  LIFECYCLE_STATUS_CODES,
  lifecycleStatusPresentation,
  stepStatusPresentation,
} from './lifecyclePresentation'

describe('lifecyclePresentation', () => {
  it('穷尽展示全部生命周期状态', () => {
    for (const status of LIFECYCLE_STATUS_CODES) {
      const presentation = lifecycleStatusPresentation(status)
      expect(presentation.known).toBe(true)
      expect(presentation.labelKey).toBe(`privacyLifecycle.status.${status}`)
    }
  })

  it('未知状态统一失败关闭且不允许管理写操作', () => {
    expect(lifecycleStatusPresentation('FUTURE_UNKNOWN')).toEqual({
      known: false,
      labelKey: 'privacyLifecycle.status.unknown',
      tone: 'default',
      terminal: false,
    })
  })

  it('只有需要人工处理的步骤在界面提供重试', () => {
    expect(stepStatusPresentation('ATTENTION_REQUIRED').canRetry).toBe(true)
    expect(stepStatusPresentation('RETRYING').canRetry).toBe(false)
    expect(stepStatusPresentation('FUTURE_UNKNOWN').canRetry).toBe(false)
  })

  it('合法冻结类别排除认证凭据和人脸凭据', () => {
    expect(HOLDABLE_CATEGORY_CODES).toContain('EXAM_ARCHIVE')
    expect(HOLDABLE_CATEGORY_CODES).toContain('PROCTORING_AND_IDENTITY')
    expect(HOLDABLE_CATEGORY_CODES).not.toContain('AUTH_CREDENTIALS')
    expect(HOLDABLE_CATEGORY_CODES).not.toContain('FACE_CREDENTIALS')
  })
})
