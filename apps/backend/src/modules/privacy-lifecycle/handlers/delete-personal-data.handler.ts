import { createFixedTableHandler, defaultLifecycleHandlerDatabase, requireAccountParent, type LifecycleHandlerDatabase } from './handler-support'
import type { LifecycleHandler } from '../services/lifecycle-worker.service'

const PERSONAL_TABLES = [
  // 收藏分类是全局字典；旧数据库的错题明细没有外键，先显式清理明细。
  'user_settings', 'favorites', 'wrong_question_books',
  'wrong_question_practice_records', 'practice_records', 'learning_progress', 'learning_statistics',
  'learning_tracks', 'learning_goals', 'learning_achievements', 'ai_chat_sessions', 'ai_chat_logs',
].map(table => ({ table, subjectColumn: 'user_id' }))
const SHARED_TABLES = [
  { table: 'favorite_shares', subjectColumn: 'shared_by' },
  { table: 'wrong_question_book_shares', subjectColumn: 'shared_by' },
] as const

export const createDeletePersonalDataHandler = (database: LifecycleHandlerDatabase = defaultLifecycleHandlerDatabase): LifecycleHandler => {
  const direct = createFixedTableHandler({
    stepCode: 'delete_profile_learning_data', category: 'PROFILE_AND_SETTINGS', database,
    specs: [...PERSONAL_TABLES, ...SHARED_TABLES],
  })
  return {
    ...direct,
    async executeBatch(context) {
      const parent = requireAccountParent(context)
      const deleted = await database.withTransaction(async connection => {
        const [rows] = await connection.query(
          `SELECT wq.id FROM wrong_questions wq JOIN wrong_question_books b ON b.id=wq.book_id
           WHERE b.user_id=? ORDER BY wq.id LIMIT ?`, [parent.userId, context.batchSize],
        )
        const ids = (rows as Array<{ id: number }>).map(row => row.id)
        if (!ids.length) return 0
        const placeholders = ids.map(() => '?').join(',')
        await connection.query(`DELETE FROM wrong_question_practice_records WHERE wrong_question_id IN (${placeholders})`, ids)
        await connection.query(`DELETE FROM wrong_questions WHERE id IN (${placeholders})`, ids)
        return ids.length
      })
      if (deleted) return { processedCount: deleted, nextCursor: context.cursor ?? null, done: false }
      return direct.executeBatch(context)
    },
  }
}
