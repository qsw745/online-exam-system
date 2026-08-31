import { readFile } from 'node:fs/promises'

import { pool } from '../../src/config/database'
import type { DataRegion } from '../../src/modules/privacy-lifecycle/domain/lifecycle.model'
import {
  parseManifestKeyring,
  replayDeletionManifest,
  type DeletionManifestEntry,
  type DeletionManifestSink,
  type ManifestReplayDatabase,
} from '../../src/modules/privacy-lifecycle/services/deletion-manifest.service'

type Options = { source: string; dataRegion: DataRegion; execute: boolean }

const parseOptions = (argv: readonly string[]): Options => {
  const source = argv.find(value => value.startsWith('--source='))?.slice('--source='.length) ?? ''
  const region = argv.find(value => value.startsWith('--data-region='))?.slice('--data-region='.length)
  const dryRun = argv.includes('--dry-run')
  const execute = argv.includes('--execute')
  if (!source || (region !== 'CN' && region !== 'GLOBAL') || dryRun === execute) {
    throw Object.assign(
      new Error('用法：--source=<jsonl> --data-region=<CN|GLOBAL> (--dry-run|--execute)'),
      { code: 'LIFECYCLE_MANIFEST_REPLAY_OPTIONS_INVALID' },
    )
  }
  return { source, dataRegion: region, execute }
}

class ReadOnlyJsonlManifestSource implements DeletionManifestSink {
  private entries?: DeletionManifestEntry[]
  constructor(private readonly filePath: string, private readonly dataRegion: DataRegion) {}
  async append(): Promise<void> {
    throw Object.assign(new Error('恢复源只读'), { code: 'LIFECYCLE_MANIFEST_SOURCE_READ_ONLY' })
  }
  private async readAll() {
    if (!this.entries) {
      const content = await readFile(this.filePath, 'utf8')
      this.entries = content
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line) as DeletionManifestEntry)
        .filter(entry => entry.dataRegion === this.dataRegion)
    }
    return this.entries
  }
  async list(cursor = '0') {
    const entries = await this.readAll()
    const offset = Math.max(0, Number.parseInt(cursor, 10) || 0)
    const page = entries.slice(offset, offset + 1_000)
    const next = offset + page.length
    return { entries: page, nextCursor: next < entries.length ? String(next) : null }
  }
}

class MysqlManifestReplayDatabase implements ManifestReplayDatabase {
  constructor(private readonly dataRegion: DataRegion, private readonly execute: boolean) {}
  async listSubjects(input: { dataRegion: DataRegion; afterPublicId: string | null; limit: number }) {
    if (input.dataRegion !== this.dataRegion) return []
    const [rows] = await (pool as any).query(
      `SELECT public_id AS publicId FROM users
        WHERE data_region=? AND public_id>? ORDER BY public_id LIMIT ?`,
      [input.dataRegion, input.afterPublicId ?? '', input.limit],
    )
    return rows as Array<{ publicId: string }>
  }
  async deleteSubjects(dataRegion: DataRegion, publicIds: readonly string[]) {
    if (dataRegion !== this.dataRegion || publicIds.length === 0) return 0
    if (!this.execute) return publicIds.length
    const connection = await (pool as any).getConnection()
    try {
      await connection.beginTransaction()
      const marks = publicIds.map(() => '?').join(',')
      const [result] = await connection.query(
        `DELETE FROM users WHERE data_region=? AND public_id IN (${marks})`,
        [dataRegion, ...publicIds],
      )
      await connection.commit()
      return Number(result.affectedRows || 0)
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2))
  try {
    const summary = await replayDeletionManifest(
      new ReadOnlyJsonlManifestSource(options.source, options.dataRegion),
      new MysqlManifestReplayDatabase(options.dataRegion, options.execute),
      parseManifestKeyring(process.env),
    )
    console.log(JSON.stringify({
      mode: options.execute ? 'EXECUTE' : 'DRY_RUN',
      dataRegion: options.dataRegion,
      ...summary,
    }))
  } finally {
    await pool.end()
  }
}

void main().catch(error => {
  console.error(JSON.stringify({ status: 'FAILED', code: String(error?.code || 'LIFECYCLE_MANIFEST_REPLAY_FAILED') }))
  process.exitCode = 1
})
