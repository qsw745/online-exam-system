import type { Knex } from 'knex'

const IDX_NAME = 'idx_exams_paper_id'
const FK_NAME  = 'fk_exams_paper_id'

type ColInfo = { DATA_TYPE: string; COLUMN_TYPE: string }

/** 读取 papers.id 的真实类型（int/bigint & 是否 unsigned） */
async function readPapersIdType(knex: Knex): Promise<{ sqlType: 'INT'|'BIGINT'; unsigned: boolean }> {
    const [rows] = await knex.raw<ColInfo[]>(
        `
    SELECT DATA_TYPE, COLUMN_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'papers'
       AND COLUMN_NAME = 'id'
    `
    )
    const info = Array.isArray(rows) ? rows[0] : (rows as any)[0]
    const dataType = String(info?.DATA_TYPE || '').toLowerCase() // 'int' | 'bigint' | ...
    const columnType = String(info?.COLUMN_TYPE || '').toLowerCase() // 'int(11) unsigned' | ...

    const sqlType = dataType.includes('bigint') ? 'BIGINT' : 'INT'
    const unsigned = /unsigned/.test(columnType)
    return { sqlType, unsigned }
}

/** 检查是否存在某个外键（返回其实际名字，便于删除） */
async function findExistingForeignKeyName(knex: Knex, table: string, column: string): Promise<string | null> {
    const [rows] = await knex.raw<any[]>(
        `
    SELECT CONSTRAINT_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
       AND REFERENCED_TABLE_NAME IS NOT NULL
    `,
        [table, column]
    )
    const r = Array.isArray(rows) ? rows[0] : (rows as any)[0]
    return r?.CONSTRAINT_NAME || null
}

/** 检查是否存在某个索引 */
async function hasIndex(knex: Knex, table: string, indexName: string): Promise<boolean> {
    const [rows] = await knex.raw<any[]>(`SHOW INDEX FROM \`${table}\` WHERE Key_name = ?`, [indexName])
    return Array.isArray(rows) && rows.length > 0
}

export async function up(knex: Knex): Promise<void> {
    // 1) 读取 papers.id 类型
    const { sqlType, unsigned } = await readPapersIdType(knex)

    // 2) 如果不存在 paper_id 列，先创建（用正确类型）
    const hasCol = await knex.schema.hasColumn('exams', 'paper_id')
    if (!hasCol) {
        await knex.schema.alterTable('exams', table => {
            const col = sqlType === 'BIGINT' ? table.bigInteger('paper_id') : table.integer('paper_id')
            if (unsigned) col.unsigned()
            col.nullable()
        })
    } else {
        // 已存在则强制修正为与 papers.id 完全一致的类型（含是否 unsigned）
        const typeDDL = `${sqlType}${unsigned ? ' UNSIGNED' : ''} NULL`
        await knex.raw(`ALTER TABLE \`exams\` MODIFY COLUMN \`paper_id\` ${typeDDL}`)
    }

    // 3) 若已存在同名外键/索引，先删除后重建（避免重复）
    const existingFKName = await findExistingForeignKeyName(knex, 'exams', 'paper_id')
    if (existingFKName) {
        await knex.raw(`ALTER TABLE \`exams\` DROP FOREIGN KEY \`${existingFKName}\``)
    }
    if (await hasIndex(knex, 'exams', IDX_NAME)) {
        await knex.raw(`ALTER TABLE \`exams\` DROP INDEX \`${IDX_NAME}\``)
    }

    // 4) 创建索引 + 外键（onUpdate: CASCADE, onDelete: SET NULL）
    await knex.schema.alterTable('exams', table => {
        table.index(['paper_id'], IDX_NAME)
        table
            .foreign('paper_id', FK_NAME)
            .references('id')
            .inTable('papers')
            .onUpdate('CASCADE')
            .onDelete('SET NULL')
    })
}

export async function down(knex: Knex): Promise<void> {
    // 删除外键（若名字不同则自动探测）
    const existingFKName = await findExistingForeignKeyName(knex, 'exams', 'paper_id')
    if (existingFKName) {
        await knex.raw(`ALTER TABLE \`exams\` DROP FOREIGN KEY \`${existingFKName}\``)
    } else {
        // 尝试按我们命名的常量名删除（不报错就行）
        try { await knex.raw(`ALTER TABLE \`exams\` DROP FOREIGN KEY \`${FK_NAME}\``) } catch {}
    }

    // 删除索引
    try { await knex.raw(`ALTER TABLE \`exams\` DROP INDEX \`${IDX_NAME}\``) } catch {}

    // 删除列
    const hasCol = await knex.schema.hasColumn('exams', 'paper_id')
    if (hasCol) {
        await knex.schema.alterTable('exams', table => {
            table.dropColumn('paper_id')
        })
    }
}
