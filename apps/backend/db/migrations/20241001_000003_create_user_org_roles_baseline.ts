// apps/backend/db/migrations/20241001_000003_create_user_org_roles_baseline.ts
import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('user_org_roles'))) {
    await knex.schema.createTable('user_org_roles', t => {
      t.increments('id').unsigned().primary()
      t.integer('user_id').unsigned().notNullable()
      t.integer('org_id').unsigned().notNullable()
      t.integer('role_id').unsigned().notNullable()
      t.specificType('sort_order', 'INT').nullable()
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.unique(['user_id', 'org_id', 'role_id'], { indexName: 'uk_user_org_role' })
      t.index(['user_id'], 'idx_uor_user')
      t.index(['org_id'], 'idx_uor_org')
      t.index(['role_id'], 'idx_uor_role')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('user_org_roles')) {
    await knex.schema.dropTable('user_org_roles')
  }
}
