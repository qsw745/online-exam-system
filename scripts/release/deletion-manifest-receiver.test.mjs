import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { once } from 'node:events'
import { randomUUID, randomBytes } from 'node:crypto'
import { createReceiver } from './deletion-manifest-receiver.mjs'

test('receiver authenticates, rejects identity fields, persists receipts and rejects conflicting replays', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'wenheng-manifest-test-'))
  const token = randomBytes(32).toString('base64url')
  const start = async () => {
    const server = createReceiver({ directory, token })
    server.listen(0, '127.0.0.1'); await once(server, 'listening')
    return { server, url: `http://127.0.0.1:${server.address().port}/wenheng/internal/deletion-manifest` }
  }
  let { server, url } = await start()
  const entry = { requestId: randomUUID(), dataRegion: 'CN', subjectDigest: 'a'.repeat(64), keyVersion: 'v1', completedAt: new Date().toISOString() }
  const headers = { Authorization: `Bearer ${token}`, 'idempotency-key': `${entry.requestId}:${entry.subjectDigest}` }
  const post = body => fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  try {
    assert.equal((await fetch(url)).status, 401)
    assert.equal((await post({ ...entry, email: 'must-not-store@example.invalid' })).status, 400)
    assert.equal((await post(entry)).status, 201)
    assert.equal((await post(entry)).status, 200)
    assert.equal((await post({ ...entry, dataRegion: 'GLOBAL' })).status, 422)
    await new Promise(resolve => server.close(resolve))
    ;({ server, url } = await start())
    assert.deepEqual((await (await fetch(url, { headers })).json()).entries, [entry])
  } finally {
    await new Promise(resolve => server.close(resolve))
    await rm(directory, { recursive: true })
  }
})
