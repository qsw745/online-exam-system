import { api } from '../core/httpClient'

export type DeletionPreview = {
  status: 'NOT_REQUESTED'
  confirmationPhrase: string
  graceDays: number
  scheduledFor: string
  deleteOrAnonymize: string[]
  conditionalRetention: string[]
  disclaimer: string
}

export type DeletionStatus = {
  requestId?: string
  status: 'NOT_REQUESTED' | 'PENDING' | 'CANCELLED' | 'COMPLETED'
  dataRegion?: 'CN' | 'GLOBAL'
  requestedAt?: string
  scheduledFor?: string
  cancelledAt?: string | null
  completedAt?: string | null
  retentionSummary?: {
    deleteOrAnonymize?: string[]
    conditionalRetention?: string[]
    disclaimer?: string
  }
}

export const accountDeletionApi = {
  preview() {
    return api.get<DeletionPreview>('/account/deletion/preview')
  },
  request(payload: { password: string; confirmationPhrase: string }) {
    return api.post<DeletionStatus>('/account/deletion/request', payload)
  },
  status(payload: { email: string; password: string }) {
    return api.post<DeletionStatus>('/account/deletion/status', payload)
  },
  cancel(payload: { email: string; password: string }) {
    return api.post<DeletionStatus>('/account/deletion/cancel', payload)
  },
}
