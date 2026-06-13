// apps/backend/migrations/20250921_add_task_department_assignments.ts
import type { Knex } from 'knex'

/** 读取当前使用的数据库名 */
async function getDbName(knex: Knex): Promise<string> {
    const cfg: any = knex.client?.config || {}
    const db: string | undefined =
        cfg.connection?.database ?? cfg.connection?.dbname ?? cfg.connection?.db
    if (db) return db
    const [rows] = await knex.raw('SELECT DATABASE() AS db')
    return rows?.[0]?.db
}

/** 判断表是否存在（MySQL大小写敏感取决于系统，统一用 information_schema 判断） */
async function tableExists(knex: Knex, db: string, table: string) {
    const [rows] = await knex.raw(
        `SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1`,
        [db, table]
    )
    return !!rows.length
}

/** 读取主键列的 COLUMN_TYPE（如：'bigint(20) unsigned' / 'int(11)'） */
async function getPkColumnType(knex: Knex, db: string, table: string, column = 'id') {
    const [rows] = await knex.raw(
        `SELECT COLUMN_TYPE, DATA_TYPE, COLUMN_KEY, IS_NULLABLE
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [db, table, column]
    )
    if (!rows.length) {
        throw new Error(`Cannot read column type for ${table}.${column}`)
    }
    // 返回完整的 COLUMN_TYPE 字面量，例如 'bigint(20) unsigned'
    return String(rows[0].COLUMN_TYPE)
}

/** 检查外键是否已存在（按约束名） */
async function fkExists(knex: Knex, db: string, table: string, fkName: string) {
    const [rows] = await knex.raw(
        `SELECT 1
       FROM information_schema.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY'
      LIMIT 1`,
        [db, table, fkName]
    )
    return !!rows.length
}

/** 删除外键（存在才删） */
async function dropFkIfExists(knex: Knex, db: string, table: string, fkName: string) {
    if (await fkExists(knex, db, table, fkName)) {
        await knex.raw(`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${fkName}\``)
    }
}

/** 索引是否存在 */
async function indexExists(knex: Knex, db: string, table: string, indexName: string) {
    const [rows] = await knex.raw(
        `SELECT 1
       FROM information_schema.statistics
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?
      LIMIT 1`,
        [db, table, indexName]
    )
    return !!rows.length
}

export async function up(knex: Knex): Promise<void> {
    const db = await getDbName(knex)

    // 允许组织表叫 organizations 或 orgs（自动检测）
    const orgTable = (await tableExists(knex, db, 'organizations')) ? 'organizations' : 'orgs'

    const tasksPkType = await getPkColumnType(knex, db, 'tasks', 'id')               // e.g. 'bigint(20) unsigned'
    const usersPkType = await getPkColumnType(knex, db, 'users', 'id')               // e.g. 'int(11) unsigned'
    const orgsPkType  = await getPkColumnType(knex, db, orgTable, 'id')              // e.g. 'bigint(20) unsigned'

    const tda = 'task_department_assignments'

    const exists = await tableExists(knex, db, tda)
    if (!exists) {
        // 新建表（不直接加外键，先把列类型做对，再统一加索引与外键）
        await knex.schema.createTable(tda, (t) => {
            // 用 BIGINT UNSIGNED 自增对齐现代习惯（与其他表无FK关系，类型随意）
            t.bigIncrements('id').primary()
            t.specificType('task_id', tasksPkType).notNullable()
            t.specificType('department_id', orgsPkType).notNullable()
            t.specificType('assigned_by', usersPkType).nullable()
            t.timestamp('assigned_at').notNullable().defaultTo(knex.fn.now())

            // 先加唯一约束（MySQL会自动为其创建索引）
            t.unique(['task_id', 'department_id'], `${tda}_uq_task_dept`)
        })
    } else {
        // 已存在：把列类型“修正”为与主表完全一致
        await knex.raw(`
      ALTER TABLE \`${tda}\`
        MODIFY COLUMN \`task_id\` ${tasksPkType} NOT NULL,
        MODIFY COLUMN \`department_id\` ${orgsPkType} NOT NULL,
        MODIFY COLUMN \`assigned_by\` ${usersPkType} NULL
    `)
        // 补充唯一约束
        if (!(await indexExists(knex, db, tda, `${tda}_uq_task_dept`))) {
            // 如果先前以匿名名存在唯一索引，这里会失败；容错处理：尝试忽略错误
            try {
                await knex.raw(`ALTER TABLE \`${tda}\` ADD UNIQUE KEY \`${tda}_uq_task_dept\` (\`task_id\`, \`department_id\`)`)
            } catch {}
        }
    }

    // 索引补齐（即使有唯一，也加普通索引有时可加速 FK 检查；存在就跳过）
    if (!(await indexExists(knex, db, tda, `${tda}_task_id_idx`))) {
        try { await knex.raw(`CREATE INDEX \`${tda}_task_id_idx\` ON \`${tda}\`(\`task_id\`)`) } catch {}
    }
    if (!(await indexExists(knex, db, tda, `${tda}_dept_id_idx`))) {
        try { await knex.raw(`CREATE INDEX \`${tda}_dept_id_idx\` ON \`${tda}\`(\`department_id\`)`) } catch {}
    }
    if (!(await indexExists(knex, db, tda, `${tda}_assigned_by_idx`))) {
        try { await knex.raw(`CREATE INDEX \`${tda}_assigned_by_idx\` ON \`${tda}\`(\`assigned_by\`)`) } catch {}
    }

    // 重新加外键（先删旧的，避免不兼容）
    await knex.raw('SET FOREIGN_KEY_CHECKS = 0')
    await dropFkIfExists(knex, db, tda, `${tda}_task_id_foreign`)
    await dropFkIfExists(knex, db, tda, `${tda}_department_id_foreign`)
    await dropFkIfExists(knex, db, tda, `${tda}_assigned_by_foreign`)

    // 加上三条外键，类型已完全一致，不会再报 incompatible
    await knex.raw(
        `ALTER TABLE \`${tda}\`
       ADD CONSTRAINT \`${tda}_task_id_foreign\`
         FOREIGN KEY (\`task_id\`) REFERENCES \`tasks\`(\`id\`) ON DELETE CASCADE,
       ADD CONSTRAINT \`${tda}_department_id_foreign\`
         FOREIGN KEY (\`department_id\`) REFERENCES \`${orgTable}\`(\`id\`) ON DELETE CASCADE,
       ADD CONSTRAINT \`${tda}_assigned_by_foreign\`
         FOREIGN KEY (\`assigned_by\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL`
    )
    await knex.raw('SET FOREIGN_KEY_CHECKS = 1')
}

export async function down(knex: Knex): Promise<void> {
    const tda = 'task_department_assignments'
    const db = await getDbName(knex)

    // 安全清理：先去外键
    await knex.raw('SET FOREIGN_KEY_CHECKS = 0')
    try {
        await dropFkIfExists(knex, db, tda, `${tda}_task_id_foreign`)
        await dropFkIfExists(knex, db, tda, `${tda}_department_id_foreign`)
        await dropFkIfExists(knex, db, tda, `${tda}_assigned_by_foreign`)
    } catch {}
    await knex.schema.dropTableIfExists(tda)
    await knex.raw('SET FOREIGN_KEY_CHECKS = 1')
}
