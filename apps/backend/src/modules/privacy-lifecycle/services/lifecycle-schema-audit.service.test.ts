import assert from 'node:assert/strict'
import test from 'node:test'

import { LifecycleDatasetCoverageError } from '../domain/data-handler.registry'
import { LifecycleSchemaAuditService, type LifecycleSchemaAuditQueryable } from './lifecycle-schema-audit.service'

class InformationSchemaOnlyDatabase implements LifecycleSchemaAuditQueryable {
  readonly queries: string[] = []

  constructor(private readonly rows: unknown[]) {}

  async query(sql: string): Promise<[unknown[], unknown]> {
    this.queries.push(sql)
    if (!sql.includes('information_schema.KEY_COLUMN_USAGE') || !sql.includes('information_schema.COLUMNS')) {
      throw new Error('audit attempted to read business rows')
    }
    return [this.rows, []]
  }
}

test('模式审计只读元数据并返回无身份聚合结果', async () => {
  const database = new InformationSchemaOnlyDatabase([
    { tableName: 'users', columnName: 'email', referencedTableName: null },
    { tableName: 'exam_results', columnName: 'user_id', referencedTableName: 'users' },
    { tableName: 'logs', columnName: 'ip', referencedTableName: null },
  ])

  const result = await new LifecycleSchemaAuditService(database).inspect()

  assert.equal(database.queries.length, 1)
  assert.deepEqual(result, {
    coveredColumnCount: 3,
    uncoveredColumnCount: 0,
    categoryCounts: {
      ACCOUNT_ROW: 1,
      EXAM_ARCHIVE: 1,
      SECURITY_LOGS: 1,
    },
  })
})

test('模式审计发现未知身份列时失败关闭且不返回业务内容', async () => {
  const database = new InformationSchemaOnlyDatabase([
    { tableName: 'candidate_notes', columnName: 'phone', referencedTableName: null },
  ])

  await assert.rejects(
    () => new LifecycleSchemaAuditService(database).inspect(),
    (error: unknown) =>
      error instanceof LifecycleDatasetCoverageError &&
      error.code === 'LIFECYCLE_UNCLASSIFIED_DATASET' &&
      error.message === '未分类的用户关联数据列：candidate_notes.phone',
  )
})
