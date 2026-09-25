import type { LifecycleCategoryCode, RetentionAction } from './lifecycle.model'

export type LifecycleDatasetDefinition = {
  tableName: string
  subjectColumns: readonly string[]
  identityColumns: readonly string[]
  category: LifecycleCategoryCode
  action: RetentionAction
  handlerCode: string
}

export type LifecycleSchemaColumn = {
  tableName: string
  columnName: string
  referencedTableName: string | null
}

export type LifecycleSchemaCoverageReport = {
  coveredColumnCount: number
  uncoveredColumnCount: number
  categoryCounts: Partial<Record<LifecycleCategoryCode, number>>
}

const dataset = (
  tableName: string,
  subjectColumns: readonly string[],
  identityColumns: readonly string[],
  category: LifecycleCategoryCode,
  action: RetentionAction,
  handlerCode: string,
): LifecycleDatasetDefinition => ({ tableName, subjectColumns, identityColumns, category, action, handlerCode })

export const LIFECYCLE_DATASETS = [
  dataset(
    'users',
    ['id'],
    ['email', 'phone', 'public_id', 'username', 'nickname', 'avatar', 'avatar_url'],
    'ACCOUNT_ROW',
    'DELETE',
    'delete_account',
  ),
  dataset('account_deletion_requests', ['user_id'], [], 'ACCOUNT_ROW', 'ANONYMIZE', 'delete_account'),

  dataset('refresh_tokens', ['user_id'], ['jti', 'ip', 'user_agent'], 'AUTH_CREDENTIALS', 'DELETE', 'delete_auth_credentials'),
  dataset('password_reset_tokens', ['user_id'], ['token'], 'AUTH_CREDENTIALS', 'DELETE', 'delete_auth_credentials'),
  dataset(
    'user_oauth_accounts',
    ['user_id'],
    ['provider_user_id', 'email', 'avatar_url'],
    'AUTH_CREDENTIALS',
    'DELETE',
    'delete_auth_credentials',
  ),
  dataset(
    'user_identities',
    ['user_id'],
    ['identifier_normalized', 'provider_subject'],
    'AUTH_CREDENTIALS',
    'DELETE',
    'delete_auth_credentials',
  ),

  dataset('face_credentials', ['user_id'], ['embedding'], 'FACE_CREDENTIALS', 'DELETE', 'delete_face_credentials'),

  dataset('user_settings', ['user_id'], [], 'PROFILE_AND_SETTINGS', 'DELETE', 'delete_profile_learning_data'),
  dataset('favorites', ['user_id'], [], 'PROFILE_AND_SETTINGS', 'DELETE', 'delete_profile_learning_data'),
  dataset('favorite_shares', ['shared_by'], [], 'PROFILE_AND_SETTINGS', 'DELETE', 'delete_profile_learning_data'),
  dataset('wrong_question_books', ['user_id'], [], 'PROFILE_AND_SETTINGS', 'DELETE', 'delete_profile_learning_data'),
  dataset(
    'wrong_question_practice_records',
    ['user_id'],
    [],
    'PROFILE_AND_SETTINGS',
    'DELETE',
    'delete_profile_learning_data',
  ),
  dataset(
    'wrong_question_book_shares',
    ['shared_by'],
    [],
    'PROFILE_AND_SETTINGS',
    'DELETE',
    'delete_profile_learning_data',
  ),
  dataset('practice_records', ['user_id'], [], 'PROFILE_AND_SETTINGS', 'DELETE', 'delete_profile_learning_data'),
  dataset('learning_progress', ['user_id'], [], 'PROFILE_AND_SETTINGS', 'DELETE', 'delete_profile_learning_data'),
  dataset('learning_statistics', ['user_id'], [], 'PROFILE_AND_SETTINGS', 'DELETE', 'delete_profile_learning_data'),
  dataset('learning_tracks', ['user_id'], [], 'PROFILE_AND_SETTINGS', 'DELETE', 'delete_profile_learning_data'),
  dataset('learning_goals', ['user_id'], [], 'PROFILE_AND_SETTINGS', 'DELETE', 'delete_profile_learning_data'),
  dataset('learning_achievements', ['user_id'], [], 'PROFILE_AND_SETTINGS', 'DELETE', 'delete_profile_learning_data'),
  dataset('ai_chat_sessions', ['user_id'], [], 'PROFILE_AND_SETTINGS', 'DELETE', 'delete_profile_learning_data'),
  dataset('ai_chat_logs', ['user_id'], [], 'PROFILE_AND_SETTINGS', 'DELETE', 'delete_profile_learning_data'),

  dataset('messages', ['user_id'], [], 'PROFILE_AND_SETTINGS', 'DELETE', 'delete_private_messages_tasks'),
  dataset('todos', ['user_id'], [], 'PROFILE_AND_SETTINGS', 'DELETE', 'delete_private_messages_tasks'),
  dataset('notifications', ['user_id'], [], 'PROFILE_AND_SETTINGS', 'DELETE', 'delete_private_messages_tasks'),
  dataset('user_menus', ['user_id'], [], 'PROFILE_AND_SETTINGS', 'DELETE', 'delete_private_messages_tasks'),
  dataset('mail_recipients', ['recipient_id'], [], 'PROFILE_AND_SETTINGS', 'DELETE', 'delete_private_messages_tasks'),
  dataset('mail_messages', ['sender_id'], [], 'PROFILE_AND_SETTINGS', 'DELETE', 'delete_private_messages_tasks'),

  dataset('user_roles', ['user_id'], [], 'MEMBERSHIPS_AND_RANKINGS', 'DELETE', 'detach_memberships_rankings'),
  dataset(
    'user_organizations',
    ['user_id'],
    [],
    'MEMBERSHIPS_AND_RANKINGS',
    'DELETE',
    'detach_memberships_rankings',
  ),
  dataset('user_org_roles', ['user_id'], [], 'MEMBERSHIPS_AND_RANKINGS', 'DELETE', 'detach_memberships_rankings'),
  dataset('task_assignments', ['user_id'], [], 'MEMBERSHIPS_AND_RANKINGS', 'DELETE', 'detach_memberships_rankings'),
  dataset('leaderboard_entries', ['user_id'], [], 'MEMBERSHIPS_AND_RANKINGS', 'DELETE', 'detach_memberships_rankings'),
  dataset('leaderboard_records', ['user_id'], [], 'MEMBERSHIPS_AND_RANKINGS', 'DELETE', 'detach_memberships_rankings'),
  dataset(
    'competition_participants',
    ['user_id'],
    [],
    'MEMBERSHIPS_AND_RANKINGS',
    'DELETE',
    'detach_memberships_rankings',
  ),

  dataset('discussions', ['user_id'], [], 'USER_CONTENT', 'ANONYMIZE', 'anonymize_user_content'),
  dataset('discussion_replies', ['user_id'], [], 'USER_CONTENT', 'ANONYMIZE', 'anonymize_user_content'),
  dataset('discussion_likes', ['user_id'], [], 'USER_CONTENT', 'ANONYMIZE', 'anonymize_user_content'),
  dataset('discussion_bookmarks', ['user_id'], [], 'USER_CONTENT', 'ANONYMIZE', 'anonymize_user_content'),
  dataset('discussion_follows', ['user_id'], [], 'USER_CONTENT', 'ANONYMIZE', 'anonymize_user_content'),
  dataset('discussion_reports', ['user_id'], [], 'USER_CONTENT', 'ANONYMIZE', 'anonymize_user_content'),
  dataset('user_discussion_stats', ['user_id'], [], 'USER_CONTENT', 'ANONYMIZE', 'anonymize_user_content'),

  dataset('exam_results', ['user_id'], [], 'EXAM_ARCHIVE', 'ANONYMIZE', 'anonymize_exam_archive'),
  dataset('answer_records', ['user_id'], [], 'EXAM_ARCHIVE', 'ANONYMIZE', 'anonymize_exam_archive'),

  dataset(
    'proctoring_consents',
    ['user_id'],
    [],
    'PROCTORING_AND_IDENTITY',
    'RESTRICTED_RETENTION',
    'restrict_proctoring_data',
  ),
  dataset(
    'proctoring_sessions',
    ['user_id'],
    [],
    'PROCTORING_AND_IDENTITY',
    'RESTRICTED_RETENTION',
    'restrict_proctoring_data',
  ),
  dataset(
    'proctoring_events',
    ['user_id'],
    [],
    'PROCTORING_AND_IDENTITY',
    'RESTRICTED_RETENTION',
    'restrict_proctoring_data',
  ),
  dataset(
    'proctoring_identity_checks',
    ['user_id'],
    [],
    'PROCTORING_AND_IDENTITY',
    'RESTRICTED_RETENTION',
    'restrict_proctoring_data',
  ),
  dataset(
    'proctoring_review_cases',
    ['user_id'],
    [],
    'PROCTORING_AND_IDENTITY',
    'RESTRICTED_RETENTION',
    'restrict_proctoring_data',
  ),
  dataset(
    'proctoring_review_appeals',
    ['user_id'],
    [],
    'PROCTORING_AND_IDENTITY',
    'RESTRICTED_RETENTION',
    'restrict_proctoring_data',
  ),
  dataset(
    'guardian_consents',
    ['child_user_id', 'guardian_user_id'],
    ['evidence_json'],
    'PROCTORING_AND_IDENTITY',
    'RESTRICTED_RETENTION',
    'restrict_guardian_consents',
  ),

  dataset(
    'proctoring_review_decisions',
    ['actor_user_id'],
    [],
    'SECURITY_LOGS',
    'ANONYMIZE',
    'redact_audit_actors',
  ),
  dataset(
    'proctoring_review_messages',
    ['actor_user_id'],
    [],
    'SECURITY_LOGS',
    'ANONYMIZE',
    'redact_audit_actors',
  ),
  dataset('tasks', ['user_id'], [], 'SECURITY_LOGS', 'ANONYMIZE', 'redact_audit_actors'),
  dataset('exams', ['created_by'], [], 'SECURITY_LOGS', 'ANONYMIZE', 'redact_audit_actors'),
  dataset('task_assignments', ['assigned_by'], [], 'SECURITY_LOGS', 'ANONYMIZE', 'redact_audit_actors'),
  dataset(
    'task_department_assignments',
    ['assigned_by'],
    [],
    'SECURITY_LOGS',
    'ANONYMIZE',
    'redact_audit_actors',
  ),
  dataset('announcements', ['created_by'], [], 'SECURITY_LOGS', 'ANONYMIZE', 'redact_audit_actors'),
  dataset('files', ['created_by', 'updated_by'], [], 'SECURITY_LOGS', 'ANONYMIZE', 'redact_audit_actors'),
  dataset('workflow_requests', ['created_by'], [], 'SECURITY_LOGS', 'ANONYMIZE', 'redact_audit_actors'),
  dataset('workflow_approvals', ['user_id'], [], 'SECURITY_LOGS', 'ANONYMIZE', 'redact_audit_actors'),
  dataset('workflow_templates', ['created_by'], [], 'SECURITY_LOGS', 'ANONYMIZE', 'redact_audit_actors'),
  dataset('workflow_instances', ['created_by'], [], 'SECURITY_LOGS', 'ANONYMIZE', 'redact_audit_actors'),
  dataset('face_credentials', ['created_by'], [], 'SECURITY_LOGS', 'ANONYMIZE', 'redact_audit_actors'),
  dataset(
    'data_retention_policies',
    ['created_by'],
    [],
    'SECURITY_LOGS',
    'ANONYMIZE',
    'redact_audit_actors',
  ),
  dataset(
    'data_retention_holds',
    ['created_by', 'released_by'],
    [],
    'SECURITY_LOGS',
    'ANONYMIZE',
    'redact_audit_actors',
  ),
  dataset(
    'data_lifecycle_controls',
    ['updated_by'],
    [],
    'SECURITY_LOGS',
    'ANONYMIZE',
    'redact_audit_actors',
  ),
  dataset(
    'data_lifecycle_admin_operations',
    ['actor_user_id'],
    [],
    'SECURITY_LOGS',
    'ANONYMIZE',
    'redact_audit_actors',
  ),
  dataset(
    'logs',
    ['user_id'],
    ['email', 'phone', 'ip', 'ip_address', 'ua', 'user_agent'],
    'SECURITY_LOGS',
    'ANONYMIZE',
    'redact_security_logs',
  ),
  dataset(
    'login_failures',
    [],
    ['email', 'phone', 'identifier_normalized', 'ip', 'ip_address', 'user_agent'],
    'SECURITY_LOGS',
    'ANONYMIZE',
    'redact_security_logs',
  ),
  dataset(
    'auth_login_failures',
    [],
    ['email', 'phone', 'identifier_normalized', 'ip', 'ip_address', 'user_agent'],
    'SECURITY_LOGS',
    'ANONYMIZE',
    'redact_security_logs',
  ),
] as const satisfies readonly LifecycleDatasetDefinition[]

