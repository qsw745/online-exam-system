import { randomUUID } from 'node:crypto'

import { pool } from '@/config/database'
import { log } from '@/infrastructure/logging/logger'
import type { DataRegion } from '../domain/lifecycle.model'
import { parseOutboxKeyring } from '../domain/outbox-crypto'
import { LifecycleWorkerRepository } from '../repositories/lifecycle-worker.repository'
import { LifecycleSchemaAuditService } from '../services/lifecycle-schema-audit.service'
import { NoopLifecycleMetrics } from '../services/lifecycle-observability'
import { runLifecycleWorkerOnce, type LifecycleHandler } from '../services/lifecycle-worker.service'
import { createLifecycleHandlerMap } from '../handlers'
import { createRetentionScanHandlers } from '../handlers/retention-scan.handlers'
import { defaultLifecycleHandlerDatabase } from '../handlers/handler-support'
import {
  FileDeletionManifestSink,
  HttpDeletionManifestSink,
  createDeletionManifestStager,
  parseManifestKeyring,
  type DeletionManifestSink,
} from '../services/deletion-manifest.service'
import { RetentionScanRepository } from '../repositories/retention-scan.repository'
import {
  RETENTION_SCAN_CATEGORIES,
  runRetentionScanOnce,
} from '../services/retention-scan.service'

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
  retentionOnce: boolean
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
    if (!env.DELETION_MANIFEST_RECEIVER_TOKEN) {
      throw Object.assign(new Error('生产环境必须配置外部删除墓碑接收器令牌'), {
        code: 'LIFECYCLE_MANIFEST_RECEIVER_TOKEN_REQUIRED',
      })
    }
  }
  return {
    dataRegion,
    workerId: String(env.LIFECYCLE_WORKER_ID || `lifecycle-${process.pid}-${randomUUID()}`).slice(0, 96),
    leaseMs: parseInteger(env.LIFECYCLE_LEASE_MS, 30_000, 5_000, 10 * 60_000, 'LIFECYCLE_LEASE_CONFIG_INVALID'),
    batchSize: parseInteger(env.LIFECYCLE_BATCH_SIZE, 100, 1, 1_000, 'LIFECYCLE_BATCH_CONFIG_INVALID'),
    intervalMs: parseInteger(env.LIFECYCLE_POLL_INTERVAL_MS, 1_000, 250, 60_000, 'LIFECYCLE_POLL_CONFIG_INVALID'),
    once: argv.includes('--once') || argv.includes('--retention-once'),
    retentionOnce: argv.includes('--retention-once'),
  }
}

const delay = (milliseconds: number) => new Promise<void>(resolve => setTimeout(resolve, milliseconds))

const createManifestSink = (env: NodeJS.ProcessEnv): DeletionManifestSink => {
  if (env.DELETION_MANIFEST_RECEIVER_URL) {
    return new HttpDeletionManifestSink(
      env.DELETION_MANIFEST_RECEIVER_URL,
      String(env.DELETION_MANIFEST_RECEIVER_TOKEN || ''),
    )
  }
  if (env.NODE_ENV !== 'production' && env.DELETION_MANIFEST_FILE) {
    return new FileDeletionManifestSink(env.DELETION_MANIFEST_FILE, env.NODE_ENV)
  }
  throw Object.assign(new Error('生命周期 Worker 必须配置外部或开发文件墓碑接收器'), {
    code: 'LIFECYCLE_MANIFEST_RECEIVER_REQUIRED',
  })
}

const createRuntimeHandlers = (env: NodeJS.ProcessEnv): ReadonlyMap<string, LifecycleHandler> => {
  const manifestKeyring = parseManifestKeyring(env)
  const outboxKeyring = parseOutboxKeyring(env)
  const handlers = new Map(createLifecycleHandlerMap({
    database: defaultLifecycleHandlerDatabase,
    manifest: createDeletionManifestStager({ keyring: manifestKeyring, outboxKeyring }),
    manifestSink: createManifestSink(env),
  }))
  for (const handler of createRetentionScanHandlers({ database: defaultLifecycleHandlerDatabase, outboxKeyring })) {
    if (handlers.has(handler.stepCode)) {
      throw Object.assign(new Error('生命周期处理器代码重复'), { code: 'LIFECYCLE_HANDLER_DUPLICATE' })
    }
    handlers.set(handler.stepCode, handler)
  }
  return handlers
}

const scheduleRetentionWindows = async (
  dataRegion: DataRegion,
  now: Date,
  metrics: NoopLifecycleMetrics,
): Promise<void> => {
  const windowEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const windowStart = new Date(windowEnd.getTime() - 86_400_000)
  const repository = new RetentionScanRepository()
  for (const category of RETENTION_SCAN_CATEGORIES) {
    await runRetentionScanOnce({ dataRegion, category, windowStart, windowEnd, now, repository, metrics })
  }
}

export async function startLifecycleWorker(
  options = readLifecycleWorkerRuntimeOptions(),
  handlers?: ReadonlyMap<string, LifecycleHandler>,
): Promise<void> {
  const runtimeHandlers = handlers ?? createRuntimeHandlers(process.env)
  const audit = new LifecycleSchemaAuditService(pool as any)
  await audit.inspect()
  if (runtimeHandlers.size === 0) {
    throw Object.assign(new Error('生命周期处理器尚未注册，拒绝认领任务'), {
      code: 'LIFECYCLE_HANDLER_REGISTRY_EMPTY',
    })
  }

  const repository = new LifecycleWorkerRepository()
  const metrics = new NoopLifecycleMetrics()
  if (options.retentionOnce) await scheduleRetentionWindows(options.dataRegion, new Date(), metrics)
  let stopping = false
  const stop = () => { stopping = true }
  process.once('SIGTERM', stop)
  process.once('SIGINT', stop)

  try {
    do {
      const summary = await runLifecycleWorkerOnce({
        repository,
        handlers: runtimeHandlers,
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
      if (options.retentionOnce && summary.claimed === 0) break
      if (!options.once && !stopping) await delay(options.intervalMs)
    } while ((options.retentionOnce || !options.once) && !stopping)
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
