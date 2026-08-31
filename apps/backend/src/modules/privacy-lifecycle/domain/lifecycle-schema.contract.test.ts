import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

test('阶段六迁移导出上下行并声明两个互斥步骤父键', async () => {
  const migrationPath = path.resolve(
    __dirname,
    '../../../../db/migrations/20260831_000005_add_data_lifecycle_foundation.ts',
  )
  const migration = await import(pathToFileURL(migrationPath).href)

  assert.equal(typeof migration.up, 'function')
  assert.equal(typeof migration.down, 'function')
  assert.deepEqual(migration.LIFECYCLE_STEP_PARENTS, ['request_id', 'scan_run_id'])
  assert.equal(migration.ACCOUNT_DELETION_USER_FK, 'fk_account_deletion_user_set_null')
  assert.equal(migration.LIFECYCLE_ADMIN_OPERATIONS_TABLE, 'data_lifecycle_admin_operations')
})
