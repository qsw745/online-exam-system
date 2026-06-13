// apps/backend/src/types/mysql2-augment.d.ts
import 'mysql2/promise'

declare module 'mysql2/promise' {
  interface Pool {
    /** 保证 query 泛型可用 */
    query<T = any>(sql: string, params?: any[]): Promise<[T, any]>
    execute<T = any>(sql: string, params?: any[]): Promise<[T, any]>
    /** 在部分封装的类型里 getConnection 可能丢了，这里强制存在 */
    getConnection(): Promise<PoolConnection>
  }

  interface PoolConnection {
    query<T = any>(sql: string, params?: any[]): Promise<[T, any]>
    execute<T = any>(sql: string, params?: any[]): Promise<[T, any]>
    beginTransaction(): Promise<void>
    commit(): Promise<void>
    rollback(): Promise<void>
    release(): void
  }
}
