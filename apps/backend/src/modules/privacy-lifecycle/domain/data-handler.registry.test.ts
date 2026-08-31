import assert from 'node:assert/strict'
import test from 'node:test'

import {
  LIFECYCLE_DATASETS,
  LifecycleDatasetCoverageError,
  assertLifecycleSchemaCovered,
} from './data-handler.registry'

test('新增的用户关联列未注册时阻断生命周期执行', () => {
  assert.throws(
    () => assertLifecycleSchemaCovered([
      { tableName: 'users', columnName: 'id', referencedTableName: null },
      { tableName: 'new_subject_notes', columnName: 'user_id', referencedTableName: 'users' },
    ]),
    (error: unknown) =>
      error instanceof LifecycleDatasetCoverageError &&
      error.code === 'LIFECYCLE_UNCLASSIFIED_DATASET' &&
      error.uncovered.length === 1 &&
      error.uncovered[0]?.tableName === 'new_subject_notes' &&
      error.uncovered[0]?.columnName === 'user_id',
  )
})

test('当前主体、操作者和直接标识列都有显式分类', () => {
  const report = assertLifecycleSchemaCovered([
    { tableName: 'users', columnName: 'id', referencedTableName: null },
    { tableName: 'users', columnName: 'email', referencedTableName: null },
    { tableName: 'account_deletion_requests', columnName: 'user_id', referencedTableName: 'users' },
    { tableName: 'refresh_tokens', columnName: 'jti', referencedTableName: null },
    { tableName: 'face_credentials', columnName: 'user_id', referencedTableName: 'users' },
    { tableName: 'face_credentials', columnName: 'embedding', referencedTableName: null },
    { tableName: 'favorite_shares', columnName: 'shared_by', referencedTableName: 'users' },
    { tableName: 'proctoring_review_decisions', columnName: 'actor_user_id', referencedTableName: 'users' },
    { tableName: 'data_retention_holds', columnName: 'created_by', referencedTableName: 'users' },
    { tableName: 'data_lifecycle_controls', columnName: 'updated_by', referencedTableName: 'users' },
    { tableName: 'data_lifecycle_admin_operations', columnName: 'actor_user_id', referencedTableName: 'users' },
    { tableName: 'logs', columnName: 'ip', referencedTableName: null },
  ])

  assert.equal(report.coveredColumnCount, 12)
  assert.equal(report.uncoveredColumnCount, 0)
  assert.ok((report.categoryCounts.AUTH_CREDENTIALS ?? 0) >= 1)
  assert.ok((report.categoryCounts.SECURITY_LOGS ?? 0) >= 1)
})

test('注册表只包含固定 SQL 标识符和处理器代码', () => {
  for (const dataset of LIFECYCLE_DATASETS) {
    assert.match(dataset.tableName, /^[a-z][a-z0-9_]*$/)
    assert.match(dataset.handlerCode, /^[a-z][a-z0-9_]*$/)
    assert.ok(dataset.subjectColumns.length + dataset.identityColumns.length > 0)
    for (const column of [...dataset.subjectColumns, ...dataset.identityColumns]) {
      assert.match(column, /^[a-z][a-z0-9_]*$/)
    }
  }
})
