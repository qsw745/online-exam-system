import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
    // 关掉 FK 检查，避免中间过程报错
    await knex.raw('SET FOREIGN_KEY_CHECKS = 0')

    // 1) 创建 favorite_categories（若不存在）
    const hasCat = await knex.schema.hasTable('favorite_categories')
    if (!hasCat) {
        await knex.schema.createTable('favorite_categories', table => {
            table.increments('id').unsigned().primary() // INT UNSIGNED AUTO_INCREMENT
            table.string('name', 64).notNullable().unique()
            table.string('description', 255).defaultTo('')
            table.string('color', 16).defaultTo('#A78BFA')
            table.string('icon', 64).defaultTo('')
            table.integer('sort_order').defaultTo(0)
            table.timestamp('created_at').defaultTo(knex.fn.now())
            table
                .timestamp('updated_at')
                .defaultTo(knex.fn.now()) // 仅作占位，MySQL 的 ON UPDATE CURRENT_TIMESTAMP 由 SQL 层处理即可
        })
    }

    // 2) favorites.category_id：删除旧外键（若存在）
    const [fkRows] = await knex.raw(`
    SELECT CONSTRAINT_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'favorites'
      AND COLUMN_NAME = 'category_id'
      AND REFERENCED_TABLE_NAME IS NOT NULL
  `)
    if (Array.isArray(fkRows) && fkRows.length) {
        for (const r of fkRows) {
            const name = r.CONSTRAINT_NAME
            // 防止名字里有保留字
            await knex.raw(`ALTER TABLE favorites DROP FOREIGN KEY \`${name}\``)
        }
    }

    // 3) 确保 favorites.category_id 存在且为 UNSIGNED
    const hasFav = await knex.schema.hasTable('favorites')
    if (hasFav) {
        const hasCol = await knex.schema.hasColumn('favorites', 'category_id')
        if (!hasCol) {
            await knex.schema.alterTable('favorites', t => {
                t.integer('category_id').unsigned().nullable().index()
            })
        } else {
            // 改成 UNSIGNED NULL
            await knex.schema.alterTable('favorites', t => {
                t.integer('category_id').unsigned().nullable().alter()
            })
            // 确保有索引
            // MySQL 若已有索引会忽略；没有则创建
            await knex.raw(`
        ALTER TABLE favorites
        ADD INDEX idx_favorites_category_id (category_id)
      `).catch(() => {})
        }

        // 4) 重新加外键
        await knex.schema.alterTable('favorites', t => {
            t
                .foreign('category_id', 'fk_fav_category')
                .references('favorite_categories.id')
                .onDelete('SET NULL')
                .onUpdate('RESTRICT')
        })
    }

    // 5) 种子默认分类（仅当表为空）
    const row = await knex('favorite_categories').count<{ cnt: string | number }>({ cnt: 'id' }).first()
    const cnt = Number(row?.cnt ?? 0)
    if (cnt === 0) {
        await knex('favorite_categories').insert([
            { name: '未分类', description: '未选择分类的收藏', color: '#94A3B8', icon: 'Tag',        sort_order: 0 },
            { name: '刷题集', description: '常用练习集合',     color: '#60A5FA', icon: 'BookOpen',    sort_order: 1 },
            { name: '错题本', description: '需要重点复习的错题', color: '#F97316', icon: 'AlertTriangle', sort_order: 2 },
            { name: '收藏',   description: '临时收纳，稍后整理', color: '#A78BFA', icon: 'Star',       sort_order: 3 },
        ])
    }

    await knex.raw('SET FOREIGN_KEY_CHECKS = 1')
}

export async function down(knex: Knex): Promise<void> {
    await knex.raw('SET FOREIGN_KEY_CHECKS = 0')
    // 尽量只撤销外键与分类表，避免误删业务列
    await knex.raw(`ALTER TABLE favorites DROP FOREIGN KEY fk_fav_category`).catch(() => {})
    await knex.schema.dropTableIfExists('favorite_categories')
    await knex.raw('SET FOREIGN_KEY_CHECKS = 1')
}
