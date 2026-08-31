import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ProctoringAdapter } from '@/platform/proctoring'
import { useStrictProctoring } from './useStrictProctoring'

const status = {
  running: true,
  camera: 'available',
  microphone: 'available',
  app: 'foreground',
  faceCount: 1,
  light: 'normal',
  screenCaptured: false,
  storesAudio: false,
  uploadsContinuousMedia: false,
} as const

const session = {
  sessionId: 'd47f9443-40c0-40b4-9946-569a29d53ea1',
  consentId: 'b864a262-8e3f-4eca-a861-702477191d4a',
  attemptId: '5dbd8d11-c1c5-4cce-ad9b-a61f58fe9242',
  examId: 3,
  taskId: 8,
  state: 'prepared' as const,
  lastSequence: 0,
  cameraRequired: true,
  microphoneRequired: true,
  identityRequired: true,
  identityStatus: 'pending' as const,
  startedAt: null,
  lastHeartbeatAt: null,
  interruptionStartedAt: null,
  completedAt: null,
  reviewReasonCode: null,
}

const policy = {
  enabled: true,
  level: 'strict' as const,
  requireCamera: true,
  requireMic: true,
  requireIdentityVerification: true,
  policyVersion: 'policy-v1',
  noticeVersion: 'notice-v1',
  eventRetentionDays: 180,
  snapshotRetentionDays: 0,
  heartbeatIntervalSeconds: 30,
  interruptionGraceSeconds: 45,
  notice: {
    categories: ['camera', 'microphone_status', 'identity_verification', 'factual_events'],
    purpose: 'purpose',
    processingLocation: 'region',
    cameraUsage: 'camera',
    microphoneUsage: 'microphone',
    mediaUpload: 'limited',
    eventRetentionDays: 180,
    snapshotRetentionDays: 0,
  },
}

describe('useStrictProctoring', () => {
  it('普通考试不会访问摄像头或麦克风适配器', () => {
    const adapter = { permissionStatus: vi.fn() } as unknown as ProctoringAdapter
    const { result } = renderHook(() =>
      useStrictProctoring({ examId: 3, attemptId: session.attemptId, policy: { ...policy, enabled: false, level: 'off' }, isOnline: true, adapter }),
    )
    expect(result.current.phase).toBe('not_required')
    expect(result.current.canAnswer).toBe(true)
    expect(adapter.permissionStatus).not.toHaveBeenCalled()
  })

  it('严格监考先向服务端记录同意，再请求原生权限和身份核验', async () => {
    const order: string[] = []
    const adapter: ProctoringAdapter = {
      kind: 'native',
      permissionStatus: vi.fn(),
      requestPermissions: vi.fn(async () => {
        order.push('permissions')
        return { camera: 'granted' as const, microphone: 'granted' as const }
      }),
      start: vi.fn(async () => status),
      status: vi.fn(async () => status),
      captureIdentityFrames: vi.fn(async () => ['data:image/jpeg;base64,abc']),
      stop: vi.fn(async () => {}),
      openSettings: vi.fn(async () => {}),
      addFactListener: vi.fn(async () => () => {}),
    }
    const api = {
      createConsent: vi.fn(async () => {
        order.push('consent')
        return { consent: { consentId: session.consentId, expiresAt: '2026-08-31T00:00:00Z' }, policy, replayed: false }
      }),
      createSession: vi.fn(async () => ({ session, policy, decision: { state: 'prepared', mayContinue: false, action: 'remain_paused' }, replayed: false })),
      verifyIdentity: vi.fn(async () => ({
        session: { ...session, identityStatus: 'passed' },
        result: { result: 'passed', reasonCode: null },
        decision: { state: 'prepared', mayContinue: false, action: 'remain_paused' },
      })),
      reportFactualEvent: vi.fn(async (_id: string, payload: any) => ({
        session: { ...session, identityStatus: 'passed', state: 'active', lastSequence: payload.sequence },
        decision: { state: 'active', mayContinue: true, action: 'continue' },
        replayed: false,
      })),
      heartbeat: vi.fn(),
      complete: vi.fn(),
    }
    const { result } = renderHook(() =>
      useStrictProctoring({ examId: 3, attemptId: session.attemptId, policy, isOnline: true, adapter, api: api as any }),
    )
    expect(result.current.phase).toBe('notice')
    await act(async () => {
      await result.current.begin({ accepted: true, biometricConsent: true, locale: 'zh-CN' })
    })
    await waitFor(() => expect(result.current.phase).toBe('active'))
    expect(order).toEqual(['consent', 'permissions'])
    expect(adapter.captureIdentityFrames).toHaveBeenCalledOnce()
    expect(api.reportFactualEvent).toHaveBeenCalledWith(
      session.sessionId,
      expect.objectContaining({ type: 'session_started', sequence: 1 }),
    )
  })
})
