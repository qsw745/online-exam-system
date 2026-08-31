import { createHmac, randomUUID } from 'node:crypto'
import { appendFile, readFile } from 'node:fs/promises'

import type { DataRegion } from '../domain/lifecycle.model'
import { encryptOutboxValue, type OutboxKeyring } from '../domain/outbox-crypto'
import type { LifecycleTransaction } from './lifecycle-worker.service'

export type DeletionManifestEntry = {
  requestId: string
  dataRegion: DataRegion
  subjectDigest: string
  keyVersion: string
  completedAt: string
}

export interface DeletionManifestSink {
  append(entry: DeletionManifestEntry): Promise<void>
  list(cursor?: string): Promise<{ entries: DeletionManifestEntry[]; nextCursor: string | null }>
}

export type ManifestKeyring = Record<string, Buffer>

export interface ManifestReplayDatabase {
  listSubjects(input: {
    dataRegion: DataRegion
    afterPublicId: string | null
    limit: number
  }): Promise<Array<{ publicId: string }>>
  deleteSubjects(dataRegion: DataRegion, publicIds: readonly string[]): Promise<number>
}

export interface DeletionManifestStager {
  stageFingerprint(input: {
    requestId: string
    dataRegion: DataRegion
    publicId: string
    connection: LifecycleTransaction
    completedAt?: Date
    notificationEmail?: string
  }): Promise<void>
}

const assertManifestKey = (key: Buffer): void => {
  if (key.length !== 32) {
    throw Object.assign(new Error('墓碑密钥必须为 32 字节'), { code: 'LIFECYCLE_MANIFEST_KEY_INVALID' })
  }
}

export function createSubjectDigest(key: Buffer, publicId: string): string {
  assertManifestKey(key)
  const normalized = String(publicId ?? '').trim().toLowerCase()
  if (!normalized) {
    throw Object.assign(new Error('墓碑主体编号不能为空'), { code: 'LIFECYCLE_MANIFEST_SUBJECT_INVALID' })
  }
  return createHmac('sha256', key).update(normalized, 'utf8').digest('hex')
}

export function createManifestEntry(input: {
  requestId: string
  dataRegion: DataRegion
  publicId: string
  key: Buffer
  keyVersion: string
  completedAt: Date
}): DeletionManifestEntry {
  return {
    requestId: input.requestId,
    dataRegion: input.dataRegion,
    subjectDigest: createSubjectDigest(input.key, input.publicId),
    keyVersion: input.keyVersion,
    completedAt: input.completedAt.toISOString(),
  }
}

export function parseManifestKeyring(env: Record<string, string | undefined>): ManifestKeyring {
  const raw = env.LIFECYCLE_MANIFEST_KEY_V1
  if (!raw) {
    throw Object.assign(new Error('缺少墓碑密钥'), { code: 'LIFECYCLE_MANIFEST_KEY_REQUIRED' })
  }
  const key = Buffer.from(raw, 'base64')
  const canonical = key.toString('base64').replace(/=+$/, '')
  if (key.length !== 32 || canonical !== raw.replace(/=+$/, '')) {
    throw Object.assign(new Error('墓碑密钥格式无效'), { code: 'LIFECYCLE_MANIFEST_KEY_INVALID' })
  }
  return { v1: key }
}

