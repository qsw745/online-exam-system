import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
    // helpers ---------------
    const addIndexIfMissing = async (table: string, key: string, cols: string[]) => {
        const [rows] = await knex.raw('SHOW INDEX FROM ?? WHERE Key_name = ?', [table, key])
        if (!rows || rows.length === 0) await knex.schema.alterTable(table, t => t.index(cols, key))
    }

    const dropFksForColumn = async (table: string, column: string) => {
        const [fks] = await knex.raw(
            `
      SELECT CONSTRAINT_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `,
            [table, column]
        )
        for (const r of (fks as any[]) || []) {
            await knex.raw('ALTER TABLE ?? DROP FOREIGN KEY ??', [table, r.CONSTRAINT_NAME])
        }
    }

    const dropIndexesForColumn = async (table: string, column: string) => {
        const [idx] = await knex.raw('SHOW INDEX FROM ?? WHERE Column_name = ?', [table, column])
        const names = [...new Set(((idx as any[]) || []).map(r => r.Key_name).filter((n: string) => n !== 'PRIMARY'))]
        for (const name of names) {
            await knex.raw('ALTER TABLE ?? DROP INDEX ??', [table, name])
        }
    }

    const dropColumnSafely = async (table: string, column: string) => {
        if (!(await knex.schema.hasColumn(table, column))) return
        await dropFksForColumn(table, column)
        await dropIndexesForColumn(table, column)
        await knex.schema.alterTable(table, t => t.dropColumn(column))
    }
    // ------------------------

    // 1) questions：常用索引 + content 的全文/回退前缀索引
    if (await knex.schema.hasTable('questions')) {
        await addIndexIfMissing('questions', 'idx_questions_type', ['question_type'])
        await addIndexIfMissing('questions', 'idx_questions_difficulty', ['difficulty'])
        try {
            const [r] = await knex.raw("SHOW INDEX FROM ?? WHERE Key_name='ft_questions_title_content'", ['questions'])
            if (!r || r.length === 0) {
                await knex.raw('ALTER TABLE ?? ADD FULLTEXT `ft_questions_title_content` (`title`,`content`)', ['questions'])
            }
        } catch {
            const [r2] = await knex.raw("SHOW INDEX FROM ?? WHERE Key_name='idx_questions_content_prefix'", ['questions'])
            if (!r2 || r2.length === 0) {
                await knex.raw('ALTER TABLE ?? ADD INDEX `idx_questions_content_prefix` (`content`(191))', ['questions'])
            }
        }
    }

    // 2) wrong_question_books
    if (!(await knex.schema.hasTable('wrong_question_books'))) {
        await knex.schema.createTable('wrong_question_books', t => {
            t.increments('id').primary()
            t.integer('user_id').notNullable().index()
            t.string('name', 100).notNullable()
            t.text('description').defaultTo('')
            t.boolean('is_default').notNullable().defaultTo(false).index()
            t.boolean('is_public').notNullable().defaultTo(false)
            t.timestamp('created_at').defaultTo(knex.fn.now())
            t.timestamp('updated_at').defaultTo(knex.fn.now())
        })
    } else {
        if (!(await knex.schema.hasColumn('wrong_question_books', 'is_default'))) {
            await knex.schema.alterTable('wrong_question_books', t => t.boolean('is_default').notNullable().defaultTo(false).index())
        }
        if (!(await knex.schema.hasColumn('wrong_question_books', 'is_public'))) {
            await knex.schema.alterTable('wrong_question_books', t => t.boolean('is_public').notNullable().defaultTo(false))
        }
    }

    // 3) wrong_questions：补齐新列
    if (!(await knex.schema.hasTable('wrong_questions'))) {
        await knex.schema.createTable('wrong_questions', t => {
            t.increments('id').primary()
            t.integer('book_id').nullable().index()
            t.integer('question_id').notNullable().index()
            t.integer('exam_result_id').nullable().index()
            t.integer('wrong_count').notNullable().defaultTo(0)
            t.timestamp('last_wrong_time').nullable().index()
            t
                .enum('mastery_level', ['not_mastered', 'partially_mastered', 'mastered'])
                .notNullable()
                .defaultTo('not_mastered')
                .index()
            t.text('tags').defaultTo('')
            t.text('notes').defaultTo('')
            t.timestamp('created_at').defaultTo(knex.fn.now())
            t.timestamp('updated_at').defaultTo(knex.fn.now())
        })
    } else {
        const ensure = async (col: string, cb: (t: Knex.TableBuilder) => any) => {
            if (!(await knex.schema.hasColumn('wrong_questions', col))) {
                await knex.schema.alterTable('wrong_questions', cb)
            }
        }
        await ensure('book_id', t => t.integer('book_id').nullable().index())
        await ensure('exam_result_id', t => t.integer('exam_result_id').nullable().index())
        await ensure('last_wrong_time', t => t.timestamp('last_wrong_time').nullable().index())
        await ensure('mastery_level', t =>
            t.enum('mastery_level', ['not_mastered', 'partially_mastered', 'mastered']).notNullable().defaultTo('not_mastered').index()
        )
        await ensure('tags', t => t.text('tags').defaultTo(''))
        await ensure('notes', t => t.text('notes').defaultTo(''))
    }

    // 4) wrong_question_practice_records
    if (!(await knex.schema.hasTable('wrong_question_practice_records'))) {
        await knex.schema.createTable('wrong_question_practice_records', t => {
            t.increments('id').primary()
            t.integer('user_id').notNullable().index()
            t.integer('wrong_question_id').notNullable().index()
            t.boolean('is_correct').notNullable().defaultTo(false).index()
            t.integer('time_spent').notNullable().defaultTo(0)
            t.timestamp('practice_time').notNullable().defaultTo(knex.fn.now()).index()
            t.timestamp('created_at').defaultTo(knex.fn.now())
        })
    } else {
        if (!(await knex.schema.hasColumn('wrong_question_practice_records', 'time_spent'))) {
            await knex.schema.alterTable('wrong_question_practice_records', t => t.integer('time_spent').notNullable().defaultTo(0))
        }
        if (!(await knex.schema.hasColumn('wrong_question_practice_records', 'practice_time'))) {
            await knex.schema.alterTable('wrong_question_practice_records', t =>
                t.timestamp('practice_time').notNullable().defaultTo(knex.fn.now()).index()
            )
        }
    }

    // 5) wrong_question_book_shares
    if (!(await knex.schema.hasTable('wrong_question_book_shares'))) {
        await knex.schema.createTable('wrong_question_book_shares', t => {
            t.increments('id').primary()
            t.integer('book_id').notNullable().index()
            t.integer('shared_by').notNullable().index()
            t.integer('shared_to').nullable().index()
            t.string('share_code', 32).notNullable().unique()
            t.boolean('is_public').notNullable().defaultTo(false).index()
            t.timestamp('expires_at').nullable().index()
            t.integer('access_count').notNullable().defaultTo(0)
            t.timestamp('created_at').defaultTo(knex.fn.now())
            t.timestamp('updated_at').defaultTo(knex.fn.now())
        })
    } else {
        if (!(await knex.schema.hasColumn('wrong_question_book_shares', 'share_code'))) {
            await knex.schema.alterTable('wrong_question_book_shares', t => t.string('share_code', 32).notNullable().unique())
        }
    }

    // 6) 迁移旧数据（原地 UPDATE）
    if (await knex.schema.hasColumn('wrong_questions', 'user_id')) {
        const users: Array<{ user_id: number }> = await knex('wrong_questions')
            .distinct('user_id')
            .whereNotNull('user_id')

        for (const { user_id } of users) {
            let book = await knex('wrong_question_books').select('id').where({ user_id, is_default: 1 }).first()
            if (!book) {
                const inserted = await knex('wrong_question_books').insert({
                    user_id,
                    name: '我的错题本',
                    description: '由迁移自动创建',
                    is_default: 1,
                    is_public: 0,
                })
                book = { id: Array.isArray(inserted) ? (inserted[0] as number) : (inserted as unknown as number) }
            }

            const rows: any[] = await knex('wrong_questions')
                .select('*')
                .where({ user_id })
                .andWhere(function () {
                    this.whereNull('book_id').orWhere('book_id', 0)
                })

            for (const r of rows) {
                const mastery =
                    Number(r.is_mastered) === 1
                        ? 'mastered'
                        : Number(r.correct_count || 0) >= 3
                            ? 'partially_mastered'
                            : 'not_mastered'
                const lastWrong = r.last_practice_time || r.first_wrong_time || null

                await knex('wrong_questions').where({ id: r.id }).update({
                    book_id: (book as any).id,
                    exam_result_id: null,
                    wrong_count: r.wrong_count || 0,
                    last_wrong_time: lastWrong,
                    mastery_level: mastery,
                    tags: r.tags ?? '',
                    notes: r.notes ?? '',
                    updated_at: knex.fn.now(),
                })
            }
        }

        // 6.1) 删除旧列前，先删外键和索引
        await dropColumnSafely('wrong_questions', 'user_id')
        await dropColumnSafely('wrong_questions', 'first_wrong_time')
        await dropColumnSafely('wrong_questions', 'last_practice_time')
        await dropColumnSafely('wrong_questions', 'correct_count')
        await dropColumnSafely('wrong_questions', 'is_mastered')
    }

    // 7) 创建唯一键
    try {
        const [idx] = await knex.raw("SHOW INDEX FROM ?? WHERE Key_name='uk_wq_book_question'", ['wrong_questions'])
        if (!idx || idx.length === 0) {
            await knex.schema.alterTable('wrong_questions', t => t.unique(['book_id', 'question_id'], 'uk_wq_book_question'))
        }
    } catch {}
}

export async function down(knex: Knex): Promise<void> {
    const drop = async (t: string) => {
        if (await knex.schema.hasTable(t)) await knex.schema.dropTable(t)
    }
    await drop('wrong_question_book_shares')
    await drop('wrong_question_practice_records')
    await drop('wrong_question_books')
}
