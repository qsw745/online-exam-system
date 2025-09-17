// migrations/20250917_ensure_practice_wrong_tables.ts
import type { Knex } from 'knex'

async function ensureTable_practice_records(knex: Knex) {
    const hasTable = await knex.schema.hasTable('practice_records')
    if (!hasTable) {
        await knex.schema.createTable('practice_records', (t) => {
            t.increments('id').primary()
            t.integer('user_id').unsigned().notNullable().index()
            t.integer('question_id').unsigned().notNullable().index()
            // MySQL 5.7+ 支持 JSON；如需兼容更低版本可改成 .text('user_answer', 'longtext')
            t.boolean('is_correct').notNullable().index()
            t.json('user_answer').nullable()
            t.timestamp('created_at').notNullable().defaultTo(knex.fn.now()).index()
            // 可选外键（如果启用了外键约束）：请按你实际的表名/键名开启
            // t.foreign('question_id').references('questions.id').onDelete('CASCADE')
            // t.foreign('user_id').references('users.id').onDelete('CASCADE')
            t.index(['user_id', 'question_id'], 'idx_pr_user_qid')
            t.index(['user_id', 'is_correct'], 'idx_pr_user_correct')
        })
    } else {
        // 增补缺失的列
        if (!(await knex.schema.hasColumn('practice_records', 'user_id'))) {
            await knex.schema.alterTable('practice_records', (t) => {
                t.integer('user_id').unsigned().notNullable().index()
            })
        }
        if (!(await knex.schema.hasColumn('practice_records', 'question_id'))) {
            await knex.schema.alterTable('practice_records', (t) => {
                t.integer('question_id').unsigned().notNullable().index()
            })
        }
        if (!(await knex.schema.hasColumn('practice_records', 'is_correct'))) {
            await knex.schema.alterTable('practice_records', (t) => {
                t.boolean('is_correct').notNullable().defaultTo(false).index()
            })
        }
        if (!(await knex.schema.hasColumn('practice_records', 'user_answer'))) {
            await knex.schema.alterTable('practice_records', (t) => {
                t.json('user_answer').nullable()
            })
        }
        if (!(await knex.schema.hasColumn('practice_records', 'created_at'))) {
            await knex.schema.alterTable('practice_records', (t) => {
                t.timestamp('created_at').notNullable().defaultTo(knex.fn.now()).index()
            })
        }
        // 兜底索引
        const addIndex = async (name: string, cols: string[]) => {
            // MySQL 下缺少 “hasIndex”，简单 try/catch 防重复
            try { await knex.schema.alterTable('practice_records', (t) => t.index(cols, name)) } catch {}
        }
        await addIndex('idx_pr_user_qid', ['user_id', 'question_id'])
        await addIndex('idx_pr_user_correct', ['user_id', 'is_correct'])
    }
}

async function ensureTable_wrong_questions(knex: Knex) {
    const hasTable = await knex.schema.hasTable('wrong_questions')
    if (!hasTable) {
        await knex.schema.createTable('wrong_questions', (t) => {
            t.increments('id').primary()
            t.integer('user_id').unsigned().notNullable().index()
            t.integer('question_id').unsigned().notNullable().index()
            t.integer('wrong_count').notNullable().defaultTo(0)
            t.integer('correct_count').notNullable().defaultTo(0)
            t.boolean('is_mastered').notNullable().defaultTo(false).index()
            t.timestamp('last_practice_time').nullable().index()
            t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
            // 约束/索引
            t.unique(['user_id', 'question_id'], { indexName: 'uq_wrong_user_qid' })
            t.index(['user_id', 'is_mastered'], 'idx_wrong_user_mastered')
            t.index(['user_id', 'last_practice_time'], 'idx_wrong_user_last_time')
            // 可选外键
            // t.foreign('question_id').references('questions.id').onDelete('CASCADE')
            // t.foreign('user_id').references('users.id').onDelete('CASCADE')
        })
    } else {
        if (!(await knex.schema.hasColumn('wrong_questions', 'user_id'))) {
            await knex.schema.alterTable('wrong_questions', (t) => {
                t.integer('user_id').unsigned().notNullable().index()
            })
        }
        if (!(await knex.schema.hasColumn('wrong_questions', 'question_id'))) {
            await knex.schema.alterTable('wrong_questions', (t) => {
                t.integer('question_id').unsigned().notNullable().index()
            })
        }
        if (!(await knex.schema.hasColumn('wrong_questions', 'wrong_count'))) {
            await knex.schema.alterTable('wrong_questions', (t) => {
                t.integer('wrong_count').notNullable().defaultTo(0)
            })
        }
        if (!(await knex.schema.hasColumn('wrong_questions', 'correct_count'))) {
            await knex.schema.alterTable('wrong_questions', (t) => {
                t.integer('correct_count').notNullable().defaultTo(0)
            })
        }
        if (!(await knex.schema.hasColumn('wrong_questions', 'is_mastered'))) {
            await knex.schema.alterTable('wrong_questions', (t) => {
                t.boolean('is_mastered').notNullable().defaultTo(false).index()
            })
        }
        if (!(await knex.schema.hasColumn('wrong_questions', 'last_practice_time'))) {
            await knex.schema.alterTable('wrong_questions', (t) => {
                t.timestamp('last_practice_time').nullable().index()
            })
        }
        // 兜底唯一键 & 索引
        const addIndex = async (name: string, cols: string[], unique = false) => {
            try {
                await knex.schema.alterTable('wrong_questions', (t) => {
                    unique ? t.unique(cols, { indexName: name }) : t.index(cols, name)
                })
            } catch {}
        }
        await addIndex('uq_wrong_user_qid', ['user_id', 'question_id'], true)
        await addIndex('idx_wrong_user_mastered', ['user_id', 'is_mastered'])
        await addIndex('idx_wrong_user_last_time', ['user_id', 'last_practice_time'])
    }
}

export async function up(knex: Knex): Promise<void> {
    await ensureTable_practice_records(knex)
    await ensureTable_wrong_questions(knex)
}

export async function down(knex: Knex): Promise<void> {
    // 回滚策略：只在本迁移“创建”的表才直接 drop；如果表原本就存在，只尝试移除我们新增的索引/列
    const hasPR = await knex.schema.hasTable('practice_records')
    if (hasPR) {
        // 尝试移除索引（忽略失败）
        try { await knex.schema.alterTable('practice_records', (t) => { t.dropIndex(['user_id', 'question_id'], 'idx_pr_user_qid') }) } catch {}
        try { await knex.schema.alterTable('practice_records', (t) => { t.dropIndex(['user_id', 'is_correct'], 'idx_pr_user_correct') }) } catch {}
        // 不主动删列，避免影响历史数据；如必须彻底回滚，可在此 dropColumn
    }
    const hasWQ = await knex.schema.hasTable('wrong_questions')
    if (hasWQ) {
        try { await knex.schema.alterTable('wrong_questions', (t) => { t.dropUnique(['user_id', 'question_id'], 'uq_wrong_user_qid') }) } catch {}
        try { await knex.schema.alterTable('wrong_questions', (t) => { t.dropIndex(['user_id', 'is_mastered'], 'idx_wrong_user_mastered') }) } catch {}
        try { await knex.schema.alterTable('wrong_questions', (t) => { t.dropIndex(['user_id', 'last_practice_time'], 'idx_wrong_user_last_time') }) } catch {}
    }
    // 若你希望彻底删除表（仅限开发/测试环境），放开下面两行：
    // await knex.schema.dropTableIfExists('practice_records')
    // await knex.schema.dropTableIfExists('wrong_questions')
}