export function createDeletionManifestStager(input: {
  keyring: ManifestKeyring
  keyVersion?: string
  retentionDays?: number
  outboxKeyring?: OutboxKeyring
  outboxKeyVersion?: string
}): DeletionManifestStager {
  const keyVersion = input.keyVersion ?? 'v1'
  const key = input.keyring[keyVersion]
  if (!key) {
    throw Object.assign(new Error('未知墓碑密钥版本'), { code: 'LIFECYCLE_MANIFEST_KEY_VERSION_UNKNOWN' })
  }
  assertManifestKey(key)
  const retentionDays = input.retentionDays ?? 1_095
  return {
    async stageFingerprint(stageInput) {
      const completedAt = stageInput.completedAt ?? new Date()
      const subjectDigest = createSubjectDigest(key, stageInput.publicId)
      const retainUntil = new Date(completedAt.getTime() + retentionDays * 86_400_000)
      await stageInput.connection.query(
        `INSERT INTO data_deletion_tombstones
          (tombstone_id, request_id, data_region, subject_digest, key_version,
           sync_status, completed_at, retain_until)
         VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?)
         ON DUPLICATE KEY UPDATE request_id=VALUES(request_id)`,
        [
          randomUUID(),
          stageInput.requestId,
          stageInput.dataRegion,
          subjectDigest,
          keyVersion,
          completedAt,
          retainUntil,
        ],
      )
      if (stageInput.notificationEmail) {
        const outboxKeyVersion = input.outboxKeyVersion ?? 'v1'
        const outboxKey = input.outboxKeyring?.[outboxKeyVersion]
        if (!outboxKey) {
          throw Object.assign(new Error('最终通知消息箱密钥未配置'), {
            code: 'LIFECYCLE_OUTBOX_KEY_VERSION_UNKNOWN',
          })
        }
        const [holds] = await stageInput.connection.query(
          `SELECT MAX(expires_at) AS restricted_retention_until
             FROM data_retention_holds
            WHERE data_region=? AND scope_type='USER_REQUEST' AND scope_id=?
              AND released_at IS NULL AND expires_at>?`,
          [stageInput.dataRegion, stageInput.requestId, completedAt],
        )
        const restrictedUntil = (holds as any[])?.[0]?.restricted_retention_until
        const messageType = restrictedUntil ? 'DELETION_RESTRICTED_RETENTION' : 'DELETION_COMPLETED'
        const payload = {
          status: restrictedUntil ? 'COMPLETED_WITH_RESTRICTED_RETENTION' : 'COMPLETED',
          completedAt: completedAt.toISOString(),
          ...(restrictedUntil
            ? { restrictedRetentionUntil: new Date(restrictedUntil).toISOString() }
            : {}),
        }
        await stageInput.connection.query(
          `INSERT INTO transactional_outbox
            (message_id, message_key, request_id, data_region, message_type, status,
             recipient_envelope_json, payload_envelope_json, expires_at)
           VALUES (?, ?, ?, ?, ?, 'BLOCKED', ?, ?, ?)
           ON DUPLICATE KEY UPDATE message_key=VALUES(message_key)`,
          [
            randomUUID(),
            `deletion-final:${stageInput.requestId}`,
            stageInput.requestId,
            stageInput.dataRegion,
            messageType,
            JSON.stringify(encryptOutboxValue(outboxKey, stageInput.notificationEmail, undefined, outboxKeyVersion)),
            JSON.stringify(encryptOutboxValue(outboxKey, JSON.stringify(payload), undefined, outboxKeyVersion)),
            new Date(completedAt.getTime() + 7 * 86_400_000),
          ],
        )
      }
    },
  }
}

export class MemoryDeletionManifestSink implements DeletionManifestSink {
  private readonly entries: DeletionManifestEntry[] = []

  async append(entry: DeletionManifestEntry): Promise<void> {
    const exists = this.entries.some(item =>
      item.requestId === entry.requestId && item.subjectDigest === entry.subjectDigest,
    )
    if (!exists) this.entries.push(structuredClone(entry))
  }

  async list(cursor = '0') {
    const offset = Math.max(0, Number.parseInt(cursor, 10) || 0)
    const entries = this.entries.slice(offset, offset + 1_000).map(entry => structuredClone(entry))
    const nextOffset = offset + entries.length
    return { entries, nextCursor: nextOffset < this.entries.length ? String(nextOffset) : null }
  }
}

export class FileDeletionManifestSink implements DeletionManifestSink {
  constructor(
    private readonly filePath: string,
    nodeEnvironment = process.env.NODE_ENV,
  ) {
    if (nodeEnvironment === 'production') {
      throw Object.assign(new Error('生产环境禁止文件墓碑接收器'), {
        code: 'LIFECYCLE_MANIFEST_FILE_FORBIDDEN',
      })
    }
    if (!filePath.trim()) {
      throw Object.assign(new Error('文件墓碑接收器必须指定路径'), {
        code: 'LIFECYCLE_MANIFEST_FILE_PATH_REQUIRED',
      })
    }
  }

  private async readAll(): Promise<DeletionManifestEntry[]> {
    try {
      const content = await readFile(this.filePath, 'utf8')
      return content.split('\n').filter(Boolean).map(line => JSON.parse(line) as DeletionManifestEntry)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }
  }

