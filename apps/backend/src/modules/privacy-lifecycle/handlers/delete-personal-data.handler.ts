import { createFixedTableHandler, defaultLifecycleHandlerDatabase, type LifecycleHandlerDatabase } from './handler-support'

const PERSONAL_TABLES = [
  'user_settings', 'favorite_categories', 'favorites', 'wrong_question_books', 'wrong_questions',
  'wrong_question_practice_records', 'practice_records', 'learning_progress', 'learning_statistics',
  'learning_tracks', 'learning_goals', 'learning_achievements', 'ai_chat_sessions', 'ai_chat_logs',
].map(table => ({ table, subjectColumn: 'user_id' }))
const SHARED_TABLES = [
  { table: 'favorite_shares', subjectColumn: 'shared_by' },
  { table: 'wrong_question_book_shares', subjectColumn: 'shared_by' },
] as const

export const createDeletePersonalDataHandler = (database: LifecycleHandlerDatabase = defaultLifecycleHandlerDatabase) =>
  createFixedTableHandler({
    stepCode: 'delete_profile_learning_data', category: 'PROFILE_AND_SETTINGS', database,
    specs: [...PERSONAL_TABLES, ...SHARED_TABLES],
  })
