import { createFixedTableHandler, defaultLifecycleHandlerDatabase, type LifecycleHandlerDatabase } from './handler-support'

const AUTH_TABLES = [
  { table: 'refresh_tokens', subjectColumn: 'user_id' },
  { table: 'password_reset_tokens', subjectColumn: 'user_id' },
  { table: 'user_oauth_accounts', subjectColumn: 'user_id' },
  { table: 'user_identities', subjectColumn: 'user_id' },
] as const

export const createDeleteAuthCredentialsHandler = (database: LifecycleHandlerDatabase = defaultLifecycleHandlerDatabase) =>
  createFixedTableHandler({ stepCode: 'delete_auth_credentials', category: 'AUTH_CREDENTIALS', database, specs: AUTH_TABLES })
