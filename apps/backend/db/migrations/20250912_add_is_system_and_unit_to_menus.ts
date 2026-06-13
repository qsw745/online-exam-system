import type { Knex } from 'knex'

const TABLE = 'menus'

export async function up(knex: Knex): Promise<void> {
    // is_system
    const hasIsSystem = await knex.schema.hasColumn(TABLE, 'is_system')
    if (!hasIsSystem) {
        await knex.schema.alterTable(TABLE, t => {
            // MySQL 下 boolean -> TINYINT(1)
            t.boolean('is_system').notNullable().defaultTo(0).comment('是否系统菜单：1=系统，0=单位')
        })
    }

    // unit_id
    const hasUnitId = await knex.schema.hasColumn(TABLE, 'unit_id')
    if (!hasUnitId) {
        await knex.schema.alterTable(TABLE, t => {
            t.integer('unit_id').nullable().comment('单位ID（多租户/院系隔离预留）').index()
        })
    }

    // 统一把现有数据置为单位菜单（0）
    // 让启动期同步脚本再把种子菜单“正名”为 is_system=1
    await knex(TABLE).update({ is_system: 0 })

    // 索引（存在就忽略）
    try {
        await knex.schema.alterTable(TABLE, t => {
            t.index(['is_system'], `${TABLE}_is_system_idx`)
        })
    } catch (_) {}
    try {
        await knex.schema.alterTable(TABLE, t => {
            t.index(['unit_id', 'is_system'], `${TABLE}_unit_is_system_idx`)
        })
    } catch (_) {}
}

export async function down(knex: Knex): Promise<void> {
    // 回滚时安全检查后再 drop
    const hasUnitId = await knex.schema.hasColumn(TABLE, 'unit_id')
    if (hasUnitId) {
        await knex.schema.alterTable(TABLE, t => {
            t.dropColumn('unit_id')
        })
    }

    const hasIsSystem = await knex.schema.hasColumn(TABLE, 'is_system')
    if (hasIsSystem) {
        await knex.schema.alterTable(TABLE, t => {
            t.dropColumn('is_system')
        })
    }
}
