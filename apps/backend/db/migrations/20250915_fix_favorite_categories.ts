// apps/backend/src/database/migrations/20250915_fix_favorite_categories.ts
import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
    // 临时关闭 FK 检查，避免中间步骤报错
    await knex.raw('SET FOREIGN_KEY_CHECKS = 0')

    // 1) 确保 favorite_categories 存在（id 为自增无符号整数）
    const hasCat = await knex.schema.hasTable('favorite_categories')
    if (!hasCat) {
        await knex.schema.createTable('favorite_categories', (t) => {
            t.increments('id').unsigned().primary()
            t.string('name', 64).notNullable().unique()
            t.string('description', 255).defaultTo('')
            t.string('color', 16).defaultTo('#A78BFA')
            t.string('icon', 64).defaultTo('')
            t.integer('sort_order').defaultTo(0)
            t.timestamp('created_at').defaultTo(knex.fn.now())
            t.timestamp('updated_at').defaultTo(knex.fn.now())
        })
    }

    // 2) 读取被参考列的真实类型（例如：int(10) unsigned / bigint(20) unsigned）
    const [refColRows]: any[] = await knex.raw(`
    SELECT COLUMN_TYPE
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'favorite_categories'
      AND COLUMN_NAME = 'id'
    LIMIT 1
  `)
    const refColumnType: string | undefined = refColRows?.[0]?.COLUMN_TYPE // e.g. "int(10) unsigned"
    if (!refColumnType) {
        throw new Error('[migration] favorite_categories.id not found (cannot detect referenced column type)')
    }

    // 3) favorites 表存在性检查
    const hasFav = await knex.schema.hasTable('favorites')
    if (!hasFav) {
        // 若没有 favorites，则无需继续（或者按你项目需要可创建它）
        await knex.raw('SET FOREIGN_KEY_CHECKS = 1')
        return
    }

    // 4) 删除 favorites.category_id 上的既有外键（如果有）
    const [fkRows]: any[] = await knex.raw(`
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
            await knex.raw(`ALTER TABLE favorites DROP FOREIGN KEY \`${name}\``)
        }
    }

    // 5) 确保 favorites.category_id 存在，并把类型强制改为与被参考列完全一致
    const hasCol = await knex.schema.hasColumn('favorites', 'category_id')
    if (!hasCol) {
        // 用 RAW 明确指定同款 COLUMN_TYPE，确保 unsigned/长度都一致
        await knex.raw(`ALTER TABLE favorites ADD COLUMN category_id ${refColumnType} NULL`)
    } else {
        await knex.raw(`ALTER TABLE favorites MODIFY COLUMN category_id ${refColumnType} NULL`)
    }

    // 6) 确保有索引（若已存在会抛错，吞掉即可）
    await knex
        .raw(`ALTER TABLE favorites ADD INDEX idx_favorites_category_id (category_id)`)
        .catch(() => {})

    // 7) 重新添加外键（与需求一致：UPDATE RESTRICT / DELETE SET NULL）
    await knex.raw(`
    ALTER TABLE favorites
    ADD CONSTRAINT fk_fav_category
      FOREIGN KEY (category_id)
      REFERENCES favorite_categories (id)
      ON UPDATE RESTRICT
      ON DELETE SET NULL
  `)

    // 8) 种子分类（仅当表为空）
    const row = await knex('favorite_categories').count<{ cnt: string | number }>({ cnt: 'id' }).first()
    const cnt = Number(row?.cnt ?? 0)
    if (cnt === 0) {
        await knex('favorite_categories').insert([
            { name: '未分类', description: '未选择分类的收藏', color: '#94A3B8', icon: 'Tag',            sort_order: 0 },
            { name: '刷题集', description: '常用练习集合',     color: '#60A5FA', icon: 'BookOpen',      sort_order: 1 },
            { name: '错题本', description: '需要重点复习的错题', color: '#F97316', icon: 'AlertTriangle', sort_order: 2 },
            { name: '收藏',   description: '临时收纳，稍后整理', color: '#A78BFA', icon: 'Star',         sort_order: 3 },
        ])
    }

    await knex.raw('SET FOREIGN_KEY_CHECKS = 1')
}

export async function down(knex: Knex): Promise<void> {
    await knex.raw('SET FOREIGN_KEY_CHECKS = 0')
    await knex.raw(`ALTER TABLE favorites DROP FOREIGN KEY fk_fav_category`).catch(() => {})
    // 不删除 favorites.category_id 列，避免影响业务；只回滚分类表（按需）
    await knex.schema.dropTableIfExists('favorite_categories')
    await knex.raw('SET FOREIGN_KEY_CHECKS = 1')
}
