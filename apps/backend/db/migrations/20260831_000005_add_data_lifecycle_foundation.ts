import type { Knex } from 'knex'

export const LIFECYCLE_STEP_PARENTS = ['request_id', 'scan_run_id'] as const
export const ACCOUNT_DELETION_USER_FK = 'fk_account_deletion_user_set_null'
export const LIFECYCLE_ADMIN_OPERATIONS_TABLE = 'data_lifecycle_admin_operations'

const ACCOUNT_DELETION_REQUESTS = 'account_deletion_requests'
const LIFECYCLE_POLICY_VERSION = 'wenheng-lifecycle-2026-08-v1'

const RETENTION_COLUMN_TABLES = [
  'exam_results',
  'answer_records',
  'proctoring_sessions',
  'proctoring_events',
  'proctoring_identity_checks',
  'proctoring_review_cases',
] as const

const NULLABLE_SUBJECT_COLUMNS: ReadonlyArray<readonly [string, string]> = [
  ['exam_results', 'user_id'],
  ['answer_records', 'user_id'],
  ['proctoring_consents', 'user_id'],
  ['proctoring_sessions', 'user_id'],
  ['proctoring_events', 'user_id'],
  ['proctoring_identity_checks', 'user_id'],
  ['proctoring_review_cases', 'user_id'],
  ['proctoring_review_decisions', 'actor_user_id'],
  ['proctoring_review_messages', 'actor_user_id'],
  ['proctoring_review_appeals', 'user_id'],
  ['discussions', 'user_id'],
  ['discussion_replies', 'user_id'],
  ['guardian_consents', 'child_user_id'],
  ['guardian_consents', 'guardian_user_id'],
  ['tasks', 'user_id'],
  ['task_department_assignments', 'assigned_by'],
  ['announcements', 'created_by'],
  ['files', 'created_by'],
  ['files', 'updated_by'],
  ['workflow_requests', 'created_by'],
  ['workflow_approvals', 'user_id'],
  ['workflow_templates', 'created_by'],
  ['workflow_instances', 'created_by'],
  ['face_credentials', 'created_by'],
  ['logs', 'user_id'],
]

type ColumnMetadata = {
  COLUMN_TYPE: string
  IS_NULLABLE: 'YES' | 'NO'
}

async function databaseName(knex: Knex): Promise<string> {
  const configured = (knex.client.config as any)?.connection?.database
  if (typeof configured === 'string' && configured) return configured
  const [rows] = await knex.raw('SELECT DATABASE() AS database_name')
  const value = rows?.[0]?.database_name
  if (!value) throw new Error('Cannot determine current database')
  return String(value)
}

async function usersIdColumnType(knex: Knex): Promise<string> {
  const database = await databaseName(knex)
  const [rows] = await knex.raw(
    `SELECT COLUMN_TYPE
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'id'
      LIMIT 1`,
    [database],
  )
  const columnType = rows?.[0]?.COLUMN_TYPE as string | undefined
  if (!columnType) throw new Error('Cannot introspect users.id column type')
  return validateColumnType(columnType)
}

