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
  const has = await knex.schema.hasTable('unit_menus')
  if (!has) {
    await knex.schema.createTable('unit_menus', t => {
      t.increments('id').unsigned().primary()
      t.integer('unit_id').unsigned().notNullable()
      t.integer('sys_menu_id').notNullable()
      t.integer('parent_sys_id').nullable()
      t.string('name', 100).nullable()
      t.string('title', 200).nullable()
      t.string('path', 255).nullable()
      t.string('component', 255).nullable()
      t.string('icon', 100).nullable()
      t.integer('sort_order').nullable()
      t.boolean('is_hidden').nullable()
      t.boolean('is_disabled').nullable()
      t.enu('menu_type', ['menu', 'button', 'link']).nullable()
      t.string('permission_code', 100).nullable()
      t.string('redirect', 255).nullable()
      t.json('meta').nullable()
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
      t.index(['unit_id'])
      t.index(['sys_menu_id'])
    })
  }
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
