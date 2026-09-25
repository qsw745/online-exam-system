import { createFixedTableHandler, defaultLifecycleHandlerDatabase, type LifecycleHandlerDatabase } from './handler-support'

const ACTOR_TABLES = [
  { table: 'proctoring_review_decisions', subjectColumn: 'actor_user_id', mode: 'CLEAR' as const },
  { table: 'proctoring_review_messages', subjectColumn: 'actor_user_id', mode: 'CLEAR' as const },
  { table: 'tasks', subjectColumn: 'user_id', mode: 'CLEAR' as const },
  { table: 'exams', subjectColumn: 'created_by', mode: 'CLEAR' as const },
  { table: 'task_assignments', subjectColumn: 'assigned_by', mode: 'CLEAR' as const },
  { table: 'task_department_assignments', subjectColumn: 'assigned_by', mode: 'CLEAR' as const },
  { table: 'announcements', subjectColumn: 'created_by', mode: 'CLEAR' as const },
  { table: 'files', subjectColumn: 'created_by', mode: 'CLEAR' as const },
  { table: 'files', subjectColumn: 'updated_by', mode: 'CLEAR' as const },
  { table: 'workflow_requests', subjectColumn: 'created_by', mode: 'CLEAR' as const },
  { table: 'workflow_approvals', subjectColumn: 'user_id', mode: 'CLEAR' as const },
  { table: 'workflow_templates', subjectColumn: 'created_by', mode: 'CLEAR' as const },
  { table: 'workflow_instances', subjectColumn: 'created_by', mode: 'CLEAR' as const },
  { table: 'face_credentials', subjectColumn: 'created_by', mode: 'CLEAR' as const },
  { table: 'data_retention_policies', subjectColumn: 'created_by', mode: 'CLEAR' as const },
  { table: 'data_retention_holds', subjectColumn: 'created_by', mode: 'CLEAR' as const },
  { table: 'data_retention_holds', subjectColumn: 'released_by', mode: 'CLEAR' as const },
  { table: 'data_lifecycle_controls', subjectColumn: 'updated_by', mode: 'CLEAR' as const },
  { table: 'data_lifecycle_admin_operations', subjectColumn: 'actor_user_id', mode: 'CLEAR' as const },
] as const

export const createRedactAuditActorsHandler = (database: LifecycleHandlerDatabase = defaultLifecycleHandlerDatabase) =>
  createFixedTableHandler({ stepCode: 'redact_audit_actors', category: 'SECURITY_LOGS', database, specs: ACTOR_TABLES })
