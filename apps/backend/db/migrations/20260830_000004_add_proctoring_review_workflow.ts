import type { Knex } from 'knex'

export const REVIEW_TABLES = {
  cases: 'proctoring_review_cases',
  decisions: 'proctoring_review_decisions',
  messages: 'proctoring_review_messages',
  appeals: 'proctoring_review_appeals',
} as const

const REQUIRED_PHASE4_TABLES = [
  'proctoring_consents',
  'proctoring_sessions',
  'proctoring_events',
  'proctoring_identity_checks',
] as const

export async function up(knex: Knex): Promise<void> {
  for (const table of REQUIRED_PHASE4_TABLES) {
    if (!(await knex.schema.hasTable(table))) {
      throw new Error(`strict proctoring migration must run before review workflow migration: ${table} is required`)
    }
  }

  if (!(await knex.schema.hasTable(REVIEW_TABLES.cases))) {
    await knex.schema.createTable(REVIEW_TABLES.cases, table => {
      table.uuid('case_id').primary()
      table.uuid('session_id').notNullable().unique('uk_proctoring_review_cases_session')
      table.bigInteger('exam_id').unsigned().notNullable()
      table.bigInteger('task_id').unsigned().nullable()
      table.uuid('attempt_id').notNullable()
      table.bigInteger('user_id').unsigned().notNullable()
      table.string('data_region', 16).notNullable()
      table.string('status', 32).notNullable().defaultTo('pending_review')
      table.string('outcome', 32).notNullable().defaultTo('pending')
      table.string('trigger_reason_code', 64).notNullable()
      table.integer('version').unsigned().notNullable().defaultTo(1)
      table.timestamp('opened_at', { useTz: false }).notNullable().defaultTo(knex.fn.now())
      table.timestamp('first_decided_at', { useTz: false }).nullable()
      table.timestamp('appeal_deadline_at', { useTz: false }).nullable()
      table.timestamp('closed_at', { useTz: false }).nullable()
      table.timestamp('retain_until', { useTz: false }).notNullable()
      table.timestamp('created_at', { useTz: false }).notNullable().defaultTo(knex.fn.now())
      table.timestamp('updated_at', { useTz: false }).notNullable().defaultTo(knex.fn.now())
      table.index(['status', 'updated_at'], 'idx_proctoring_review_cases_queue')
      table.index(['exam_id', 'status'], 'idx_proctoring_review_cases_exam')
      table.index(['user_id', 'updated_at'], 'idx_proctoring_review_cases_candidate')
      table.index(['data_region', 'status'], 'idx_proctoring_review_cases_region')
      table.index(['trigger_reason_code', 'updated_at'], 'idx_proctoring_review_cases_reason')
    })
    await knex.raw(
      `ALTER TABLE ${REVIEW_TABLES.cases}
       MODIFY COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
    )
  }

  if (!(await knex.schema.hasTable(REVIEW_TABLES.decisions))) {
    await knex.schema.createTable(REVIEW_TABLES.decisions, table => {
      table.uuid('decision_id').primary()
      table.uuid('case_id').notNullable()
      table.bigInteger('actor_user_id').unsigned().notNullable()
      table.string('action', 40).notNullable()
      table.string('reason_code', 64).notNullable()
      table.string('comment', 1000).notNullable()
      table.string('request_digest', 64).notNullable()
      table.integer('case_version_before').unsigned().notNullable()
      table.integer('case_version_after').unsigned().notNullable()
      table.timestamp('created_at', { useTz: false }).notNullable().defaultTo(knex.fn.now())
      table.index(['case_id', 'created_at'], 'idx_proctoring_review_decisions_case')
      table.index(['actor_user_id', 'created_at'], 'idx_proctoring_review_decisions_actor')
    })
  }

  if (!(await knex.schema.hasTable(REVIEW_TABLES.messages))) {
    await knex.schema.createTable(REVIEW_TABLES.messages, table => {
      table.uuid('message_id').primary()
      table.uuid('case_id').notNullable()
      table.bigInteger('actor_user_id').unsigned().notNullable()
      table.string('message_type', 32).notNullable()
      table.uuid('reply_to_message_id').nullable()
      table.string('body', 1000).notNullable()
      table.string('request_digest', 64).notNullable()
      table.integer('case_version_before').unsigned().notNullable()
      table.integer('case_version_after').unsigned().notNullable()
      table.timestamp('created_at', { useTz: false }).notNullable().defaultTo(knex.fn.now())
      table.index(['case_id', 'created_at'], 'idx_proctoring_review_messages_case')
      table.index(['reply_to_message_id'], 'idx_proctoring_review_messages_reply')
    })
  }

  if (!(await knex.schema.hasTable(REVIEW_TABLES.appeals))) {
    await knex.schema.createTable(REVIEW_TABLES.appeals, table => {
      table.uuid('appeal_id').primary()
      table.uuid('case_id').notNullable().unique('uk_proctoring_review_appeals_case')
      table.bigInteger('user_id').unsigned().notNullable()
      table.string('reason_code', 64).notNullable()
      table.string('statement', 1000).notNullable()
      table.string('status', 24).notNullable().defaultTo('pending')
      table.string('request_digest', 64).notNullable()
      table.uuid('resolution_decision_id').nullable()
      table.timestamp('submitted_at', { useTz: false }).notNullable().defaultTo(knex.fn.now())
      table.timestamp('resolved_at', { useTz: false }).nullable()
      table.index(['user_id', 'submitted_at'], 'idx_proctoring_review_appeals_user')
      table.index(['status', 'submitted_at'], 'idx_proctoring_review_appeals_status')
    })
  }

  await knex.raw(
    `INSERT INTO ${REVIEW_TABLES.cases}
      (case_id, session_id, exam_id, task_id, attempt_id, user_id, data_region,
       status, outcome, trigger_reason_code, version, opened_at, retain_until)
     SELECT UUID(), ps.session_id, ps.exam_id, ps.task_id, ps.attempt_id, ps.user_id, ps.data_region,
            'pending_review', 'pending', COALESCE(ps.review_reason_code, 'REVIEW_REQUIRED'), 1,
            COALESCE(ps.updated_at, CURRENT_TIMESTAMP),
            DATE_ADD(CURRENT_TIMESTAMP, INTERVAL COALESCE(e.proctoring_event_retention_days, 180) DAY)
       FROM proctoring_sessions ps
       JOIN exams e ON e.id = ps.exam_id
       LEFT JOIN ${REVIEW_TABLES.cases} existing ON existing.session_id = ps.session_id
      WHERE ps.state = 'review_required' AND existing.case_id IS NULL`,
  )
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(REVIEW_TABLES.appeals)
  await knex.schema.dropTableIfExists(REVIEW_TABLES.messages)
  await knex.schema.dropTableIfExists(REVIEW_TABLES.decisions)
  await knex.schema.dropTableIfExists(REVIEW_TABLES.cases)
}
