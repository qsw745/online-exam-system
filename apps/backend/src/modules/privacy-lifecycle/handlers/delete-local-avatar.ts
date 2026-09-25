import { unlink } from 'node:fs/promises'
import path from 'node:path'
import type { LifecycleTransaction } from '../services/lifecycle-worker.service'

// 只处理本服务上传器生成的文件名，不跟随远程 URL 或用户提供的路径。
export function localAvatarFilename(value: unknown): string | null {
  if (typeof value !== 'string') return null
  let pathname: string
  try { pathname = new URL(value, 'https://local.invalid').pathname } catch { return null }
  const match = pathname.match(/\/uploads\/avatars\/(avatar-\d+-\d+\.[a-zA-Z0-9]{1,10})$/)
  return match?.[1] ?? null
}

export async function deleteLocalAvatar(
  connection: LifecycleTransaction, userId: number, avatarUrl: unknown,
  uploadsRoot = process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'uploads'),
): Promise<void> {
  const filename = localAvatarFilename(avatarUrl)
  if (!filename) return
  const [references] = await connection.query(
    'SELECT id FROM users WHERE id<>? AND avatar_url LIKE ? LIMIT 1',
    [userId, `%/uploads/avatars/${filename}`],
  )
  if (Array.isArray(references) && references.length) return
  try { await unlink(path.join(uploadsRoot, 'avatars', filename)) }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
}
