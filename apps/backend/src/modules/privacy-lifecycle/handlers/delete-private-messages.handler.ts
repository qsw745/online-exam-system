import { createFixedTableHandler, defaultLifecycleHandlerDatabase, type LifecycleHandlerDatabase } from './handler-support'

const PRIVATE_TABLES = [
  { table: 'messages', subjectColumn: 'user_id' },
  { table: 'todos', subjectColumn: 'user_id' },
  { table: 'notifications', subjectColumn: 'user_id' },
  { table: 'user_menus', subjectColumn: 'user_id' },
  { table: 'mail_recipients', subjectColumn: 'recipient_id' },
  { table: 'mail_messages', subjectColumn: 'sender_id' },
] as const

export const createDeletePrivateMessagesHandler = (database: LifecycleHandlerDatabase = defaultLifecycleHandlerDatabase) =>
  createFixedTableHandler({
    stepCode: 'delete_private_messages_tasks', category: 'PROFILE_AND_SETTINGS', database, specs: PRIVATE_TABLES,
  })
