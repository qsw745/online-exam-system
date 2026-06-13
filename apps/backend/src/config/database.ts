// apps/backend/src/config/database.ts
import type { Pool } from 'mysql2/promise'

// 注意：这里带上 .js 后缀以匹配编译产物的路径解析（ts -> js）
import { pool as rawPool } from '@/infrastructure/db/index.js'

// 向外显式导出为 promise Pool 类型
export const pool: Pool = rawPool as unknown as Pool
