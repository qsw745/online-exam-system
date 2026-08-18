import { api } from '@/shared/api/http'
import type { NotificationAttachment } from './notifications'

/** 收件箱条目来源：通知 / 消息 / 待办 */
export type InboxKind = 'notice' | 'message' | 'todo'

export interface InboxItem {
  /** 跨来源唯一键，形如 `notice-12` */
  uid: string
  id: number
  kind: InboxKind
  title: string
  content: string
  /** 业务级别：info / success / warning / error */
  level: string
  /** 通知与消息为已读；待办为已完成 */
  is_read: boolean
  /** 来源模块，例如 exam / workflow / system */
  source: string | null
  /** 前端跳转路径 */
  target_path: string | null
  metadata: Record<string, any> | null
  created_at: string
  attachments: NotificationAttachment[]
}

const parseJson = (raw: any) => {
  if (!raw) return null
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(String(raw))
  } catch {
    return null
  }
}

const pickList = (resp: any, key: string): any[] => {
  const d = resp?.data ?? resp
  if (Array.isArray(d)) return d
  if (Array.isArray(d?.[key])) return d[key]
  if (Array.isArray(d?.items)) return d.items
  return []
}

const toItem = (kind: InboxKind, raw: any): InboxItem => {
  const attachments = parseJson(raw?.attachments)
  return {
    uid: `${kind}-${raw?.id}`,
    id: Number(raw?.id),
    kind,
    title: String(raw?.title ?? ''),
    content: String(raw?.content ?? ''),
    level: String(raw?.type ?? 'info'),
    is_read: kind === 'todo' ? Boolean(raw?.done ?? raw?.is_done) : Boolean(raw?.is_read ?? raw?.read),
    source: raw?.source ?? null,
    target_path: raw?.target_path ?? raw?.targetPath ?? null,
    metadata: parseJson(raw?.metadata),
    created_at: raw?.created_at ?? raw?.createdAt ?? '',
    attachments: Array.isArray(attachments) ? (attachments as NotificationAttachment[]) : [],
  }
}

const sortByTimeDesc = (a: InboxItem, b: InboxItem) =>
  new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()

export const inboxApi = {
  /** 聚合拉取通知 / 消息 / 待办，单个来源失败不影响其余来源 */
  async listAll(): Promise<InboxItem[]> {
    const [notice, message, todo] = await Promise.allSettled([
      api.get('/notifications'),
      api.get('/messages'),
      api.get('/todos'),
    ])
    const items: InboxItem[] = []
    if (notice.status === 'fulfilled') {
      items.push(...pickList(notice.value, 'notifications').map(r => toItem('notice', r)))
    }
    if (message.status === 'fulfilled') {
      items.push(...pickList(message.value, 'messages').map(r => toItem('message', r)))
    }
    if (todo.status === 'fulfilled') {
      items.push(...pickList(todo.value, 'todos').map(r => toItem('todo', r)))
    }
    return items.sort(sortByTimeDesc)
  },

  /** 标记单条为已读（待办为已完成） */
  markRead(item: Pick<InboxItem, 'kind' | 'id'>) {
    if (item.kind === 'notice') return api.put(`/notifications/${item.id}/read`)
    if (item.kind === 'message') return api.put(`/messages/${item.id}/read`)
    return api.put(`/todos/${item.id}/done`)
  },

  /**
   * 批量标记。不传 kind 时只处理通知与消息：
   * 待办"完成"是业务动作而非阅读状态，必须由调用方显式指定 kind='todo'。
   */
  async markAllRead(kind?: InboxKind) {
    if (kind === 'todo') {
      await api.put('/todos/done-all')
      return
    }
    const jobs: Array<Promise<unknown>> = []
    if (!kind || kind === 'notice') jobs.push(api.put('/notifications/read-all'))
    if (!kind || kind === 'message') jobs.push(api.put('/messages/read-all'))
    await Promise.allSettled(jobs)
  },

  remove(item: Pick<InboxItem, 'kind' | 'id'>) {
    if (item.kind === 'notice') return api.delete(`/notifications/${item.id}`)
    if (item.kind === 'message') return api.delete(`/messages/${item.id}`)
    return api.delete(`/todos/${item.id}`)
  },
}

export default inboxApi
