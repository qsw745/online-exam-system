/* 全局类型垫片：当项目未安装 @types/node 时使用
   若后续安装了 @types/node，请删除本文件以避免类型重复声明冲突。 */

declare module 'child_process' {
  export function execSync(command: string, options?: any): string | Buffer
}

declare module 'fs' {
  const fsAny: any
  export = fsAny
}

declare module 'path' {
  const pathAny: any
  export = pathAny
}

/** 最小化的 Node.js process 声明（避免 TS: 找不到名称 “process”） */
declare const process: any

/** 给你的数据库 pool 提供一个“可查询（带泛型）”的签名，修复 TS2347 */
declare module '@/config/database' {
  type QueryableConnection = {
    query<T = any>(sql: string, params?: any[]): Promise<[T, any]>
    beginTransaction(): Promise<void>
    commit(): Promise<void>
    rollback(): Promise<void>
    release(): void
  }
  export const pool: {
    query<T = any>(sql: string, params?: any[]): Promise<[T, any]>
    getConnection?: () => Promise<QueryableConnection>
  }
}

/** 如果你还扩展了 Express 的 Response（如 res.ok/res.fail 等），可在此放自定义声明
declare namespace Express {
  export interface Response {
    ok: (data?: any, message?: string) => Response
    fail: (code: string, status: number, message?: string, extra?: any) => Response
    internal: (message?: string, extra?: any) => Response
    unauthorized: (message?: string, extra?: any) => Response
    forbidden: (message?: string, extra?: any) => Response
    tooMany: (message?: string, extra?: any) => Response
    badRequest: (message?: string, extra?: any) => Response
  }
}
*/
