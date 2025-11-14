import type { Knex } from 'knex'

async function indexExists(knex: Knex, table: string, indexName: string): Promise<boolean> {
  const rows: any = await knex.raw(`SHOW INDEX FROM \`${table}\` WHERE Key_name = ?`, [indexName])
  if (Array.isArray(rows)) {
    if (Array.isArray(rows[0])) return rows[0].length > 0
    return rows.length > 0
  }
  return false
}

async function dropIndexIfExists(knex: Knex, table: string, indexName: string) {
  if (await indexExists(knex, table, indexName)) {
    await knex.schema.raw(`ALTER TABLE \`${table}\` DROP INDEX \`${indexName}\``)
  }
}

async function createIndexIfMissing(knex: Knex, table: string, indexName: string, definition: string) {
  if (!(await indexExists(knex, table, indexName))) {
    await knex.schema.raw(`CREATE INDEX \`${indexName}\` ON \`${table}\` ${definition}`)
  }
}

export async function up(knex: Knex): Promise<void> {
  const table = 'roles'
  const uniques = [
    'roles_code_unique',
    'uk_code',
    'uk_org_code',
    'uk_roles_org_code_lower',
    'uk_roles_org_code',
  ]
  for (const name of uniques) {
    await dropIndexIfExists(knex, table, name)
  }

  await createIndexIfMissing(knex, table, 'idx_roles_code', '(`code`)')
}

export async function down(knex: Knex): Promise<void> {
  const table = 'roles'

  await dropIndexIfExists(knex, table, 'idx_roles_code')

  if (!(await indexExists(knex, table, 'uk_code'))) {
    await knex.schema.raw(`CREATE UNIQUE INDEX \`uk_code\` ON \`${table}\` (\`code\`)`)
  }
}

