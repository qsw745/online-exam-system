import type { Knex } from 'knex'

/** 根据你的实际表名改这里 */
const RESULT_TABLE = 'exam_results'   // 结果/答题记录表
const EXAM_TABLE   = 'exams'          // 考试/试卷主表
const TASK_EXAMS   = 'task_exams'     // 任务-考试映射表：含 task_id, exam_id
const ASSIGN_TABLE = 'task_assignments' // 可选：任务分配表：含 id, task_id, user_id（如果你的结果表只有 assignment_id，可以借这张表间接回填）

/** 索引/外键名 */
const FK_NAME      = 'fk_exam_results_exam_id'
const IDX_EXAM     = 'idx_exam_results_exam_id'
const IDX_TASKUSER = 'idx_exam_results_task_user'
const UX_TUE       = 'ux_exam_results_task_user_exam'

export async function up(knex: Knex): Promise<void> {
    // --- 基础存在性检查 ---
    await assertTable(knex, RESULT_TABLE)
    await assertTable(knex, EXAM_TABLE)

    // --- 1) 确保 exam_id 字段存在（先用宽松类型，后面再对齐为与 exams.id 完全一致）---
    const hasExamIdCol = await hasColumn(knex, RESULT_TABLE, 'exam_id')
    if (!hasExamIdCol) {
        await knex.schema.alterTable(RESULT_TABLE, (t) => {
            // 先给一个通用类型，稍后根据 EXAM_TABLE.id 的真实类型做 MODIFY 对齐
            t.specificType('exam_id', 'BIGINT NULL').comment('exams.id')
        })
    }

    // --- 2) 对齐 exam_id 类型到与 exams.id 完全一致 ---
    const idCol = await loadColumnMeta(knex, EXAM_TABLE, 'id') // throws if not found

    // 先丢弃旧外键，避免被阻塞
    await dropFkIfExists(knex, RESULT_TABLE, FK_NAME)

    const isString = ['char', 'varchar', 'binary', 'varbinary'].includes(idCol.DATA_TYPE.toLowerCase())
    let modifySql = `ALTER TABLE \`${RESULT_TABLE}\` MODIFY COLUMN \`exam_id\` ${idCol.COLUMN_TYPE} NULL`
    if (isString) {
        if (idCol.CHARACTER_SET_NAME) {
            modifySql += ` CHARACTER SET ${idCol.CHARACTER_SET_NAME}`
        }
        if (idCol.COLLATION_NAME) {
            modifySql += ` COLLATE ${idCol.COLLATION_NAME}`
        }
    }
    await knex.raw(modifySql)

    // --- 3) 创建外键（与 exams.id 对齐后再建）---
    await knex.schema.alterTable(RESULT_TABLE, (t) => {
        t
            .foreign('exam_id', FK_NAME)
            .references('id')
            .inTable(EXAM_TABLE)
            .onUpdate('CASCADE')
            .onDelete('RESTRICT')
    })

    // --- 4) 索引：exam_id 一定建；task_id+user_id 仅在都存在时才建 ---
    await ensureIndex(knex, RESULT_TABLE, IDX_EXAM, ['exam_id'])

    const hasTaskId = await hasColumn(knex, RESULT_TABLE, 'task_id')
    const hasUserId = await hasColumn(knex, RESULT_TABLE, 'user_id')
    if (hasTaskId && hasUserId) {
        await ensureIndex(knex, RESULT_TABLE, IDX_TASKUSER, ['task_id', 'user_id'])
    }

    // --- 5) 回填 exam_id（择优路径）---
    // 路径 A：如果 exam_results 有 task_id，且存在 task_exams，就直接 task_id → exam_id 映射
    if (hasTaskId && await hasTable(knex, TASK_EXAMS)) {
        await knex.raw(
            `
      UPDATE \`${RESULT_TABLE}\` er
      JOIN \`${TASK_EXAMS}\` te ON te.task_id = er.task_id
      SET er.exam_id = te.exam_id
      WHERE er.exam_id IS NULL
      `
        )
    } else {
        // 路径 B（可选）：如果 exam_results 只有 assignment_id，而 task_assignments 能连到 task_id，再连到 task_exams
        const hasAssignId = await hasColumn(knex, RESULT_TABLE, 'assignment_id')
        if (hasAssignId && await hasTable(knex, ASSIGN_TABLE) && await hasTable(knex, TASK_EXAMS)) {
            // UPDATE er JOIN task_assignments ta ON ta.id = er.assignment_id
            //             JOIN task_exams te ON te.task_id = ta.task_id
            // SET er.exam_id = te.exam_id
            // WHERE er.exam_id IS NULL
            await knex.raw(
                `
        UPDATE \`${RESULT_TABLE}\` er
        JOIN \`${ASSIGN_TABLE}\` ta ON ta.id = er.assignment_id
        JOIN \`${TASK_EXAMS}\` te ON te.task_id = ta.task_id
        SET er.exam_id = te.exam_id
        WHERE er.exam_id IS NULL
        `
            )
        }
    }

    // --- 6) 可选唯一约束（仅当你确认 exam_id 已非空、且业务确需去重时再打开）---
    const allNotNull = false
    if (allNotNull && hasTaskId && hasUserId) {
        await dropIndexIfExists(knex, RESULT_TABLE, UX_TUE)
        await knex.schema.alterTable(RESULT_TABLE, (t) => {
            t.unique(['task_id', 'user_id', 'exam_id'], { indexName: UX_TUE })
        })
    }
}