export class LifecycleDatasetCoverageError extends Error {
  readonly code = 'LIFECYCLE_UNCLASSIFIED_DATASET'

  constructor(readonly uncovered: readonly LifecycleSchemaColumn[]) {
    super(`未分类的用户关联数据列：${uncovered.map(item => `${item.tableName}.${item.columnName}`).join('、')}`)
    this.name = 'LifecycleDatasetCoverageError'
  }
}

const definitionsByColumn = new Map<string, LifecycleDatasetDefinition>()
for (const definition of LIFECYCLE_DATASETS) {
  for (const column of [...definition.subjectColumns, ...definition.identityColumns]) {
    const key = `${definition.tableName}.${column}`
    const existing = definitionsByColumn.get(key)
    if (existing && (existing.category !== definition.category || existing.handlerCode !== definition.handlerCode)) {
      throw new Error(`Conflicting lifecycle dataset classification: ${key}`)
    }
    definitionsByColumn.set(key, definition)
  }
}

export function assertLifecycleSchemaCovered(
  schemaColumns: readonly LifecycleSchemaColumn[],
): LifecycleSchemaCoverageReport {
  const uniqueColumns = new Map<string, LifecycleSchemaColumn>()
  for (const column of schemaColumns) {
    uniqueColumns.set(`${column.tableName}.${column.columnName}`, column)
  }

  const uncovered: LifecycleSchemaColumn[] = []
  const categoryCounts: Partial<Record<LifecycleCategoryCode, number>> = {}
  for (const [key, column] of uniqueColumns) {
    const definition = definitionsByColumn.get(key)
    if (!definition) {
      uncovered.push(column)
      continue
    }
    categoryCounts[definition.category] = (categoryCounts[definition.category] ?? 0) + 1
  }

  if (uncovered.length > 0) {
    uncovered.sort((left, right) =>
      `${left.tableName}.${left.columnName}`.localeCompare(`${right.tableName}.${right.columnName}`),
    )
    throw new LifecycleDatasetCoverageError(uncovered)
  }

  return {
    coveredColumnCount: uniqueColumns.size,
    uncoveredColumnCount: 0,
    categoryCounts,
  }
}
