import { api } from '../core/httpClient'

export type DeletionMode = 'IMMEDIATE' | 'GRACE_PERIOD'
export type DeletionLifecycleStatus =
  | 'REQUESTED'
  | 'SCHEDULED'
  | 'RUNNING'
  | 'HELD'
  | 'RETRYING'
  | 'ATTENTION_REQUIRED'
  | 'COMPLETED'
  | 'COMPLETED_WITH_RESTRICTED_RETENTION'
  | 'CANCELLED'

export type DeletionPreview = {
  status: 'NOT_REQUESTED'
  confirmationPhrase: string
  graceDays: number
  scheduledFor: string
  deleteOrAnonymize: string[]
  conditionalRetention: string[]
  disclaimer: string
}

export type DeletionStatusStep = {
  stepCode: string
  category: string
  action: 'DELETE' | 'ANONYMIZE' | 'RESTRICTED_RETENTION' | 'NO_SUBJECT_DATA'
  status: 'PENDING' | 'RUNNING' | 'HELD' | 'RETRYING' | 'ATTENTION_REQUIRED' | 'COMPLETED'
  plannedCount: number
  processedCount: number
  attemptCount: number
  lastErrorCode: string | null
}

export type DeletionStatus =
  | { status: 'NOT_REQUESTED' }
  | {
      requestId: string
      mode: DeletionMode
      dataRegion: 'CN' | 'GLOBAL'
      status: DeletionLifecycleStatus
      requestedAt: string
      scheduledFor: string
      startedAt: string | null
      cancelledAt: string | null
      completedAt: string | null
      restrictedRetentionUntil: string | null
      cancellable: boolean
      steps: DeletionStatusStep[]
      statusToken?: string
    }

export type AccountDeletionRequestPayload = {
  requestId: string
  mode: DeletionMode
  statusToken: string
  password: string
  confirmationPhrase: string
}

export const accountDeletionApi = {
  preview() {
    return api.get<DeletionPreview>('/account/deletion/preview')
  },
  request(payload: AccountDeletionRequestPayload) {
    return api.post<DeletionStatus>('/account/deletion/request', payload)
  },
  status(payload: { requestId: string; statusToken: string } | { email: string; password: string }) {
    return api.post<DeletionStatus>('/account/deletion/status', payload)
  },
  cancel(payload: { email: string; password: string }) {
    return api.post<DeletionStatus>('/account/deletion/cancel', payload)
  },
}

export type AccountDeletionApi = typeof accountDeletionApi