function validateColumnType(value: string): string {
  if (!/^[a-z0-9_(),.' ]+$/i.test(value)) {
    throw new Error(`Unsafe database column type: ${value}`)
  }
  return value
}

async function columnMetadata(knex: Knex, tableName: string, columnName: string): Promise<ColumnMetadata | null> {
  const database = await databaseName(knex)
  const [rows] = await knex.raw(
    `SELECT COLUMN_TYPE, IS_NULLABLE
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
      LIMIT 1`,
    [database, tableName, columnName],
  )
  return (rows?.[0] as ColumnMetadata | undefined) ?? null
}

async function makeColumnNullable(knex: Knex, tableName: string, columnName: string): Promise<void> {
  if (!(await knex.schema.hasTable(tableName)) || !(await knex.schema.hasColumn(tableName, columnName))) return
  const metadata = await columnMetadata(knex, tableName, columnName)
  if (!metadata || metadata.IS_NULLABLE === 'YES') return
  const columnType = validateColumnType(metadata.COLUMN_TYPE)
  await knex.raw(`ALTER TABLE ?? MODIFY COLUMN ?? ${columnType} NULL`, [tableName, columnName])
}

async function makeColumnRequired(knex: Knex, tableName: string, columnName: string): Promise<void> {
  if (!(await knex.schema.hasTable(tableName)) || !(await knex.schema.hasColumn(tableName, columnName))) return
  const metadata = await columnMetadata(knex, tableName, columnName)
  if (!metadata || metadata.IS_NULLABLE === 'NO') return
  const [{ null_count }] = await knex(tableName).whereNull(columnName).count<{ null_count: number }[]>({ null_count: '*' })
  if (Number(null_count) > 0) {
    throw new Error(`Cannot restore required column ${tableName}.${columnName}: null values exist`)
  }
  const columnType = validateColumnType(metadata.COLUMN_TYPE)
  await knex.raw(`ALTER TABLE ?? MODIFY COLUMN ?? ${columnType} NOT NULL`, [tableName, columnName])
}

async function foreignKeysForColumn(knex: Knex, tableName: string, columnName: string): Promise<string[]> {
  const database = await databaseName(knex)
  const [rows] = await knex.raw(
    `SELECT CONSTRAINT_NAME
       FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
        AND REFERENCED_TABLE_NAME IS NOT NULL`,
    [database, tableName, columnName],
  )
  return (rows as Array<{ CONSTRAINT_NAME: string }>).map(row => row.CONSTRAINT_NAME)
}

async function dropForeignKeysForColumn(knex: Knex, tableName: string, columnName: string): Promise<void> {
  for (const constraint of await foreignKeysForColumn(knex, tableName, columnName)) {
    await knex.schema.alterTable(tableName, table => table.dropForeign([columnName], constraint))
  }
}

async function addColumnIfMissing(
  knex: Knex,
  tableName: string,
  columnName: string,
  add: (table: Knex.AlterTableBuilder) => void,
): Promise<void> {
  if (!(await knex.schema.hasTable(tableName))) return
  if (!(await knex.schema.hasColumn(tableName, columnName))) {
    await knex.schema.alterTable(tableName, add)
  }
}

async function dropColumnIfPresent(knex: Knex, tableName: string, columnName: string): Promise<void> {
  if ((await knex.schema.hasTable(tableName)) && (await knex.schema.hasColumn(tableName, columnName))) {
    await knex.schema.alterTable(tableName, table => table.dropColumn(columnName))
  }
}

async function extendAccountDeletionRequests(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(ACCOUNT_DELETION_REQUESTS))) {
    throw new Error('mobile account foundation migration must run before lifecycle migration')
  }

  await dropForeignKeysForColumn(knex, ACCOUNT_DELETION_REQUESTS, 'user_id')
  await makeColumnNullable(knex, ACCOUNT_DELETION_REQUESTS, 'user_id')
  await makeColumnNullable(knex, ACCOUNT_DELETION_REQUESTS, 'confirmation_phrase')
  await makeColumnNullable(knex, ACCOUNT_DELETION_REQUESTS, 'reauthenticated_at')

  if ((await foreignKeysForColumn(knex, ACCOUNT_DELETION_REQUESTS, 'user_id')).length === 0) {
    await knex.schema.alterTable(ACCOUNT_DELETION_REQUESTS, table => {
      table.foreign('user_id', ACCOUNT_DELETION_USER_FK).references('users.id').onDelete('SET NULL')
    })
  }

  await addColumnIfMissing(knex, ACCOUNT_DELETION_REQUESTS, 'deletion_mode', table => {
    table.string('deletion_mode', 24).notNullable().defaultTo('GRACE_PERIOD')
  })
  await addColumnIfMissing(knex, ACCOUNT_DELETION_REQUESTS, 'execution_status', table => {
    table.string('execution_status', 48).notNullable().defaultTo('SCHEDULED').index('idx_account_deletion_execution')
  })
  await addColumnIfMissing(knex, ACCOUNT_DELETION_REQUESTS, 'request_digest', table => {
    table.string('request_digest', 64).nullable()
  })
  await addColumnIfMissing(knex, ACCOUNT_DELETION_REQUESTS, 'policy_version', table => {
    table.string('policy_version', 80).nullable()
  })
  await addColumnIfMissing(knex, ACCOUNT_DELETION_REQUESTS, 'policy_snapshot_json', table => {
    table.json('policy_snapshot_json').nullable()
  })
  await addColumnIfMissing(knex, ACCOUNT_DELETION_REQUESTS, 'status_token_digest', table => {
    table.string('status_token_digest', 64).nullable()
  })
  await addColumnIfMissing(knex, ACCOUNT_DELETION_REQUESTS, 'started_at', table => {
    table.timestamp('started_at', { useTz: false }).nullable()
  })
  await addColumnIfMissing(knex, ACCOUNT_DELETION_REQUESTS, 'next_attempt_at', table => {
    table.timestamp('next_attempt_at', { useTz: false }).nullable().index('idx_account_deletion_next_attempt')
  })
  await addColumnIfMissing(knex, ACCOUNT_DELETION_REQUESTS, 'last_error_code', table => {
    table.string('last_error_code', 96).nullable()
  })

  await knex(ACCOUNT_DELETION_REQUESTS)
    .whereNull('policy_version')
    .update({
      deletion_mode: 'GRACE_PERIOD',
      execution_status: knex.raw(
        `CASE status
           WHEN 'CANCELLED' THEN 'CANCELLED'
           WHEN 'COMPLETED' THEN 'COMPLETED'
           ELSE 'SCHEDULED'
         END`,
      ),
      policy_version: LIFECYCLE_POLICY_VERSION,
    })
}

