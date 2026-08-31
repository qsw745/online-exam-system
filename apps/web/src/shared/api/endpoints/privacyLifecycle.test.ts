import { describe, expect, it } from 'vitest'

import { normalizeLifecycleAdminRequest, normalizeLifecycleDryRun } from './privacyLifecycle'

describe('privacyLifecycle normalizers', () => {
  it('保留受限保留期限且未知删除模式失败关闭', () => {
    const normalized = normalizeLifecycleAdminRequest({
      request_id: 'b132689c-4a5d-42a2-86c5-3661e62d4d1f',
      deletion_mode: 'FUTURE_MODE',
      execution_status: 'RUNNING',
      requested_at: '2026-08-31T08:00:00.000Z',
      scheduled_for: '2026-09-30T08:00:00.000Z',
      restricted_retention_until: '2026-10-31T08:00:00.000Z',
      email: 'private@example.com',
    }, 'CN')

    expect(normalized.mode).toBe('UNKNOWN')
    expect(normalized.restrictedRetentionUntil).toBe('2026-10-31T08:00:00.000Z')
    expect(normalized).not.toHaveProperty('email')
  })

  it('预演结果按类别与动作聚合并忽略原始数据字段', () => {
    const normalized = normalizeLifecycleDryRun({
      coverage: { coveredColumnCount: 4, uncoveredColumnCount: 0 },
      categories: [
        { category: 'USER_CONTENT', action: 'DELETE', count: 3, rows: [{ email: 'private@example.com' }] },
        { categoryCode: 'USER_CONTENT', action: 'DELETE', count: 5 },
      ],
    })

    expect(normalized.categories).toEqual([{ categoryCode: 'USER_CONTENT', action: 'DELETE', count: 8 }])
    expect(JSON.stringify(normalized)).not.toContain('private@example.com')
  })
})
