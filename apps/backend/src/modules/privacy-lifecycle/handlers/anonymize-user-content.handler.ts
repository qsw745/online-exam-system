import { createFixedTableHandler, defaultLifecycleHandlerDatabase, type LifecycleHandlerDatabase } from './handler-support'

const CONTENT_TABLES = [
  { table: 'discussions', subjectColumn: 'user_id', mode: 'CLEAR' as const },
  { table: 'discussion_replies', subjectColumn: 'user_id', mode: 'CLEAR' as const },
  { table: 'discussion_likes', subjectColumn: 'user_id' },
  { table: 'discussion_bookmarks', subjectColumn: 'user_id' },
  { table: 'discussion_follows', subjectColumn: 'user_id' },
  { table: 'discussion_reports', subjectColumn: 'user_id' },
  { table: 'user_discussion_stats', subjectColumn: 'user_id' },
] as const

export const createAnonymizeUserContentHandler = (database: LifecycleHandlerDatabase = defaultLifecycleHandlerDatabase) =>
  createFixedTableHandler({ stepCode: 'anonymize_user_content', category: 'USER_CONTENT', database, specs: CONTENT_TABLES })
