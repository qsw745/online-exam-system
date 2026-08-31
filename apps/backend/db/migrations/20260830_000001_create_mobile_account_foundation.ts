import type { Knex } from 'knex'

const USERS = 'users'
const ORGANIZATIONS = 'organizations'

async function usersIdColumnType(knex: Knex): Promise<string> {
  const database = (knex.client.config as any).connection.database
  const [rows] = await knex.raw(
    `SELECT COLUMN_TYPE
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'id'
      LIMIT 1`,
    [database],
  )
  const type = rows?.[0]?.COLUMN_TYPE as string | undefined
  if (!type) throw new Error('Cannot introspect users.id column type')
  return type
}

async function addUserColumns(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn(USERS, 'public_id'))) {
    await knex.schema.alterTable(USERS, table => table.uuid('public_id').nullable())
    await knex.raw('UPDATE users SET public_id = UUID() WHERE public_id IS NULL')
    await knex.schema.alterTable(USERS, table => table.uuid('public_id').notNullable().alter())
    await knex.schema.alterTable(USERS, table => table.unique(['public_id'], 'uk_users_public_id'))
  }
  if (!(await knex.schema.hasColumn(USERS, 'data_region'))) {
    await knex.schema.alterTable(USERS, table => {
      table.string('data_region', 16).notNullable().defaultTo('CN').index('idx_users_data_region')
    })
  }
  if (!(await knex.schema.hasColumn(USERS, 'country_code'))) {
    await knex.schema.alterTable(USERS, table => table.string('country_code', 2).nullable())
  }
  if (!(await knex.schema.hasColumn(USERS, 'account_type'))) {
    await knex.schema.alterTable(USERS, table => {
      table.string('account_type', 24).notNullable().defaultTo('PERSONAL')
    })
  }
  if (!(await knex.schema.hasColumn(USERS, 'date_of_birth'))) {
    await knex.schema.alterTable(USERS, table => table.date('date_of_birth').nullable())
  }
  if (!(await knex.schema.hasColumn(USERS, 'age_band'))) {
    await knex.schema.alterTable(USERS, table => {
      table.string('age_band', 16).notNullable().defaultTo('UNKNOWN')
    })
  }
  if (!(await knex.schema.hasColumn(USERS, 'deletion_status'))) {
    await knex.schema.alterTable(USERS, table => {
      table.string('deletion_status', 24).notNullable().defaultTo('ACTIVE').index('idx_users_deletion_status')
    })
  }
}

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(USERS))) throw new Error('users table is required')
  await addUserColumns(knex)

  if (await knex.schema.hasTable(ORGANIZATIONS)) {
    if (!(await knex.schema.hasColumn(ORGANIZATIONS, 'data_region'))) {
      await knex.schema.alterTable(ORGANIZATIONS, table => {
        table.string('data_region', 16).notNullable().defaultTo('CN').index('idx_orgs_data_region')
      })
    }
  }

  const userIdType = await usersIdColumnType(knex)

  if (!(await knex.schema.hasTable('user_identities'))) {
    await knex.schema.createTable('user_identities', table => {
      table.bigIncrements('id').primary()
      table.specificType('user_id', userIdType).notNullable()
      table.string('identity_type', 32).notNullable()
      table.string('identifier_normalized', 191).notNullable()
      table.string('provider_subject', 191).nullable()
      table.string('data_region', 16).notNullable()
      table.timestamp('verified_at').nullable()
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
      table.unique(
        ['identity_type', 'identifier_normalized', 'data_region'],
        'uk_identity_type_value_region',
      )
      table.index(['user_id'], 'idx_identity_user')
      table.foreign('user_id', 'fk_identity_user').references('users.id').onDelete('CASCADE')
    })
    await knex.raw(
      'ALTER TABLE user_identities MODIFY COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    )
    await knex.raw(
      `INSERT IGNORE INTO user_identities
        (user_id, identity_type, identifier_normalized, data_region, verified_at)
       SELECT id, 'EMAIL', LOWER(TRIM(email)), data_region,
              CASE WHEN COALESCE(email_verified, 0) = 1 THEN COALESCE(email_verified_at, NOW()) ELSE NULL END
         FROM users
        WHERE email IS NOT NULL AND TRIM(email) <> ''`,
    )
  }

  if (!(await knex.schema.hasTable('guardian_consents'))) {
    await knex.schema.createTable('guardian_consents', table => {
      table.bigIncrements('id').primary()
      table.uuid('consent_id').notNullable().unique('uk_guardian_consent_id')
      table.specificType('child_user_id', userIdType).nullable()
      table.specificType('guardian_user_id', userIdType).nullable()
      table.string('data_region', 16).notNullable()
      table.string('purpose', 64).notNullable()
      table.string('status', 24).notNullable().defaultTo('PENDING')
      table.string('invitation_token_hash', 64).nullable()
      table.string('locale', 16).nullable()
      table.json('evidence_json').nullable()
      table.timestamp('granted_at').nullable()
      table.timestamp('revoked_at').nullable()
      table.timestamp('expires_at').nullable()
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
      table.index(['child_user_id', 'status'], 'idx_guardian_child_status')
      table.index(['guardian_user_id', 'status'], 'idx_guardian_user_status')
      table.foreign('child_user_id', 'fk_guardian_child').references('users.id').onDelete('SET NULL')
      table.foreign('guardian_user_id', 'fk_guardian_user').references('users.id').onDelete('SET NULL')
    })
    await knex.raw(
      'ALTER TABLE guardian_consents MODIFY COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    )
  }

  if (!(await knex.schema.hasTable('account_deletion_requests'))) {
    await knex.schema.createTable('account_deletion_requests', table => {
      table.bigIncrements('id').primary()
      table.uuid('request_id').notNullable().unique('uk_account_deletion_request_id')
      table.specificType('user_id', userIdType).notNullable()
      table.string('data_region', 16).notNullable()
      table.string('status', 24).notNullable().defaultTo('PENDING')
      table.string('confirmation_phrase', 32).notNullable()
      table.json('retention_summary_json').nullable()
      table.timestamp('reauthenticated_at').notNullable()
      table.timestamp('requested_at').notNullable().defaultTo(knex.fn.now())
      table.timestamp('scheduled_for').notNullable()
      table.timestamp('cancelled_at').nullable()
      table.timestamp('completed_at').nullable()
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
      table.index(['user_id', 'status'], 'idx_account_deletion_user_status')
      table.index(['status', 'scheduled_for'], 'idx_account_deletion_due')
      table.foreign('user_id', 'fk_account_deletion_user').references('users.id').onDelete('CASCADE')
    })
    await knex.raw(
      'ALTER TABLE account_deletion_requests MODIFY COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    )
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('account_deletion_requests')
  await knex.schema.dropTableIfExists('guardian_consents')
  await knex.schema.dropTableIfExists('user_identities')

  if (await knex.schema.hasTable(ORGANIZATIONS)) {
    if (await knex.schema.hasColumn(ORGANIZATIONS, 'data_region')) {
      await knex.schema.alterTable(ORGANIZATIONS, table => table.dropColumn('data_region'))
    }
  }

  const columns = [
    'deletion_status',
    'age_band',
    'date_of_birth',
    'account_type',
    'country_code',
    'data_region',
    'public_id',
  ]
  for (const column of columns) {
    if (await knex.schema.hasColumn(USERS, column)) {
      await knex.schema.alterTable(USERS, table => table.dropColumn(column))
    }
  }
}
