import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
    // 为了保证列顺序在 id 之后，这里用 raw（Knex schema 没有跨方言的 after 支持）
    const client = knex.client.config.client?.toString().toLowerCase() || ''
    if (client.includes('mysql')) {
        await knex.raw(`ALTER TABLE roles ADD COLUMN org_id INT NULL AFTER id`)
    } else {
        // 其它方言按常规新增（无 AFTER）
        await knex.schema.alterTable('roles', t => {
            t.integer('org_id').nullable()
        })
    }

    // 组合唯一：同一机构内 name、code 不可重复（org_id 为 NULL 时允许重复，作为“全局角色”）
    await knex.schema.alterTable('roles', t => {
        t.unique(['org_id', 'name'], 'uq_roles_org_name')
        t.unique(['org_id', 'code'], 'uq_roles_org_code')
    })
}

export async function down(knex: Knex): Promise<void> {
    // 先删索引再删列
    const hasTable = await knex.schema.hasTable('roles')
    if (!hasTable) return

    // 部分驱动（如 MySQL）必须原名删除
    await knex.schema.alterTable('roles', t => {
        t.dropUnique(['org_id', 'name'], 'uq_roles_org_name')
        t.dropUnique(['org_id', 'code'], 'uq_roles_org_code')
    })

    const client = knex.client.config.client?.toString().toLowerCase() || ''
    if (client.includes('mysql')) {
        await knex.raw(`ALTER TABLE roles DROP COLUMN org_id`)
    } else {
        await knex.schema.alterTable('roles', t => {
            t.dropColumn('org_id')
        })
    }
}