export async function down(knex: Knex): Promise<void> {
    await dropIndexIfExists(knex, RESULT_TABLE, UX_TUE)
    await dropIndexIfExists(knex, RESULT_TABLE, IDX_TASKUSER)
    await dropIndexIfExists(knex, RESULT_TABLE, IDX_EXAM)
    await dropFkIfExists(knex, RESULT_TABLE, FK_NAME)

    if (await hasColumn(knex, RESULT_TABLE, 'exam_id')) {
        await knex.schema.alterTable(RESULT_TABLE, (t) => {
            t.dropColumn('exam_id')
        })
    }
}

/* ---------------- 工具函数 ---------------- */

async function hasTable(knex: Knex, table: string): Promise<boolean> {
    return knex.schema.hasTable(table)
}
async function assertTable(knex: Knex, table: string): Promise<void> {
    if (!(await hasTable(knex, table))) {
        throw new Error(`Table "${table}" not found`)
    }
}
async function hasColumn(knex: Knex, table: string, column: string): Promise<boolean> {
    return knex.schema.hasColumn(table, column)
}
async function loadColumnMeta(knex: Knex, table: string, column: string): Promise<{
    DATA_TYPE: string
    COLUMN_TYPE: string
    CHARACTER_SET_NAME: string | null
    COLLATION_NAME: string | null
}> {
    const [rows] = await knex.raw<any[]>(`
    SELECT DATA_TYPE, COLUMN_TYPE, CHARACTER_SET_NAME, COLLATION_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
    LIMIT 1
  `, [table, column])
    if (!rows || rows.length === 0) {
        throw new Error(`Column "${table}.${column}" not found`)
    }
    return rows[0]
}

async function ensureIndex(
    knex: Knex,
    table: string,
    indexName: string,
    cols: string[]
) {
    // 先确认列都存在，否则直接跳过
    for (const c of cols) {
        if (!(await hasColumn(knex, table, c))) return
    }
    const [rows] = await knex.raw<any[]>(`SHOW INDEX FROM \`${table}\` WHERE Key_name = ?`, [indexName])
    if (!rows || rows.length === 0) {
        await knex.schema.alterTable(table, (t) => {
            t.index(cols as any, indexName)
        })
    }
}

async function dropIndexIfExists(knex: Knex, table: string, indexName: string) {
    const [rows] = await knex.raw<any[]>(`SHOW INDEX FROM \`${table}\` WHERE Key_name = ?`, [indexName])
    if (rows && rows.length > 0) {
        await knex.raw(`DROP INDEX \`${indexName}\` ON \`${table}\``)
    }
}

async function dropFkIfExists(knex: Knex, table: string, fkName: string) {
    const [rows] = await knex.raw<any[]>(`
    SELECT CONSTRAINT_NAME
    FROM information_schema.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND CONSTRAINT_NAME = ?
      AND TABLE_NAME = ?
  `, [fkName, table])
    if (rows && rows.length > 0) {
        await knex.raw(`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${fkName}\``)
    }
}
