import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assessHeartbeat,
  assertConsentScope,
  normalizeFactualEvent,
  normalizeProctoringPolicy,
  nextSessionState,
  ProctoringPolicyError,
} from './proctoring.policy.js'

test('监考策略默认关闭，不能由旧的 basic 全局值隐式开启摄像头', () => {
  assert.deepEqual(normalizeProctoringPolicy(undefined), {
    level: 'off',
    policyVersion: 'wenheng-proctoring-2026-08-v1',
    noticeVersion: 'wenheng-proctoring-notice-2026-08-v1',
    requireCamera: false,
    requireMicrophone: false,
    requireIdentityVerification: false,
    eventRetentionDays: 180,
    snapshotRetentionDays: 0,
    heartbeatIntervalSeconds: 15,
    interruptionGraceSeconds: 45,
  })
  assert.equal(normalizeProctoringPolicy({ level: 'basic' }).level, 'off')
})

test('严格监考强制摄像头和麦克风，并限制留存及心跳范围', () => {
  const policy = normalizeProctoringPolicy({
    level: 'strict',
    requireCamera: false,
    requireMicrophone: false,
    requireIdentityVerification: true,
    eventRetentionDays: 9999,
    snapshotRetentionDays: 45,
    heartbeatIntervalSeconds: 1,
    interruptionGraceSeconds: 999,
  })
  assert.equal(policy.level, 'strict')
  assert.equal(policy.requireCamera, true)
  assert.equal(policy.requireMicrophone, true)
  assert.equal(policy.requireIdentityVerification, true)
  assert.equal(policy.eventRetentionDays, 365)
  assert.equal(policy.snapshotRetentionDays, 30)
  assert.equal(policy.heartbeatIntervalSeconds, 10)
  assert.equal(policy.interruptionGraceSeconds, 180)
})

test('同意凭证必须绑定同一用户、考试、作答、区域和政策版本', () => {
  const scope = {
    userId: 7,
    examId: 12,
    attemptId: '5dbd8d11-c1c5-4cce-ad9b-a61f58fe9242',
    dataRegion: 'cn' as const,
    policyVersion: 'policy-v1',
  }
  assert.doesNotThrow(() => assertConsentScope(scope, { ...scope }))
  assert.throws(
    () => assertConsentScope(scope, { ...scope, dataRegion: 'global' }),
    (error: unknown) => error instanceof ProctoringPolicyError && error.code === 'PROCTORING_CONSENT_SCOPE_MISMATCH',
  )
})

test('只接受规范事件编号、白名单事实事件和有限状态字段', () => {
  const event = normalizeFactualEvent(
    {
      eventId: '81c75367-fb18-42f4-8b97-b8f5c36f8a0c',
      type: 'camera_interrupted',
      sequence: 3,
      occurredAt: '2026-08-30T10:00:00.000Z',
      state: {
        camera: 'interrupted',
        microphone: 'available',
        app: 'foreground',
        faceCount: 1,
        light: 'normal',
        audioLevel: 0.8,
        message: '作弊',
      },
      severity: 'info',
    },
    new Date('2026-08-30T10:00:01.000Z'),
  )
  assert.equal(event.severity, 'critical')
  assert.deepEqual(event.state, {
    camera: 'interrupted',
    microphone: 'available',
    app: 'foreground',
    faceCount: 1,
    light: 'normal',
  })
})

test('拒绝声音内容分析、自由文本结论和未知事件', () => {
  for (const type of ['audio_detected', 'cheating_detected', 'free_text']) {
    assert.throws(
      () =>
        normalizeFactualEvent({
          eventId: '81c75367-fb18-42f4-8b97-b8f5c36f8a0c',
          type,
          sequence: 1,
          occurredAt: '2026-08-30T10:00:00.000Z',
        }),
      (error: unknown) => error instanceof ProctoringPolicyError && error.code === 'PROCTORING_EVENT_NOT_ALLOWED',
    )
  }
})

test('事件时间只能在服务端接收时间附近，避免伪造历史事件', () => {
  assert.throws(
    () =>
      normalizeFactualEvent(
        {
          eventId: '81c75367-fb18-42f4-8b97-b8f5c36f8a0c',
          type: 'network_lost',
          sequence: 1,
          occurredAt: '2026-08-30T09:00:00.000Z',
        },
        new Date('2026-08-30T10:00:00.000Z'),
      ),
    (error: unknown) => error instanceof ProctoringPolicyError && error.code === 'PROCTORING_EVENT_TIME_INVALID',
  )
})

test('传感器和应用中断由服务端状态机进入 interrupted，客户端不能直接恢复 active', () => {
  assert.equal(nextSessionState('active', 'app_backgrounded'), 'interrupted')
  assert.equal(nextSessionState('active', 'camera_permission_revoked'), 'interrupted')
  assert.equal(nextSessionState('interrupted', 'app_foregrounded'), 'interrupted')
  assert.equal(nextSessionState('active', 'identity_verification_failed'), 'review_required')
  assert.equal(nextSessionState('active', 'session_completed'), 'completed')
})

test('心跳超过宽限期进入中断，长时间失联进入人工复核', () => {
  const last = new Date('2026-08-30T10:00:00.000Z')
  assert.equal(assessHeartbeat(last, new Date('2026-08-30T10:00:30.000Z'), 45), 'active')
  assert.equal(assessHeartbeat(last, new Date('2026-08-30T10:00:46.000Z'), 45), 'interrupted')
  assert.equal(assessHeartbeat(last, new Date('2026-08-30T10:03:01.000Z'), 45), 'review_required')
})
