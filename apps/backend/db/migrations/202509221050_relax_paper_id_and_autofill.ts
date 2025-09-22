import type { Knex } from 'knex'

/** 按实际表名修改 */
const RESULT_TABLE = 'exam_results'
const EXAM_TABLE   = 'exams'
const TASK_EXAMS   = 'task_exams'         // 可选：task_id → exam_id
const ASSIGN_TABLE = 'task_assignments'   // 可选：assignment_id → task_id（若你的 exam_results 只有 assignment_id）

/** 触发器名 */
const TRG_BI = 'trg_exam_results_bi_autofill_paper'
const TRG_BU = 'trg_exam_results_bu_autofill_paper'

export async function up(knex: Knex): Promise<void> {
    // 1) 基础存在性检查
    await assertTable(knex, RESULT_TABLE)
    await assertTable(knex, EXAM_TABLE)

    // 2) 若存在 paper_id 列，则放宽为 NULL DEFAULT NULL
    const hasPaperId = await hasColumn(knex, RESULT_TABLE, 'paper_id')
    if (hasPaperId) {
        // 判断当前是否 NOT NULL，无默认值
        const meta = await loadColumnMeta(knex, RESULT_TABLE, 'paper_id')
        const isString = ['char', 'varchar', 'binary', 'varbinary'].includes(meta.DATA_TYPE.toLowerCase())

        // 统一放宽为可空
        let alterSql = `ALTER TABLE \`${RESULT_TABLE}\` MODIFY COLUMN \`paper_id\` ${meta.COLUMN_TYPE} NULL DEFAULT NULL`
        if (isString) {
            if (meta.CHARACTER_SET_NAME) alterSql += ` CHARACTER SET ${meta.CHARACTER_SET_NAME}`
            if (meta.COLLATION_NAME) alterSql += ` COLLATE ${meta.COLLATION_NAME}`
        }
        await knex.raw(alterSql)
    }

    // 3) 若存在 exam_id，则尝试回填 paper_id（通过 exam_id → exams.paper_id）
    const hasExamId = await hasColumn(knex, RESULT_TABLE, 'exam_id')
    if (hasExamId && hasPaperId) {
        await knex.raw(
            `
      UPDATE \`${RESULT_TABLE}\` er
      JOIN \`${EXAM_TABLE}\` e ON e.id = er.exam_id
      SET er.paper_id = e.paper_id
      WHERE er.exam_id IS NOT NULL
        AND (er.paper_id IS NULL OR er.paper_id = 0)
      `
        )
    }

    // 4) 若 exam_id 为空但存在 task 关系，也尝试补齐 exam_id 再补 paper_id
    const hasTaskId = await hasColumn(knex, RESULT_TABLE, 'task_id')
    const hasAssignId = await hasColumn(knex, RESULT_TABLE, 'assignment_id')
    const hasTaskExams = await hasTable(knex, TASK_EXAMS)

    if (hasTaskExams) {
        if (hasExamId && hasTaskId) {
            // 4A) 通过 task_id → task_exams 回填 exam_id
            await knex.raw(
                `
        UPDATE \`${RESULT_TABLE}\` er
        JOIN \`${TASK_EXAMS}\` te ON te.task_id = er.task_id
        SET er.exam_id = COALESCE(er.exam_id, te.exam_id)
        WHERE er.exam_id IS NULL
        `
            )
            // 再次通过 exam_id 回填 paper_id
            if (hasPaperId) {
                await knex.raw(
                    `
          UPDATE \`${RESULT_TABLE}\` er
          JOIN \`${EXAM_TABLE}\` e ON e.id = er.exam_id
          SET er.paper_id = COALESCE(er.paper_id, e.paper_id)
          WHERE er.exam_id IS NOT NULL
            AND (er.paper_id IS NULL OR er.paper_id = 0)
          `
                )
            }
        } else if (hasAssignId && hasExamId) {
            // 4B) 通过 assignment_id → task_assignments → task_exams 回填
            if (await hasTable(knex, ASSIGN_TABLE)) {
                await knex.raw(
                    `
          UPDATE \`${RESULT_TABLE}\` er
          JOIN \`${ASSIGN_TABLE}\` ta ON ta.id = er.assignment_id
          JOIN \`${TASK_EXAMS}\` te ON te.task_id = ta.task_id
          SET er.exam_id = COALESCE(er.exam_id, te.exam_id)
          WHERE er.exam_id IS NULL
          `
                )
                if (hasPaperId) {
                    await knex.raw(
                        `
            UPDATE \`${RESULT_TABLE}\` er
            JOIN \`${EXAM_TABLE}\` e ON e.id = er.exam_id
            SET er.paper_id = COALESCE(er.paper_id, e.paper_id)
            WHERE er.exam_id IS NOT NULL
              AND (er.paper_id IS NULL OR er.paper_id = 0)
            `
                    )
                }
            }
        }
    }

    // 5) 建立触发器：以后插入/更新 exam_results，如果 exam_id 非空且 paper_id 为空，则自动填充 paper_id
    if (hasPaperId && hasExamId) {
        await dropTriggerIfExists(knex, TRG_BI)
        await dropTriggerIfExists(knex, TRG_BU)

        await knex.raw(`
      CREATE TRIGGER \`${TRG_BI}\`
      BEFORE INSERT ON \`${RESULT_TABLE}\`
      FOR EACH ROW
      BEGIN
        IF NEW.exam_id IS NOT NULL AND (NEW.paper_id IS NULL OR NEW.paper_id = 0) THEN
          SET NEW.paper_id = (
            SELECT e.paper_id FROM \`${EXAM_TABLE}\` e WHERE e.id = NEW.exam_id LIMIT 1
          );
        END IF;
      END
    `)

        await knex.raw(`
      CREATE TRIGGER \`${TRG_BU}\`
      BEFORE UPDATE ON \`${RESULT_TABLE}\`
      FOR EACH ROW
      BEGIN
        IF NEW.exam_id IS NOT NULL AND (NEW.paper_id IS NULL OR NEW.paper_id = 0) THEN
          SET NEW.paper_id = (
            SELECT e.paper_id FROM \`${EXAM_TABLE}\` e WHERE e.id = NEW.exam_id LIMIT 1
          );
        END IF;
      END
    `)
    }
}

export async function down(knex: Knex): Promise<void> {
    // 回滚：删除触发器；不强行把 paper_id 改回 NOT NULL（以免再度引发线上写入失败）
    await dropTriggerIfExists(knex, TRG_BI)
    await dropTriggerIfExists(knex, TRG_BU)
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

async function dropTriggerIfExists(knex: Knex, trgName: string): Promise<void> {
    await knex.raw(`DROP TRIGGER IF EXISTS \`${trgName}\``)
}
