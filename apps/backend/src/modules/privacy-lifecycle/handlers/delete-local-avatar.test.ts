import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { deleteLocalAvatar, localAvatarFilename } from './delete-local-avatar'
import type { LifecycleTransaction } from '../services/lifecycle-worker.service'

test('头像删除仅接受固定上传目录中的生成文件名', () => {
  assert.equal(localAvatarFilename('https://qisw.top/wenheng/uploads/avatars/avatar-123-456.png'), 'avatar-123-456.png')
  for (const value of ['/etc/passwd', '/uploads/avatars/other.png', '/uploads/avatars/avatar-1-2.png/../secret', '/uploads/avatars/avatar-1-2%2epng', null]) {
    assert.equal(localAvatarFilename(value), null)
  }
})

test('注销删除实际头像文件，保留共享头像和无关文件，允许重试', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'wenheng-avatar-test-'))
  try {
    await mkdir(path.join(root, 'avatars'))
    const file = path.join(root, 'avatars/avatar-1-2.png')
    const unrelated = path.join(root, 'avatars/unrelated.png')
    await writeFile(file, 'avatar'); await writeFile(unrelated, 'keep')
    const shared = { async query() { return [[{ id: 9 }], null] } } as unknown as LifecycleTransaction
    const unshared = { async query() { return [[], null] } } as unknown as LifecycleTransaction
    await deleteLocalAvatar(shared, 7, '/uploads/avatars/avatar-1-2.png', root)
    assert.equal(await readFile(file, 'utf8'), 'avatar')
    await deleteLocalAvatar(unshared, 7, '/uploads/avatars/avatar-1-2.png', root)
    await assert.rejects(readFile(file), { code: 'ENOENT' })
    await deleteLocalAvatar(unshared, 7, '/uploads/avatars/avatar-1-2.png', root)
    assert.equal(await readFile(unrelated, 'utf8'), 'keep')
  } finally { await rm(root, { recursive: true, force: true }) }
})