async function createLifecycleParents(knex: Knex, userIdType: string): Promise<void> {
  if (!(await knex.schema.hasTable('data_retention_policies'))) {
    await knex.schema.createTable('data_retention_policies', table => {
      table.bigIncrements('id').primary()
      table.uuid('policy_id').notNullable().unique('uk_retention_policy_id')
      table.string('data_region', 16).notNullable()
      table.bigInteger('institution_id').unsigned().nullable()
      table.string('account_type', 24).nullable()
      table.string('category_code', 64).notNullable()
      table.integer('retention_days').unsigned().notNullable()
      table.integer('minimum_days').unsigned().nullable()
      table.integer('maximum_days').unsigned().nullable()
      table.string('policy_version', 80).notNullable()
      table.specificType('created_by', userIdType).nullable()
      table.timestamp('effective_from', { useTz: false }).notNullable()
      table.timestamp('retired_at', { useTz: false }).nullable()
      table.timestamp('created_at', { useTz: false }).notNullable().defaultTo(knex.fn.now())
      table.unique(
        ['data_region', 'institution_id', 'account_type', 'category_code', 'policy_version'],
        'uk_retention_policy_scope_version',
      )
      table.index(['data_region', 'category_code', 'effective_from'], 'idx_retention_policy_effective')
      table.foreign('created_by', 'fk_retention_policy_creator').references('users.id').onDelete('SET NULL')
    })
  }

  if (!(await knex.schema.hasTable('data_lifecycle_controls'))) {
    await knex.schema.createTable('data_lifecycle_controls', table => {
      table.string('data_region', 16).primary()
      table.boolean('paused').notNullable().defaultTo(false)
      table.string('pause_reason', 500).nullable()
      table.timestamp('review_at', { useTz: false }).nullable()
      table.specificType('updated_by', userIdType).nullable()
      table.timestamp('updated_at', { useTz: false }).notNullable().defaultTo(knex.fn.now())
      table.foreign('updated_by', 'fk_lifecycle_control_actor').references('users.id').onDelete('SET NULL')
    })
  }

  if (!(await knex.schema.hasTable(LIFECYCLE_ADMIN_OPERATIONS_TABLE))) {
    await knex.schema.createTable(LIFECYCLE_ADMIN_OPERATIONS_TABLE, table => {
      table.bigIncrements('id').primary()
      table.uuid('operation_id').notNullable().unique('uk_lifecycle_admin_operation_id')
      table.string('data_region', 16).notNullable()
      table.string('operation_type', 48).notNullable()
      table.string('request_digest', 64).notNullable()
      table.json('result_json').nullable()
      table.specificType('actor_user_id', userIdType).nullable()
      table.timestamp('completed_at', { useTz: false }).nullable()
      table.timestamp('created_at', { useTz: false }).notNullable().defaultTo(knex.fn.now())
      table.index(['data_region', 'created_at'], 'idx_lifecycle_admin_operation_region')
      table.foreign('actor_user_id', 'fk_lifecycle_admin_operation_actor').references('users.id').onDelete('SET NULL')
    })
  }

  if (!(await knex.schema.hasTable('data_retention_scan_runs'))) {
    await knex.schema.createTable('data_retention_scan_runs', table => {
      table.bigIncrements('id').primary()
      table.uuid('scan_run_id').notNullable().unique('uk_retention_scan_run_id')
      table.string('data_region', 16).notNullable()
      table.string('policy_version', 80).notNullable()
      table.string('category_code', 64).notNullable()
      table.timestamp('window_start', { useTz: false }).notNullable()
      table.timestamp('window_end', { useTz: false }).notNullable()
      table.string('status', 32).notNullable().defaultTo('PENDING')
      table.string('lease_owner', 96).nullable()
      table.timestamp('lease_expires_at', { useTz: false }).nullable()
      table.json('cursor_json').nullable()
      table.bigInteger('planned_count').unsigned().notNullable().defaultTo(0)
      table.bigInteger('processed_count').unsigned().notNullable().defaultTo(0)
      table.integer('attempt_count').unsigned().notNullable().defaultTo(0)
      table.timestamp('next_attempt_at', { useTz: false }).nullable()
      table.string('last_error_code', 96).nullable()
      table.timestamp('started_at', { useTz: false }).nullable()
      table.timestamp('completed_at', { useTz: false }).nullable()
      table.timestamp('created_at', { useTz: false }).notNullable().defaultTo(knex.fn.now())
      table.timestamp('updated_at', { useTz: false }).notNullable().defaultTo(knex.fn.now())
      table.unique(
        ['data_region', 'category_code', 'window_start', 'window_end'],
        'uk_retention_scan_region_category_window',
      )
      table.index(['status', 'next_attempt_at', 'lease_expires_at'], 'idx_retention_scan_due')
    })
  }
}

