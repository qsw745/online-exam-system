/* eslint-disable @typescript-eslint/no-explicit-any */
// apps/backend/src/config/sql-debug.ts
// 全局包装 mysql2 的 Pool / Promise 连接的 query/execute，输出可读 SQL（含参数、耗时、业务栈帧）

import type { Pool, PoolConnection } from 'mysql2/promise'
import { format as mysqlFormat } from 'mysql2'

// 在未装 @types/node 的环境避免 2591
declare const process: any

// ========== 工具函数 ==========

function trunc(str: string, max = 4000) {
  if (!str) return ''
  return str.length > max ? str.slice(0, max) + '…(truncated)' : str
}

// 使用 mysql2 的 format 渲染最终 SQL（仅日志展示）
function renderSql(sql: any, params: any): string {
  const raw = typeof sql === 'object' && sql?.sql ? sql.sql : String(sql || '')
  try {
    return mysqlFormat(raw, params ?? [])
  } catch {
    const js = (() => {
      try {
        return JSON.stringify(params)
      } catch {
        return String(params)
      }
    })()
    return `${raw}  -- params: ${js}`
  }
}

// 选取首个“业务栈帧”（排除 node:/node_modules）
function pickTopBusinessFrame(stack?: string) {
  if (!stack) return null
  const lines = stack.split('\n').slice(1)
  for (const l of lines) {
    let m = l.match(/\s*at\s+(.*?)\s+\((.*?):(\d+):(\d+)\)/)
    if (m) {
      const [, method, file, line, column] = m
      if (file.includes('node:') || file.includes('node_modules')) continue
      return { method, file, line: Number(line), column: Number(column) }
    }
    m = l.match(/\s*at\s+(.*?):(\d+):(\d+)/)
    if (m) {
      const [, file, line, column] = m
      if (file.includes('node:') || file.includes('node_modules')) continue
      return { file, line: Number(line), column: Number(column) }
    }
  }
  return null
}

function isDebugOn(): boolean {
  const v = (process?.env?.SQL_DEBUG ?? '1') + ''
  return /^(|1|true|on|yes)$/i.test(v)
}

function slowMs(): number {
  const v = Number(process?.env?.SQL_SLOW_MS ?? 300)
  return Number.isFinite(v) && v >= 0 ? v : 300
}

function logOk(payload: any) {
  if (!isDebugOn()) return
  console.log('[SVC] [SQL OK]', JSON.stringify(payload, null, 2))
}
function logErr(payload: any) {
  console.error('[SVC] [SQL ERR]', JSON.stringify(payload, null, 2))
}

// ========== 包装器 ==========

type AnyRunner = { query: Function; execute?: Function }

function wrapRunner<T extends AnyRunner>(runner: T): T {
  const anyRunner = runner as any
  if (anyRunner.__sqlWrapped__) return runner

  const origQuery = anyRunner.query?.bind(anyRunner)
  const origExecute = anyRunner.execute?.bind(anyRunner)

  if (typeof origQuery === 'function') {
    anyRunner.query = async function (sql: any, params?: any) {
      const t0 = Date.now()
      const callSite = pickTopBusinessFrame(new Error().stack)
      try {
        const ret = await origQuery(sql, params) // 仅用于 Promise 版
        const took = Date.now() - t0
        const payload: any = {
          tookMs: took,
          slow: took >= slowMs() ? true : undefined,
          sql: trunc(renderSql(sql, params)),
          parameters: params ?? undefined,
          where: callSite || undefined,
        }
        logOk(payload)
        return ret
      } catch (e: any) {
        const took = Date.now() - t0
        const payload = {
          tookMs: took,
          sql: trunc(renderSql(sql, params)),
          parameters: params ?? undefined,
          error: {
            type: e?.name,
            message: e?.message,
            code: e?.code,
            errno: e?.errno,
            sqlState: e?.sqlState || e?.sqlstate,
            sqlMessage: e?.sqlMessage,
          },
          where: callSite || undefined,
          stack: e?.stack,
        }
        logErr(payload)
        throw e
      }
    }
  }

  if (typeof origExecute === 'function') {
    anyRunner.execute = async function (sql: any, params?: any) {
      const t0 = Date.now()
      const callSite = pickTopBusinessFrame(new Error().stack)
      try {
        const ret = await origExecute(sql, params) // 仅用于 Promise 版
        const took = Date.now() - t0
        const payload: any = {
          tookMs: took,
          slow: took >= slowMs() ? true : undefined,
          sql: trunc(renderSql(sql, params)),
          parameters: params ?? undefined,
          where: callSite || undefined,
        }
        logOk(payload)
        return ret
      } catch (e: any) {
        const took = Date.now() - t0
        const payload = {
          tookMs: took,
          sql: trunc(renderSql(sql, params)),
          parameters: params ?? undefined,
          error: {
            type: e?.name,
            message: e?.message,
            code: e?.code,
            errno: e?.errno,
            sqlState: e?.sqlState || e?.sqlstate,
            sqlMessage: e?.sqlMessage,
          },
          where: callSite || undefined,
          stack: e?.stack,
        }
        logErr(payload)
        throw e
      }
    }
  }

  anyRunner.__sqlWrapped__ = true
  return runner
}

/**
 * 启用 SQL 调试（仅 Promise Pool/Connection）：
 * - 包装 pool.query/execute
 * - 包装 pool.getConnection() 返回的连接：
 *    * 如果是回调版（有 .promise()），先转成 promiseConn 再 wrap
 * - 防重入
 * - 不再 wrap pool.on('connection') 的原始回调连接（避免把非 Promise 的 query/execute await 导致崩溃）
 */
export function enableSqlDebug(pool: Pool) {
  const anyPool = pool as any
  if (anyPool.__sqlWrappedPool__) return pool

  // 包装 Pool 自身（mysql2/promise 的 Pool）
  wrapRunner(anyPool)

  // 包装 getConnection：确保返回 Promise 连接
  if (typeof anyPool.getConnection === 'function') {
    const raw = anyPool.getConnection.bind(anyPool)
    anyPool.getConnection = async (...args: any[]) => {
      const conn = await raw(...args)
      // 如果拿到的是回调风格连接（带 .promise()），先转 Promise 连接
      const promiseConn: PoolConnection = (conn as any)?.promise ? (conn as any).promise() : (conn as any)
      wrapRunner(promiseConn as any)
      return promiseConn
    }
  }

  anyPool.__sqlWrappedPool__ = true

  if (isDebugOn()) {
    console.error(
      `[sql-debug] enabled (slow >= ${slowMs()}ms). Set SQL_DEBUG=0 to disable, SQL_SLOW_MS to adjust threshold.`
    )
  }
  return pool
}
