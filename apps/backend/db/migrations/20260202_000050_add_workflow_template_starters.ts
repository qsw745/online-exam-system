import type { Knex } from 'knex'

const TABLE = 'workflow_templates'

export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable(TABLE)) {
    const hasStarterRoles = await knex.schema.hasColumn(TABLE, 'starter_roles')
    if (!hasStarterRoles) {
      await knex.schema.alterTable(TABLE, t => {
        t.text('starter_roles', 'mediumtext').nullable().comment('流程可发起角色 id 列表（JSON 数组）')
      })
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable(TABLE)) {
    const hasStarterRoles = await knex.schema.hasColumn(TABLE, 'starter_roles')
    if (hasStarterRoles) {
      await knex.schema.alterTable(TABLE, t => {
        t.dropColumn('starter_roles')
      })
    }
  }
}
