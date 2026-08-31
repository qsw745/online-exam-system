import type {
  DataRegion,
  DeletionMode,
  LifecycleAccountType,
  LifecycleCategoryCode,
  LifecyclePolicySnapshot,
  LifecycleStatus,
  LifecycleStepStatus,
  RetentionAction,
} from '@/modules/privacy-lifecycle/domain/lifecycle.model'

export type AccountDeletionUser = {
  id: number
  email: string
  passwordHash: string
  dataRegion?: DataRegion
  accountType: LifecycleAccountType
  institutionExamRetentionDays?: number
  deletionStatus: string
}

export type AccountDeletionStepPlan = {
  stepCode: string
  category: LifecycleCategoryCode
  action: RetentionAction
}

export type AccountDeletionStepProjection = AccountDeletionStepPlan & {
  status: LifecycleStepStatus
  plannedCount?: number
  processedCount?: number
  attemptCount: number
  lastErrorCode?: string | null
}

export type AccountDeletionRecord = {
  requestId: string
  userId: number | null
  dataRegion: DataRegion
  mode: DeletionMode
  status: LifecycleStatus
  requestDigest: string
  policyVersion: string
  policySnapshot: LifecyclePolicySnapshot
  statusTokenDigest: string
  retentionSummary: unknown
  requestedAt: string
  scheduledFor: string
  startedAt: string | null
  cancelledAt: string | null
  completedAt: string | null
  restrictedRetentionUntil: string | null
  steps: AccountDeletionStepProjection[]
}

export type CreateDeletionRequestInput = {
  requestId: string
  userId: number
  notificationEmail: string
  dataRegion: DataRegion
  mode: DeletionMode
  requestDigest: string
  statusTokenDigest: string
  confirmationPhrase: string
  policySnapshot: LifecyclePolicySnapshot
  retentionSummary: unknown
  scheduledFor: Date
  now: Date
  steps: readonly AccountDeletionStepPlan[]
}

export type CreateDeletionRequestResult = {
  record: AccountDeletionRecord
  replayed: boolean
  revokedSessionIds: string[]
}

export interface AccountDeletionRepositoryContract {
  findUserForReauthentication(userId: number): Promise<AccountDeletionUser | null>
  findUserByEmailForReauthentication(email: string): Promise<AccountDeletionUser | null>
  createOrReplay(input: CreateDeletionRequestInput): Promise<CreateDeletionRequestResult>
  findByStatusCredential(requestId: string): Promise<AccountDeletionRecord | null>
  findLatestByUser(userId: number): Promise<AccountDeletionRecord | null>
  cancelGraceRequest(userId: number, now: Date): Promise<AccountDeletionRecord>
}

export type DeletionStatusStep = {
  stepCode: string
  category: LifecycleCategoryCode
  action: RetentionAction
  status: LifecycleStepStatus
  plannedCount: number
  processedCount: number
  attemptCount: number
  lastErrorCode: string | null
}

export type DeletionStatusResponse =
  | { status: 'NOT_REQUESTED' }
  | {
      requestId: string
      mode: DeletionMode
      dataRegion: DataRegion
      status: LifecycleStatus
      requestedAt: string
      scheduledFor: string
      startedAt: string | null
      cancelledAt: string | null
      completedAt: string | null
      restrictedRetentionUntil: string | null
      cancellable: boolean
      steps: DeletionStatusStep[]
    }

export type DeletionRequestAcceptedResponse = Exclude<DeletionStatusResponse, { status: 'NOT_REQUESTED' }> & {
  statusToken: string
}

export const ACCOUNT_DELETION_STEPS: readonly AccountDeletionStepPlan[] = [
  { stepCode: 'delete_auth_credentials', category: 'AUTH_CREDENTIALS', action: 'DELETE' },
  { stepCode: 'delete_face_credentials', category: 'FACE_CREDENTIALS', action: 'DELETE' },
  { stepCode: 'delete_profile_learning_data', category: 'PROFILE_AND_SETTINGS', action: 'DELETE' },
  { stepCode: 'delete_private_messages_tasks', category: 'PROFILE_AND_SETTINGS', action: 'DELETE' },
  { stepCode: 'anonymize_user_content', category: 'USER_CONTENT', action: 'ANONYMIZE' },
  { stepCode: 'anonymize_exam_archive', category: 'EXAM_ARCHIVE', action: 'ANONYMIZE' },
  {
    stepCode: 'restrict_proctoring_data',
    category: 'PROCTORING_AND_IDENTITY',
    action: 'RESTRICTED_RETENTION',
  },
  {
    stepCode: 'restrict_guardian_consents',
    category: 'PROCTORING_AND_IDENTITY',
    action: 'RESTRICTED_RETENTION',
  },
  {
    stepCode: 'detach_memberships_rankings',
    category: 'MEMBERSHIPS_AND_RANKINGS',
    action: 'DELETE',
  },
  { stepCode: 'redact_audit_actors', category: 'SECURITY_LOGS', action: 'ANONYMIZE' },
  { stepCode: 'redact_security_logs', category: 'SECURITY_LOGS', action: 'ANONYMIZE' },
  { stepCode: 'delete_account', category: 'ACCOUNT_ROW', action: 'DELETE' },
  { stepCode: 'sync_deletion_manifest', category: 'RECEIPT_AND_TOMBSTONE', action: 'NO_SUBJECT_DATA' },
]