async function createLifecycleSupportingTables(knex: Knex, userIdType: string): Promise<void> {
  if (!(await knex.schema.hasTable('data_retention_holds'))) {
    await knex.schema.createTable('data_retention_holds', table => {
      table.bigIncrements('id').primary()
      table.uuid('hold_id').notNullable().unique('uk_retention_hold_id')
      table.string('data_region', 16).notNullable()
      table.string('category_code', 64).notNullable()
      table.string('scope_type', 32).notNullable()
      table.string('scope_id', 128).notNullable()
      table.string('reason_code', 64).notNullable()
      table.string('legal_basis_reference', 500).notNullable()
      table.string('request_digest', 64).notNullable()
      table.timestamp('expires_at', { useTz: false }).notNullable()
      table.specificType('created_by', userIdType).nullable()
      table.specificType('released_by', userIdType).nullable()
      table.timestamp('released_at', { useTz: false }).nullable()
      table.timestamp('created_at', { useTz: false }).notNullable().defaultTo(knex.fn.now())
      table.timestamp('updated_at', { useTz: false }).notNullable().defaultTo(knex.fn.now())
      table.index(['data_region', 'category_code', 'scope_type', 'scope_id'], 'idx_retention_hold_scope')
      table.index(['expires_at', 'released_at'], 'idx_retention_hold_expiry')
      table.foreign('created_by', 'fk_retention_hold_creator').references('users.id').onDelete('SET NULL')
      table.foreign('released_by', 'fk_retention_hold_releaser').references('users.id').onDelete('SET NULL')
    })
  }

  if (!(await knex.schema.hasTable('anonymous_exam_subjects'))) {
    await knex.schema.createTable('anonymous_exam_subjects', table => {
      table.uuid('anonymous_subject_id').primary()
      table.string('data_region', 16).notNullable()
      table.string('display_label', 64).notNullable().defaultTo('已注销考生')
      table.timestamp('retain_until', { useTz: false }).notNullable()
      table.timestamp('created_at', { useTz: false }).notNullable().defaultTo(knex.fn.now())
      table.index(['data_region', 'retain_until'], 'idx_anonymous_subject_expiry')
    })
  }

  if (!(await knex.schema.hasTable('data_deletion_receipts'))) {
    await knex.schema.createTable('data_deletion_receipts', table => {
      table.bigIncrements('id').primary()
      table.uuid('receipt_id').notNullable().unique('uk_deletion_receipt_id')
      table.uuid('request_id').notNullable().unique('uk_deletion_receipt_request')
      table.string('data_region', 16).notNullable()
      table.string('outcome', 48).notNullable()
      table.string('policy_version', 80).notNullable()
      table.json('summary_json').notNullable()
      table.timestamp('completed_at', { useTz: false }).notNullable()
      table.timestamp('retain_until', { useTz: false }).notNullable()
      table.timestamp('created_at', { useTz: false }).notNullable().defaultTo(knex.fn.now())
      table.index(['data_region', 'retain_until'], 'idx_deletion_receipt_expiry')
    })
  }

  if (!(await knex.schema.hasTable('data_deletion_tombstones'))) {
    await knex.schema.createTable('data_deletion_tombstones', table => {
      table.bigIncrements('id').primary()
      table.uuid('tombstone_id').notNullable().unique('uk_deletion_tombstone_id')
      table.uuid('request_id').notNullable()
      table.string('data_region', 16).notNullable()
      table.string('subject_digest', 64).notNullable()
      table.string('key_version', 80).notNullable()
      table.string('sync_status', 24).notNullable().defaultTo('PENDING')
      table.integer('attempt_count').unsigned().notNullable().defaultTo(0)
      table.timestamp('next_attempt_at', { useTz: false }).nullable()
      table.timestamp('synced_at', { useTz: false }).nullable()
      table.timestamp('completed_at', { useTz: false }).notNullable()
      table.timestamp('retain_until', { useTz: false }).notNullable()
      table.timestamp('created_at', { useTz: false }).notNullable().defaultTo(knex.fn.now())
      table.unique(['request_id', 'subject_digest'], 'uk_deletion_tombstone_request_digest')
      table.index(['sync_status', 'next_attempt_at'], 'idx_deletion_tombstone_sync')
      table.index(['data_region', 'retain_until'], 'idx_deletion_tombstone_expiry')
    })
  }

  if (!(await knex.schema.hasTable('transactional_outbox'))) {
    await knex.schema.createTable('transactional_outbox', table => {
      table.bigIncrements('id').primary()
      table.uuid('message_id').notNullable().unique('uk_transactional_outbox_id')
      table.string('message_key', 191).notNullable().unique('uk_transactional_outbox_key')
      table.uuid('request_id').nullable()
      table.string('data_region', 16).notNullable()
      table.string('message_type', 64).notNullable()
      table.string('status', 24).notNullable().defaultTo('PENDING')
      table.json('recipient_envelope_json').nullable()
      table.json('payload_envelope_json').nullable()
      table.integer('attempt_count').unsigned().notNullable().defaultTo(0)
      table.timestamp('next_attempt_at', { useTz: false }).nullable()
      table.string('last_error_code', 96).nullable()
      table.string('lease_owner', 96).nullable()
      table.timestamp('lease_expires_at', { useTz: false }).nullable()
      table.timestamp('sent_at', { useTz: false }).nullable()
      table.timestamp('expires_at', { useTz: false }).notNullable()
      table.timestamp('created_at', { useTz: false }).notNullable().defaultTo(knex.fn.now())
      table.timestamp('updated_at', { useTz: false }).notNullable().defaultTo(knex.fn.now())
      table.index(['status', 'next_attempt_at', 'lease_expires_at'], 'idx_transactional_outbox_due')
      table.index(['expires_at'], 'idx_transactional_outbox_expiry')
      table.foreign('request_id', 'fk_outbox_deletion_request')
        .references(`${ACCOUNT_DELETION_REQUESTS}.request_id`)
        .onDelete('SET NULL')
    })
  }
}

