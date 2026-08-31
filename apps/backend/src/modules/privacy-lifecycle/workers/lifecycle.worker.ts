import { randomUUID } from 'node:crypto'

import { pool } from '@/config/database'
import { log } from '@/infrastructure/logging/logger'
import type { DataRegion } from '../domain/lifecycle.model'
import { LifecycleWorkerRepository } from '../repositories/lifecycle-worker.repository'
import { LifecycleSchemaAuditService } from '../services/lifecycle-schema-audit.service'
import { NoopLifecycleMetrics } from '../services/lifecycle-observability'
import { runLifecycleWorkerOnce, type LifecycleHandler } from '../services/lifecycle-worker.service'

const parseRegion = (value: unknown): DataRegion => {
  if (value === 'CN' || value === 'GLOBAL') return value
  throw Object.assign(new Error('生命周期 Worker 必须设置 DATA_REGION=CN 或 GLOBAL'), {
    code: 'LIFECYCLE_REGION_REQUIRED',
  })
}

const parseInteger = (value: unknown, fallback: number, min: number, max: number, code: string): number => {
  const parsed = value == null || value === '' ? fallback : Number(value)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw Object.assign(new Error('生命周期 Worker 数值配置无效'), { code })
  }
  return parsed
}

export type LifecycleWorkerRuntimeOptions = {
  dataRegion: DataRegion
  workerId: string
  leaseMs: number
  batchSize: number
  intervalMs: number
  once: boolean
}

export function readLifecycleWorkerRuntimeOptions(
  env: NodeJS.ProcessEnv = process.env,
  argv: readonly string[] = process.argv.slice(2),
): LifecycleWorkerRuntimeOptions {
  const dataRegion = parseRegion(env.DATA_REGION)
  if (env.NODE_ENV === 'production') {
    if (!env.LIFECYCLE_LEASE_MS) {
      throw Object.assign(new Error('生产环境必须显式设置 LIFECYCLE_LEASE_MS'), {
        code: 'LIFECYCLE_LEASE_CONFIG_REQUIRED',
      })
    }
    if (!env.DELETION_MANIFEST_RECEIVER_URL) {
      throw Object.assign(new Error('生产环境必须配置外部删除墓碑接收器'), {
        code: 'LIFECYCLE_MANIFEST_RECEIVER_REQUIRED',
      })
    }
  }
  return {
    dataRegion,
    workerId: String(env.LIFECYCLE_WORKER_ID || `lifecycle-${process.pid}-${randomUUID()}`).slice(0, 96),
    leaseMs: parseInteger(env.LIFECYCLE_LEASE_MS, 30_000, 5_000, 10 * 60_000, 'LIFECYCLE_LEASE_CONFIG_INVALID'),
    batchSize: parseInteger(env.LIFECYCLE_BATCH_SIZE, 100, 1, 1_000, 'LIFECYCLE_BATCH_CONFIG_INVALID'),
    intervalMs: parseInteger(env.LIFECYCLE_POLL_INTERVAL_MS, 1_000, 250, 60_000, 'LIFECYCLE_POLL_CONFIG_INVALID'),
    once: argv.includes('--once'),
  }
}

const delay = (milliseconds: number) => new Promise<void>(resolve => setTimeout(resolve, milliseconds))

export async function startLifecycleWorker(
  options = readLifecycleWorkerRuntimeOptions(),
  handlers: ReadonlyMap<string, LifecycleHandler> = new Map(),
): Promise<void> {
  const audit = new LifecycleSchemaAuditService(pool as any)
  await audit.inspect()
  if (handlers.size === 0) {
    throw Object.assign(new Error('生命周期处理器尚未注册，拒绝认领任务'), {
      code: 'LIFECYCLE_HANDLER_REGISTRY_EMPTY',
    })
  }

  const repository = new LifecycleWorkerRepository()
  const metrics = new NoopLifecycleMetrics()
  let stopping = false
  const stop = () => { stopping = true }
  process.once('SIGTERM', stop)
  process.once('SIGINT', stop)

  try {
    do {
      const summary = await runLifecycleWorkerOnce({
        repository,
        handlers,
        metrics,
        workerId: options.workerId,
        dataRegion: options.dataRegion,
        now: new Date(),
        leaseMs: options.leaseMs,
        batchSize: options.batchSize,
      })
      log.info('lifecycle worker run completed', {
        dataRegion: options.dataRegion,
        claimed: summary.claimed,
        completed: summary.completed,
        retried: summary.retried,
        attentionRequired: summary.attentionRequired,
        paused: summary.paused,
      })
      if (!options.once && !stopping) await delay(options.intervalMs)
    } while (!options.once && !stopping)
  } finally {
    process.off('SIGTERM', stop)
    process.off('SIGINT', stop)
  }
}

if (require.main === module) {
  startLifecycleWorker().catch(error => {
    const code = String(error?.code || 'LIFECYCLE_WORKER_START_FAILED')
    log.error('lifecycle worker stopped', { code })
    process.exitCode = 1
  })
}
