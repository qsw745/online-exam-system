export type DataRegion = 'CN' | 'GLOBAL'
export type LifecycleAccountType = 'PERSONAL' | 'INSTITUTION'

export type DeletionMode = 'IMMEDIATE' | 'GRACE_PERIOD'

export type LifecycleStatus =
  | 'REQUESTED'
  | 'SCHEDULED'
  | 'RUNNING'
  | 'HELD'
  | 'RETRYING'
  | 'ATTENTION_REQUIRED'
  | 'COMPLETED'
  | 'COMPLETED_WITH_RESTRICTED_RETENTION'
  | 'CANCELLED'

export type LifecycleStepStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'HELD'
  | 'RETRYING'
  | 'ATTENTION_REQUIRED'
  | 'COMPLETED'

export type LifecycleCategoryCode =
  | 'AUTH_CREDENTIALS'
  | 'FACE_CREDENTIALS'
  | 'PROFILE_AND_SETTINGS'
  | 'USER_CONTENT'
  | 'EXAM_ARCHIVE'
  | 'PROCTORING_AND_IDENTITY'
  | 'MEMBERSHIPS_AND_RANKINGS'
  | 'SECURITY_LOGS'
  | 'ACCOUNT_ROW'
  | 'RECEIPT_AND_TOMBSTONE'

export type RetentionAction = 'DELETE' | 'ANONYMIZE' | 'RESTRICTED_RETENTION' | 'NO_SUBJECT_DATA'

export type RetentionAnchor =
  | 'ACCOUNT_DELETION'
  | 'CONSENT_WITHDRAWAL_OR_ACCOUNT_DELETION'
  | 'DATA_CREATED'
  | 'EXAM_ENDED'

export type LifecycleCategoryPolicy = {
  action: RetentionAction
  retentionDays: number | null
  retainUntil: string | null
  anchor: RetentionAnchor
}

export type LifecyclePolicySnapshot = {
  version: string
  dataRegion: DataRegion
  accountType: LifecycleAccountType
  createdAt: string
  categories: Record<LifecycleCategoryCode, LifecycleCategoryPolicy>
  identityRawImageRetentionDays: 0
  reviewMinimumAfterCloseDays: 30
  backupMaximumRetentionDays: 30
}

export type LifecycleStepProjection = {
  status: LifecycleStepStatus
  action: RetentionAction
}
