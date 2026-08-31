import type { Knex } from 'knex'

const EXAMS = 'exams'

async function addExamPolicyColumns(knex: Knex): Promise<void> {
  const columns: Array<[string, (table: Knex.CreateTableBuilder) => void]> = [
    ['proctoring_level', table => table.string('proctoring_level', 16).notNullable().defaultTo('off')],
    ['proctoring_policy_version', table => table.string('proctoring_policy_version', 80).notNullable().defaultTo('wenheng-proctoring-2026-08-v1')],
    ['proctoring_notice_version', table => table.string('proctoring_notice_version', 80).notNullable().defaultTo('wenheng-proctoring-notice-2026-08-v1')],
    ['proctoring_require_identity', table => table.boolean('proctoring_require_identity').notNullable().defaultTo(true)],
    ['proctoring_allow_minors', table => table.boolean('proctoring_allow_minors').notNullable().defaultTo(false)],
    ['proctoring_event_retention_days', table => table.integer('proctoring_event_retention_days').unsigned().notNullable().defaultTo(180)],
    ['proctoring_snapshot_retention_days', table => table.integer('proctoring_snapshot_retention_days').unsigned().notNullable().defaultTo(0)],
    ['proctoring_heartbeat_seconds', table => table.integer('proctoring_heartbeat_seconds').unsigned().notNullable().defaultTo(15)],
    ['proctoring_interruption_grace_seconds', table => table.integer('proctoring_interruption_grace_seconds').unsigned().notNullable().defaultTo(45)],
  ]
  for (const [column, add] of columns) {
    if (!(await knex.schema.hasColumn(EXAMS, column))) {
      await knex.schema.alterTable(EXAMS, add)
    }
  }
}

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(EXAMS))) throw new Error('exams table is required')
  if (!(await knex.schema.hasTable('exam_results'))) throw new Error('exam_results table is required')
  if (!(await knex.schema.hasColumn('exam_results', 'attempt_id'))) {
    throw new Error('exam reliability migration must run before strict proctoring migration')
  }

  await addExamPolicyColumns(knex)

  if (!(await knex.schema.hasTable('proctoring_consents'))) {
    await knex.schema.createTable('proctoring_consents', table => {
      table.bigIncrements('id').primary()
      table.uuid('consent_id').notNullable().unique('uk_proctoring_consents_id')
      table.uuid('attempt_id').notNullable()
      table.bigInteger('exam_id').unsigned().notNullable()
      table.bigInteger('user_id').unsigned().notNullable()
      table.string('data_region', 16).notNullable()
      table.string('policy_version', 80).notNullable()
      table.string('notice_version', 80).notNullable()
      table.string('policy_digest', 64).notNullable()
      table.json('categories_json').notNullable()
      table.string('locale', 16).nullable()
      table.timestamp('accepted_at').notNullable().defaultTo(knex.fn.now())
      table.timestamp('revoked_at').nullable()
      table.timestamp('expires_at').notNullable()
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      table.unique(['attempt_id'], 'uk_proctoring_consents_attempt')
      table.index(['user_id', 'exam_id'], 'idx_proctoring_consents_user_exam')
      table.index(['expires_at', 'revoked_at'], 'idx_proctoring_consents_validity')
    })
  }

  if (!(await knex.schema.hasTable('proctoring_sessions'))) {
    await knex.schema.createTable('proctoring_sessions', table => {
      table.bigIncrements('id').primary()
      table.uuid('session_id').notNullable().unique('uk_proctoring_sessions_id')
      table.uuid('consent_id').notNullable()
      table.uuid('attempt_id').notNullable()
      table.bigInteger('exam_id').unsigned().notNullable()
      table.bigInteger('task_id').unsigned().nullable()
      table.bigInteger('user_id').unsigned().notNullable()
      table.string('data_region', 16).notNullable()
      table.string('state', 32).notNullable().defaultTo('prepared')
      table.integer('last_sequence').unsigned().notNullable().defaultTo(0)
      table.boolean('camera_required').notNullable().defaultTo(true)
      table.boolean('microphone_required').notNullable().defaultTo(true)
      table.boolean('identity_required').notNullable().defaultTo(true)
      table.string('identity_status', 24).notNullable().defaultTo('pending')
      table.timestamp('started_at').nullable()
      table.timestamp('last_heartbeat_at').nullable()
      table.timestamp('interruption_started_at').nullable()
      table.timestamp('completed_at').nullable()
      table.string('review_reason_code', 64).nullable()
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
      table.unique(['attempt_id'], 'uk_proctoring_sessions_attempt')
      table.index(['user_id', 'state'], 'idx_proctoring_sessions_user_state')
      table.index(['exam_id', 'state'], 'idx_proctoring_sessions_exam_state')
      table.index(['state', 'last_heartbeat_at'], 'idx_proctoring_sessions_heartbeat')
    })
    await knex.raw(
      'ALTER TABLE proctoring_sessions MODIFY COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    )
  }

  if (!(await knex.schema.hasTable('proctoring_events'))) {
    await knex.schema.createTable('proctoring_events', table => {
      table.bigIncrements('id').primary()
      table.uuid('event_id').notNullable().unique('uk_proctoring_events_id')
      table.uuid('session_id').notNullable()
      table.bigInteger('exam_id').unsigned().notNullable()
      table.bigInteger('user_id').unsigned().notNullable()
      table.integer('sequence').unsigned().notNullable()
      table.string('event_type', 64).notNullable()
      table.string('severity', 16).notNullable()
      table.json('state_json').nullable()
      table.timestamp('occurred_at', { useTz: false }).notNullable()
      table.timestamp('received_at', { useTz: false }).notNullable().defaultTo(knex.fn.now())
      table.unique(['session_id', 'sequence'], 'uk_proctoring_events_session_seq')
      table.index(['session_id', 'occurred_at'], 'idx_proctoring_events_session_time')
      table.index(['exam_id', 'severity'], 'idx_proctoring_events_exam_severity')
    })
  }

  if (!(await knex.schema.hasTable('proctoring_identity_checks'))) {
    await knex.schema.createTable('proctoring_identity_checks', table => {
      table.bigIncrements('id').primary()
      table.uuid('check_id').notNullable().unique('uk_proctoring_identity_checks_id')
      table.uuid('session_id').notNullable()
      table.bigInteger('exam_id').unsigned().notNullable()
      table.bigInteger('user_id').unsigned().notNullable()
      table.string('result', 24).notNullable()
      table.string('reason_code', 64).nullable()
      table.decimal('similarity', 8, 6).nullable()
      table.boolean('liveness_passed').nullable()
      table.string('model', 80).nullable()
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      table.index(['session_id', 'created_at'], 'idx_proctoring_identity_session_time')
      table.index(['user_id', 'created_at'], 'idx_proctoring_identity_user_time')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('proctoring_identity_checks')
  await knex.schema.dropTableIfExists('proctoring_events')
  await knex.schema.dropTableIfExists('proctoring_sessions')
  await knex.schema.dropTableIfExists('proctoring_consents')

  if (!(await knex.schema.hasTable(EXAMS))) return
  const columns = [
    'proctoring_interruption_grace_seconds',
    'proctoring_heartbeat_seconds',
    'proctoring_snapshot_retention_days',
    'proctoring_event_retention_days',
    'proctoring_allow_minors',
    'proctoring_require_identity',
    'proctoring_notice_version',
    'proctoring_policy_version',
    'proctoring_level',
  ]
  for (const column of columns) {
    if (await knex.schema.hasColumn(EXAMS, column)) {
      await knex.schema.alterTable(EXAMS, table => table.dropColumn(column))
    }
  }
}