  async append(entry: DeletionManifestEntry): Promise<void> {
    const entries = await this.readAll()
    const exists = entries.some(item =>
      item.requestId === entry.requestId && item.subjectDigest === entry.subjectDigest,
    )
    if (!exists) await appendFile(this.filePath, `${JSON.stringify(entry)}\n`, { encoding: 'utf8', mode: 0o600 })
  }

  async list(cursor = '0') {
    const entries = await this.readAll()
    const offset = Math.max(0, Number.parseInt(cursor, 10) || 0)
    const page = entries.slice(offset, offset + 1_000)
    const nextOffset = offset + page.length
    return { entries: page, nextCursor: nextOffset < entries.length ? String(nextOffset) : null }
  }
}

export class HttpDeletionManifestSink implements DeletionManifestSink {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    if (!/^https:\/\//.test(baseUrl) || !token) {
      throw Object.assign(new Error('外部墓碑接收器必须使用 HTTPS 和访问令牌'), {
        code: 'LIFECYCLE_MANIFEST_RECEIVER_INVALID',
      })
    }
  }

  async append(entry: DeletionManifestEntry): Promise<void> {
    const response = await this.fetcher(this.baseUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.token}`,
        'content-type': 'application/json',
        'idempotency-key': `${entry.requestId}:${entry.subjectDigest}`,
      },
      body: JSON.stringify(entry),
    })
    if (!response.ok && response.status !== 409) {
      throw Object.assign(new Error('外部墓碑接收器未确认写入'), {
        code: 'LIFECYCLE_MANIFEST_RECEIVER_FAILED',
      })
    }
  }

  async list(cursor?: string) {
    const url = new URL(this.baseUrl)
    if (cursor) url.searchParams.set('cursor', cursor)
    const response = await this.fetcher(url, {
      headers: { authorization: `Bearer ${this.token}` },
    })
    if (!response.ok) {
      throw Object.assign(new Error('外部墓碑接收器读取失败'), {
        code: 'LIFECYCLE_MANIFEST_RECEIVER_FAILED',
      })
    }
    return response.json() as Promise<{ entries: DeletionManifestEntry[]; nextCursor: string | null }>
  }
}

const readAllManifestEntries = async (source: DeletionManifestSink): Promise<DeletionManifestEntry[]> => {
  const entries: DeletionManifestEntry[] = []
  let cursor: string | undefined
  do {
    const page = await source.list(cursor)
    entries.push(...page.entries)
    cursor = page.nextCursor ?? undefined
  } while (cursor)
  return entries
}

export async function replayDeletionManifest(
  source: DeletionManifestSink,
  database: ManifestReplayDatabase,
  keyring: ManifestKeyring,
): Promise<{ manifestEntries: number; scannedSubjects: number; deletedSubjects: number }> {
  const entries = await readAllManifestEntries(source)
  for (const entry of entries) {
    if (!keyring[entry.keyVersion]) {
      throw Object.assign(new Error('未知墓碑密钥版本'), {
        code: 'LIFECYCLE_MANIFEST_KEY_VERSION_UNKNOWN',
      })
    }
  }

  let scannedSubjects = 0
  let deletedSubjects = 0
  for (const dataRegion of ['CN', 'GLOBAL'] as const) {
    const regionalEntries = entries.filter(entry => entry.dataRegion === dataRegion)
    if (regionalEntries.length === 0) continue
    let afterPublicId: string | null = null
    while (true) {
      const subjects = await database.listSubjects({ dataRegion, afterPublicId, limit: 500 })
      if (subjects.length === 0) break
      scannedSubjects += subjects.length
      const matches = subjects.filter(subject => regionalEntries.some(entry =>
        createSubjectDigest(keyring[entry.keyVersion]!, subject.publicId) === entry.subjectDigest,
      ))
      if (matches.length > 0) {
        deletedSubjects += await database.deleteSubjects(dataRegion, matches.map(subject => subject.publicId))
      }
      afterPublicId = subjects[subjects.length - 1]!.publicId
      if (subjects.length < 500) break
    }
  }
  return { manifestEntries: entries.length, scannedSubjects, deletedSubjects }
}
