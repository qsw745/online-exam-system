// apps/backend/src/database/migrations/20240912_create_unit_menus.ts
import type { Knex } from 'knex';

// 重要：关闭事务，避免 "Transaction was implicitly committed..."
export const config = { transaction: false };

async function getIdColumnInfo(knex: Knex, table: string) {
    const [rows] = await knex.raw(
        `SELECT DATA_TYPE, COLUMN_TYPE
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME=? AND COLUMN_NAME='id'`,
        [table]
    );
    const r = (rows as any)?.[0] || {};
    const dataType = String(r.DATA_TYPE || 'int').toLowerCase();       // e.g. 'int' | 'bigint'
    const columnType = String(r.COLUMN_TYPE || '').toLowerCase();      // e.g. 'int unsigned'
    const isBig = dataType.includes('bigint');
    const isUnsigned = columnType.includes('unsigned');
    return { isBig, isUnsigned };
}

export async function up(knex: Knex): Promise<void> {
    // 探测 menus.id
    const menusId = await getIdColumnInfo(knex, 'menus');

    // 探测组织表名与 id 类型（存在 organizations 或 orgs 任一）
    const [orgTblRows] = await knex.raw(
        `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('organizations','orgs') LIMIT 1`
    );
    const orgTable: string | null = (orgTblRows as any)?.[0]?.TABLE_NAME || null;
    const orgId = orgTable ? await getIdColumnInfo(knex, orgTable) : null;

    await knex.schema.createTable('unit_menus', (t) => {
        // 主键
        t.increments('id').primary();

        // 设置引擎/字符集（可选）
        // @ts-ignore
        if ((t as any).engine) (t as any).engine('InnoDB');
        // @ts-ignore
        if ((t as any).charset) (t as any).charset('utf8mb4');

        // unit_id —— 尽量跟 organizations/orgs.id 保持一致；若未知默认用 int unsigned
        let unitIdCol = orgId?.isBig ? t.bigInteger('unit_id') : t.integer('unit_id');
        if (orgId?.isUnsigned ?? true) unitIdCol = unitIdCol.unsigned();
        unitIdCol.notNullable().index('idx_unit');

        // sys_menu_id / parent_sys_id —— 必须跟 menus.id 完全一致
        let sysIdCol = menusId.isBig ? t.bigInteger('sys_menu_id') : t.integer('sys_menu_id');
        if (menusId.isUnsigned) sysIdCol = sysIdCol.unsigned();
        sysIdCol.notNullable().index('idx_sys_menu');

        let parentSysIdCol = menusId.isBig ? t.bigInteger('parent_sys_id') : t.integer('parent_sys_id');
        if (menusId.isUnsigned) parentSysIdCol = parentSysIdCol.unsigned();
        parentSysIdCol.nullable().index('idx_parent_sys');

        // 其余字段
        t.string('name', 100).nullable();
        t.string('title', 200).nullable();
        t.string('path', 255).nullable();
        t.string('component', 255).nullable();
        t.string('icon', 100).nullable();
        t.integer('sort_order').nullable();
        t.boolean('is_hidden').nullable();
        t.boolean('is_disabled').nullable();
        t.enu('menu_type', ['menu', 'button', 'link']).nullable();
        t.string('permission_code', 100).nullable();
        t.string('redirect', 255).nullable();
        // JSON（MySQL 5.7+），低版本可改成 text
        // @ts-ignore
        if ((t as any).json) (t as any).json('meta').nullable();
        else t.specificType('meta', 'json').nullable();

        t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

        t.unique(['unit_id', 'sys_menu_id'], 'uk_unit_sys');
    });

    // updated_at 自动更新时间（触发器可选）
    await knex.schema
        .raw(`
      CREATE TRIGGER unit_menus_updated_at
      BEFORE UPDATE ON unit_menus
      FOR EACH ROW SET NEW.updated_at = CURRENT_TIMESTAMP
    `)
        .catch(() => { /* 已存在则忽略 */ });

    // 外键分步加，确保兼容
    await knex.schema.alterTable('unit_menus', (t) => {
        t
            .foreign('sys_menu_id', 'unit_menus_sys_menu_id_fk')
            .references('id')
            .inTable('menus')
            .onDelete('CASCADE');

        t
            .foreign('parent_sys_id', 'unit_menus_parent_sys_id_fk')
            .references('id')
            .inTable('menus')
            .onDelete('SET NULL');

        if (orgTable) {
            t
                .foreign('unit_id', 'unit_menus_unit_id_fk')
                .references('id')
                .inTable(orgTable)
                .onDelete('CASCADE');
        }
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema
        .alterTable('unit_menus', (t) => {
            t.dropForeign(['sys_menu_id'], 'unit_menus_sys_menu_id_fk');
            t.dropForeign(['parent_sys_id'], 'unit_menus_parent_sys_id_fk');
            t.dropForeign(['unit_id'], 'unit_menus_unit_id_fk');
        })
        .catch(() => {});
    await knex.schema.raw('DROP TRIGGER IF EXISTS unit_menus_updated_at').catch(() => {});
    await knex.schema.dropTableIfExists('unit_menus');
}