async function createLifecycleSteps(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('data_lifecycle_steps')) return

  await knex.schema.createTable('data_lifecycle_steps', table => {
    table.bigIncrements('id').primary()
    table.uuid('step_id').notNullable().unique('uk_lifecycle_step_id')
    table.uuid('request_id').nullable()
    table.uuid('scan_run_id').nullable()
    table.string('step_code', 64).notNullable()
    table.string('category_code', 64).notNullable()
    table.string('action', 32).notNullable()
    table.string('status', 32).notNullable().defaultTo('PENDING')
    table.json('cursor_json').nullable()
    table.bigInteger('planned_count').unsigned().notNullable().defaultTo(0)
    table.bigInteger('processed_count').unsigned().notNullable().defaultTo(0)
    table.integer('attempt_count').unsigned().notNullable().defaultTo(0)
    table.string('lease_owner', 96).nullable()
    table.timestamp('lease_expires_at', { useTz: false }).nullable()
    table.timestamp('next_attempt_at', { useTz: false }).nullable()
    table.timestamp('started_at', { useTz: false }).nullable()
    table.timestamp('completed_at', { useTz: false }).nullable()
    table.string('last_error_code', 96).nullable()
    table.timestamp('created_at', { useTz: false }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: false }).notNullable().defaultTo(knex.fn.now())
    table.unique(['request_id', 'step_code'], 'uk_lifecycle_request_step')
    table.unique(['scan_run_id', 'step_code'], 'uk_lifecycle_scan_step')
    table.index(['status', 'next_attempt_at', 'lease_expires_at'], 'idx_lifecycle_step_due')
    table.foreign('request_id', 'fk_lifecycle_step_request')
      .references(`${ACCOUNT_DELETION_REQUESTS}.request_id`)
      .onDelete('CASCADE')
    table.foreign('scan_run_id', 'fk_lifecycle_step_scan')
      .references('data_retention_scan_runs.scan_run_id')
      .onDelete('CASCADE')
  })
  await knex.raw(
    `ALTER TABLE data_lifecycle_steps
       ADD CONSTRAINT chk_lifecycle_one_parent
       CHECK ((request_id IS NULL) <> (scan_run_id IS NULL))`,
  )
}

