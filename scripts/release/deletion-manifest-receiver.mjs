// Independent durable deletion receipts; contains no email, account ID or raw identity.
import { createServer } from 'node:http'
import { timingSafeEqual, randomUUID } from 'node:crypto'
import { mkdir, open, readdir, readFile, rename, unlink } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const digest = /^[0-9a-f]{64}$/
const retentionMs = 1095 * 86400000
export function createReceiver({ directory, token, clock = () => Date.now() }) {
  if (!token || token.length < 32) throw new Error('Receiver token is required')
  const expected = Buffer.from(`Bearer ${token}`)
  let mutations = Promise.resolve()
  const serial = operation => {
    const next = mutations.then(operation)
    mutations = next.catch(() => {})
    return next
  }
  const reply = (response, status, body) => {
    response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    response.end(JSON.stringify(body))
  }
  return createServer(async (request, response) => {
    try {
      const actual = Buffer.from(request.headers.authorization || '')
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return reply(response, 401, { error: 'unauthorized' })
      const url = new URL(request.url, 'http://localhost')
      if (url.pathname !== '/wenheng/internal/deletion-manifest') return reply(response, 404, { error: 'not_found' })
      await mkdir(directory, { recursive: true, mode: 0o700 })
      if (request.method === 'POST') {
        let length = 0
        const chunks = []
        for await (const chunk of request) {
          length += chunk.length
          if (length > 4096) return reply(response, 413, { error: 'body_too_large' })
          chunks.push(chunk)
        }
        let entry
        try { entry = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { return reply(response, 400, { error: 'invalid_json' }) }
        const fields = ['completedAt', 'dataRegion', 'keyVersion', 'requestId', 'subjectDigest']
        if (!entry || JSON.stringify(Object.keys(entry).sort()) !== JSON.stringify(fields) ||
            !uuid.test(entry.requestId) || !digest.test(entry.subjectDigest) ||
            !['CN', 'GLOBAL'].includes(entry.dataRegion) || entry.keyVersion !== 'v1' ||
            !Number.isFinite(Date.parse(entry.completedAt)) || new Date(entry.completedAt).toISOString() !== entry.completedAt ||
            Date.parse(entry.completedAt) > clock() + 300000 || clock() - Date.parse(entry.completedAt) > retentionMs ||
            request.headers['idempotency-key'] !== `${entry.requestId}:${entry.subjectDigest}`) {
          return reply(response, 400, { error: 'invalid_entry' })
        }
        const status = await serial(async () => {
          const destination = path.join(directory, `${entry.requestId}.json`)
          try {
            const existing = JSON.parse(await readFile(destination, 'utf8'))
            return fields.every(key => existing[key] === entry[key]) ? 200 : 422
          } catch (error) { if (error.code !== 'ENOENT') throw error }
          const temporary = path.join(directory, `.${randomUUID()}.tmp`)
          const file = await open(temporary, 'wx', 0o600)
          try { await file.writeFile(JSON.stringify(entry)); await file.sync() } finally { await file.close() }
          await rename(temporary, destination)
          const dir = await open(directory, 'r')
          try { await dir.sync() } finally { await dir.close() }
          return 201
        })
        return reply(response, status, { stored: status < 300 })
      }
      if (request.method === 'GET') {
        const cursor = url.searchParams.get('cursor') || ''
        if (cursor && !uuid.test(cursor)) return reply(response, 400, { error: 'invalid_cursor' })
        const entries = await serial(async () => {
          const valid = []
          for (const name of (await readdir(directory)).filter(name => name.endsWith('.json')).sort()) {
            const entry = JSON.parse(await readFile(path.join(directory, name), 'utf8'))
            if (clock() - Date.parse(entry.completedAt) > retentionMs) { await unlink(path.join(directory, name)); continue }
            if (entry.requestId > cursor) valid.push(entry)
          }
          return valid
        })
        return reply(response, 200, { entries: entries.slice(0, 200), nextCursor: entries.length > 200 ? entries[199].requestId : null })
      }
      return reply(response, 405, { error: 'method_not_allowed' })
    } catch {
      return reply(response, 500, { error: 'storage_unavailable' })
    }
  })
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const server = createReceiver({ directory: process.env.MANIFEST_DIRECTORY || '/var/lib/wenheng-manifests', token: process.env.DELETION_MANIFEST_RECEIVER_TOKEN })
  server.requestTimeout = 15000
  server.listen(Number(process.env.PORT || 3083), process.env.HOST || '127.0.0.1')
}
