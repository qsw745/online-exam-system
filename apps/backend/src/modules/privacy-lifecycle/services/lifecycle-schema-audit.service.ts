import type { LifecycleSchemaCoverageReport, LifecycleSchemaColumn } from '../domain/data-handler.registry'
import { assertLifecycleSchemaCovered } from '../domain/data-handler.registry'

export interface LifecycleSchemaAuditQueryable {
  query(sql: string): Promise<[unknown[], unknown]>
}

export const LIFECYCLE_SCHEMA_AUDIT_SQL = `
  SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName,
         REFERENCED_TABLE_NAME AS referencedTableName
    FROM information_schema.KEY_COLUMN_USAGE
   WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = 'users'
  UNION DISTINCT
  SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName, NULL AS referencedTableName
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME IN (
       SELECT TABLE_NAME FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
     )
     AND (
       COLUMN_NAME IN (
         'user_id','actor_user_id','created_by','updated_by','assigned_by','shared_by','reviewer_user_id',
         'child_user_id','guardian_user_id','sender_id','recipient_id','email','phone','username','nickname',
         'identifier_normalized','provider_subject','provider_user_id','ip','ip_address','ua','user_agent',
         'token','jti','embedding','evidence_json','avatar','avatar_url'
       )
       OR (TABLE_NAME = 'users' AND COLUMN_NAME IN ('id', 'public_id'))
     )
`

const normalizeRow = (value: unknown): LifecycleSchemaColumn => {
  const row = value as Record<string, unknown>
  return {
    tableName: String(row.tableName ?? row.TABLE_NAME ?? ''),
    columnName: String(row.columnName ?? row.COLUMN_NAME ?? ''),
    referencedTableName:
      row.referencedTableName == null && row.REFERENCED_TABLE_NAME == null
        ? null
        : String(row.referencedTableName ?? row.REFERENCED_TABLE_NAME),
  }
}

export class LifecycleSchemaAuditService {
  constructor(private readonly database: LifecycleSchemaAuditQueryable) {}

  async inspect(): Promise<LifecycleSchemaCoverageReport> {
    const [rows] = await this.database.query(LIFECYCLE_SCHEMA_AUDIT_SQL)
    return assertLifecycleSchemaCovered(rows.map(normalizeRow))
  }
}