async function addRetentionColumns(knex: Knex): Promise<void> {
  for (const tableName of RETENTION_COLUMN_TABLES) {
    if (!(await knex.schema.hasTable(tableName))) continue

    await addColumnIfMissing(knex, tableName, 'anonymous_subject_id', table => {
      table.uuid('anonymous_subject_id').nullable().index(`idx_${tableName}_anonymous_subject`)
    })
    await addColumnIfMissing(knex, tableName, 'retain_until', table => {
      table.timestamp('retain_until', { useTz: false }).nullable().index(`idx_${tableName}_retain_until`)
    })
    await addColumnIfMissing(knex, tableName, 'retention_policy_version', table => {
      table.string('retention_policy_version', 80).nullable()
    })
  }

  await addColumnIfMissing(knex, 'logs', 'retain_until', table => {
    table.timestamp('retain_until', { useTz: false }).nullable().index('idx_logs_retain_until')
  })
  await addColumnIfMissing(knex, 'logs', 'retention_policy_version', table => {
    table.string('retention_policy_version', 80).nullable()
  })

  for (const [tableName, columnName] of NULLABLE_SUBJECT_COLUMNS) {
    await makeColumnNullable(knex, tableName, columnName)
  }
}

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('users'))) throw new Error('users table is required')

  const userIdType = await usersIdColumnType(knex)
  await extendAccountDeletionRequests(knex)
  await createLifecycleParents(knex, userIdType)
  await createLifecycleSupportingTables(knex, userIdType)
  await createLifecycleSteps(knex)
  await addRetentionColumns(knex)
}

