import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdtemp, mkdir, writeFile, access, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import bcrypt from 'bcryptjs'
import { pool } from '../../src/config/database'
import { AccountDeletionRepository } from '@/modules/account/repositories/account-deletion.repository'
import { AccountDeletionService } from '@/modules/account/services/account-deletion.service'
import { createLifecycleHandlerMap } from '@/modules/privacy-lifecycle/handlers'
import { LifecycleWorkerRepository } from '@/modules/privacy-lifecycle/repositories/lifecycle-worker.repository'
import { createDeletionManifestStager, MemoryDeletionManifestSink } from '@/modules/privacy-lifecycle/services/deletion-manifest.service'
import { NoopLifecycleMetrics } from '@/modules/privacy-lifecycle/services/lifecycle-observability'
import { LifecycleSchemaAuditService } from '@/modules/privacy-lifecycle/services/lifecycle-schema-audit.service'
import { runLifecycleWorkerOnce } from '@/modules/privacy-lifecycle/services/lifecycle-worker.service'
import { recordQuestionPractice } from '@/modules/questions/repositories/practice-record'
import { LearningProgressRepository } from '@/modules/learning-progress/repositories/learning-progress.repository'

// Only an explicitly named disposable database may run this destructive smoke test.
async function main() {
  assert.match(process.env.DB_NAME || '', /^wenheng_release_validation_\d{8}$/)
  const [database] = await pool.query('SELECT DATABASE() AS name')
  assert.equal((database as any[])[0].name, process.env.DB_NAME)
  await new LifecycleSchemaAuditService(pool as any).inspect()
  const key = randomBytes(32)
  process.env.LIFECYCLE_OUTBOX_KEY_V1 = key.toString('base64')
  const requestId = randomUUID()
  const email = `release-smoke-${requestId}@example.invalid`
  const password = randomBytes(24).toString('base64url')
  const avatarRoot = await mkdtemp(path.join(os.tmpdir(), 'wenheng-mysql-avatar-'))
  process.env.UPLOADS_DIR = avatarRoot
  const avatarName = `avatar-${Date.now()}-123456.png`
  const avatarPath = path.join(avatarRoot, 'avatars', avatarName)
  await mkdir(path.join(avatarRoot, 'avatars'))
  await writeFile(avatarPath, 'disposable smoke-test avatar')
  const [created] = await pool.query(
    'INSERT INTO users(username,email,password,public_id,data_region,email_verified,avatar_url) VALUES(?,?,?,?,?,1,?)',
    [email, email, bcrypt.hashSync(password, 10), randomUUID(), 'CN', `/uploads/avatars/${avatarName}`],
  )
  const userId = (created as any).insertId
  await pool.query('INSERT INTO user_settings(user_id,settings) VALUES(?,?)', [userId, JSON.stringify({ theme: 'light' })])
  const [book] = await pool.query('INSERT INTO wrong_question_books(user_id,name) VALUES(?,?)', [userId, '发布验证错题本'])
  const bookId = (book as any).insertId
  const [questions] = await pool.query('SELECT id FROM questions ORDER BY id LIMIT 1')
  assert.ok((questions as any[]).length)
  await pool.query('INSERT INTO wrong_questions(book_id,question_id,notes) VALUES(?,?,?)', [bookId, (questions as any[])[0].id, '待删除的个人笔记'])
  const practiceConnection = await pool.getConnection()
  try {
    await practiceConnection.beginTransaction()
    await recordQuestionPractice(practiceConnection, userId, (questions as any[])[0].id, true, ['test-correct'])
    await recordQuestionPractice(practiceConnection, userId, (questions as any[])[0].id, false, ['test-wrong'])
    await practiceConnection.commit()
  } catch (error) { await practiceConnection.rollback(); throw error }
  finally { practiceConnection.release() }
  const practiceStats = await new LearningProgressRepository().totalStats(userId, undefined, undefined)
  assert.equal(Number(practiceStats.total_questions), 2)
  assert.equal(Number(practiceStats.correct_answers), 1)
  const statusToken = randomBytes(32).toString('base64url')
  const account = new AccountDeletionService(AccountDeletionRepository)
  await account.request(userId, { requestId, statusToken, password, mode: 'IMMEDIATE', confirmationPhrase: '删除问衡账号' })
  const sink = new MemoryDeletionManifestSink()
  const handlers = createLifecycleHandlerMap({
    manifest: createDeletionManifestStager({ keyring: { v1: key }, outboxKeyring: { v1: key } }),
    manifestSink: sink,
  })
  const repository = new LifecycleWorkerRepository()
  for (let n = 0; n < 100; n++) {
    const result = await runLifecycleWorkerOnce({ repository, handlers, metrics: new NoopLifecycleMetrics(), workerId: 'release-mysql-smoke', dataRegion: 'CN', now: new Date(), leaseMs: 30000, batchSize: 100 })
    if (result.retried || result.attentionRequired) {
      const [steps] = await pool.query('SELECT step_code,status,last_error_code FROM data_lifecycle_steps WHERE request_id=?', [requestId])
      console.log(JSON.stringify(steps))
      throw new Error('生命周期数据库烟雾测试失败')
    }
    if (!result.claimed) break
  }
  const status = await account.status({ requestId, statusToken })
  if (status.status === 'NOT_REQUESTED') throw new Error('未找到测试注销请求')
  assert.match(status.status, /^COMPLETED/)
  const [remaining] = await pool.query('SELECT id FROM users WHERE id=?', [userId])
  assert.equal((remaining as any[]).length, 0)
  assert.equal((await sink.list()).entries.filter(entry => entry.requestId === requestId).length, 1)
  const [wrong] = await pool.query('SELECT id FROM wrong_questions WHERE book_id=?', [bookId])
  assert.equal((wrong as any[]).length, 0)
  const [settings] = await pool.query('SELECT user_id FROM user_settings WHERE user_id=?', [userId])
  assert.equal((settings as any[]).length, 0)
  assert.equal(status.steps?.length, 13)
  await assert.rejects(access(avatarPath), { code: 'ENOENT' })
  await rm(avatarRoot, { recursive: true, force: true })
  console.log(JSON.stringify({ database: process.env.DB_NAME, status: status.status, steps: status.steps?.length, accountRemoved: true, avatarRemoved: true, practiceProgressSynced: true, manifestRecorded: true, emailSent: false }))
}
main().then(() => pool.end()).then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1) })
