import type { Knex } from 'knex'

type ShowIndexRow = {
  Key_name: string
  Non_unique: number
  Column_name: string
}

async function uniqueCodeIndexes(knex: Knex): Promise<Set<string>> {
  const rows: any = await knex.raw('SHOW INDEX FROM `roles`')
  const indices: Set<string> = new Set()
  const list = Array.isArray(rows)
    ? Array.isArray(rows[0])
      ? (rows[0] as ShowIndexRow[])
      : (rows as ShowIndexRow[])
    : []
  for (const r of list) {
    const col = String((r as any)?.Column_name || '').toLowerCase()
    const key = String((r as any)?.Key_name || '')
    const nonUnique = Number((r as any)?.Non_unique ?? 0)
    if (!key) continue
    if (nonUnique !== 0) continue
    if (col.includes('code')) indices.add(key)
  }
  return indices
}

export async function up(knex: Knex): Promise<void> {
  const indices = await uniqueCodeIndexes(knex)
  for (const name of indices) {
    await knex.schema.raw(`ALTER TABLE \`roles\` DROP INDEX \`${name}\``)
  }
  const hasIdx =
    (await uniqueCodeIndexes(knex)).has('idx_roles_code') ||
    (await knex
      .raw('SHOW INDEX FROM `roles` WHERE Key_name = ?', ['idx_roles_code'])
      .then((r: any) => {
        if (Array.isArray(r)) {
          if (Array.isArray(r[0])) return r[0].length > 0
          return r.length > 0
        }
        return false
      })
      .catch(() => false))
  if (!hasIdx) {
    await knex.schema.raw('CREATE INDEX `idx_roles_code` ON `roles` (`code`)').catch(() => {})
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasIdx = await knex
    .raw('SHOW INDEX FROM `roles` WHERE Key_name = ?', ['idx_roles_code'])
    .then((r: any) => {
      if (Array.isArray(r)) {
        if (Array.isArray(r[0])) return r[0].length > 0
        return r.length > 0
      }
      return false
    })
    .catch(() => false)
  if (hasIdx) {
    await knex.schema.raw('ALTER TABLE `roles` DROP INDEX `idx_roles_code`').catch(() => {})
  }
}