async function assertRollbackSafe(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(ACCOUNT_DELETION_REQUESTS))) return

  if (await knex.schema.hasColumn(ACCOUNT_DELETION_REQUESTS, 'execution_status')) {
    const [{ irreversible_count }] = await knex(ACCOUNT_DELETION_REQUESTS)
      .whereNull('user_id')
      .orWhereIn('execution_status', ['RUNNING', 'COMPLETED', 'COMPLETED_WITH_RESTRICTED_RETENTION'])
      .count<{ irreversible_count: number }[]>({ irreversible_count: '*' })
    if (Number(irreversible_count) > 0) {
      throw new Error('Cannot rollback lifecycle schema after irreversible deletion execution')
    }
  }

  if (await knex.schema.hasTable('anonymous_exam_subjects')) {
    const [{ anonymous_count }] = await knex('anonymous_exam_subjects')
      .count<{ anonymous_count: number }[]>({ anonymous_count: '*' })
    if (Number(anonymous_count) > 0) {
      throw new Error('Cannot rollback lifecycle schema after exam archive anonymization')
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  await assertRollbackSafe(knex)

  await knex.schema.dropTableIfExists('data_lifecycle_steps')
  await knex.schema.dropTableIfExists('transactional_outbox')
  await knex.schema.dropTableIfExists('data_deletion_tombstones')
  await knex.schema.dropTableIfExists('data_deletion_receipts')
  await knex.schema.dropTableIfExists('anonymous_exam_subjects')
  await knex.schema.dropTableIfExists('data_retention_holds')
  await knex.schema.dropTableIfExists('data_retention_scan_runs')
  await knex.schema.dropTableIfExists(LIFECYCLE_ADMIN_OPERATIONS_TABLE)
  await knex.schema.dropTableIfExists('data_lifecycle_controls')
  await knex.schema.dropTableIfExists('data_retention_policies')

  for (const tableName of RETENTION_COLUMN_TABLES) {
    await dropColumnIfPresent(knex, tableName, 'retention_policy_version')
    if (tableName !== 'proctoring_review_cases') await dropColumnIfPresent(knex, tableName, 'retain_until')
    await dropColumnIfPresent(knex, tableName, 'anonymous_subject_id')
  }
  await dropColumnIfPresent(knex, 'logs', 'retention_policy_version')
  await dropColumnIfPresent(knex, 'logs', 'retain_until')

  if (await knex.schema.hasTable(ACCOUNT_DELETION_REQUESTS)) {
    await dropForeignKeysForColumn(knex, ACCOUNT_DELETION_REQUESTS, 'user_id')
    await makeColumnRequired(knex, ACCOUNT_DELETION_REQUESTS, 'user_id')
    await makeColumnRequired(knex, ACCOUNT_DELETION_REQUESTS, 'confirmation_phrase')
    await makeColumnRequired(knex, ACCOUNT_DELETION_REQUESTS, 'reauthenticated_at')
    await knex.schema.alterTable(ACCOUNT_DELETION_REQUESTS, table => {
      table.foreign('user_id', 'fk_account_deletion_user').references('users.id').onDelete('CASCADE')
    })

    for (const column of [
      'last_error_code',
      'next_attempt_at',
      'started_at',
      'status_token_digest',
      'policy_snapshot_json',
      'policy_version',
      'request_digest',
      'execution_status',
      'deletion_mode',
    ]) {
      await dropColumnIfPresent(knex, ACCOUNT_DELETION_REQUESTS, column)
    }
  }

  // Retained-content actor columns stay nullable after a safe rollback. This is
  // backward-compatible and avoids recreating historical foreign-key semantics
  // incorrectly in installations whose older schema differs.
}
