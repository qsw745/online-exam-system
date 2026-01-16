/* eslint-disable @typescript-eslint/no-explicit-any */
import { Queue, Worker, type Job } from 'bullmq'
import IORedis, { type RedisOptions } from 'ioredis'
import { AI_JOB_CONCURRENCY } from '@/config/ai'
import { runSystemTests } from './system-tests.runner'

declare const process: any

const {
  REDIS_URL,
  REDIS_HOST = '127.0.0.1',
  REDIS_PORT = '6379',
  REDIS_PASSWORD = '',
  REDIS_DB = '0',
  REDIS_PREFIX = '',
} = process.env as Record<string, string | undefined>

const queueName = 'system-tests'
const queuePrefix = (REDIS_PREFIX || '').replace(/:+$/, '')

const baseCommon = {
  lazyConnect: true,
  enableReadyCheck: true,
  maxRetriesPerRequest: null,
  retryStrategy(times: number) {
    const delay = Math.min(2000, 100 + times * 100)
    return delay
  },
} satisfies Partial<RedisOptions>

const base: RedisOptions = REDIS_URL
  ? (baseCommon as RedisOptions)
  : ({
      ...baseCommon,
      host: REDIS_HOST,
      port: Number(REDIS_PORT),
      password: REDIS_PASSWORD || undefined,
      db: Number(REDIS_DB) || 0,
    } as RedisOptions)

const bullConnection = REDIS_URL ? new IORedis(REDIS_URL, base) : new IORedis(base)

type JobPayload = {
  modules?: string[]
  iterations?: number
  user: { id: number; email?: string }
}

export const systemTestQueue = new Queue<JobPayload>(queueName, {
  connection: bullConnection as any,
  prefix: queuePrefix ? `${queuePrefix}:bull` : 'bull',
})

async function processJob(job: Job<JobPayload>) {
  const result = await runSystemTests({
    modules: job.data.modules,
    iterations: job.data.iterations,
    user: job.data.user,
  })
  return result
}

let workerStarted = false

export function ensureSystemTestWorker() {
  if (workerStarted) return
  workerStarted = true
  // eslint-disable-next-line no-new
  new Worker<JobPayload>(queueName, processJob, {
    connection: bullConnection as any,
    concurrency: Math.max(1, AI_JOB_CONCURRENCY),
    prefix: queuePrefix ? `${queuePrefix}:bull` : 'bull',
  })
}

export async function enqueueSystemTestJob(payload: Omit<JobPayload, 'user'> & { user: JobPayload['user'] }) {
  const job = await systemTestQueue.add('run', payload, {
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 50 },
  })
  return job
}

export async function getSystemTestJob(jobId: string) {
  return systemTestQueue.getJob(jobId)
}
