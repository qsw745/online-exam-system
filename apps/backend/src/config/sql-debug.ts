// apps/backend/src/config/sql-debug.ts
import type { Pool, PoolConnection } from 'mysql2/promise'
import { format as mysqlFormat } from 'mysql2'

// 简单截断，避免日志爆屏
function trunc(str: string, max = 4000) {
    if (!str) return ''
    return str.length > max ? str.slice(0, max) + '…(truncated)' : str
}

// 尝试把 SQL 和参数格式化成可读的最终语句（仅日志展示用）
function renderSql(sql: any, params: any): string {
    const raw = typeof sql === 'object' && sql?.sql ? sql.sql : String(sql || '')
    try {
        // 注意：当使用 VALUES ? 进行批量插入时，mysql2 的 format 也能处理二维数组
        return mysqlFormat(raw, params ?? [])
    } catch {
        // 如果 format 失败，就退化为原始 SQL + JSON 参数
        const js = (() => {
            try { return JSON.stringify(params) } catch { return String(params) }
        })()
        return `${raw}  -- params: ${js}`
    }
}

// 打印器
function logSql(kind: 'OK' | 'ERR', sql: any, params: any, costMs: number | null, err?: any) {
    const rendered = trunc(renderSql(sql, params))
    if (kind === 'OK') {
        console.error(`[SQL] ${rendered}  (${costMs}ms)`)
    } else {
        const code = err?.code || err?.errno || ''
        const msg = err?.sqlMessage || err?.message || ''
        console.error(`[SQL-ERR] ${rendered}  (${costMs ?? 0}ms)  -> ${code} ${msg}`)
    }
}

// 包装 query/execute 方法
function wrapRunner<T extends { query: Function; execute?: Function }>(runner: T): T {
    const origQuery = runner.query.bind(runner)
    const origExecute = (runner as any).execute?.bind(runner)

    runner.query = async function (sql: any, params?: any) {
        const start = Date.now()
        try {
            const res = await origQuery(sql, params)
            logSql('OK', sql, params, Date.now() - start)
            return res
        } catch (e) {
            logSql('ERR', sql, params, Date.now() - start, e)
            throw e
        }
    }

    if (origExecute) {
        ;(runner as any).execute = async function (sql: any, params?: any) {
            const start = Date.now()
            try {
                const res = await origExecute(sql, params)
                logSql('OK', sql, params, Date.now() - start)
                return res
            } catch (e) {
                logSql('ERR', sql, params, Date.now() - start, e)
                throw e
            }
        }
    }

    return runner
}

/**
 * 启用 SQL 调试：
 * - 包装 pool 的 query/execute
 * - 包装 pool.getConnection() 返回的连接（事务里也能打印）
 */
export function enableSqlDebug(pool: Pool) {
    if (!process.env.SQL_DEBUG || !/^1|true|on$/i.test(String(process.env.SQL_DEBUG))) {
        return pool // 未开启，什么都不做
    }

    // 包装 pool 自身
    wrapRunner(pool as any)

    // 包装 getConnection，确保事务连接也打印 SQL
    const origGetConn = pool.getConnection.bind(pool)
    pool.getConnection = async function () {
        const conn: PoolConnection = await origGetConn()
        wrapRunner(conn as any)
        return conn
    }

    console.error('[sql-debug] SQL_DEBUG enabled -> all mysql2 queries will be logged')
    return pool
}
