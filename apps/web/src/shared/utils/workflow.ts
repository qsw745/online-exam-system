import type { WorkflowTemplate } from '@/shared/api/endpoints/workflows'

export const pickLatestTemplates = (items: WorkflowTemplate[]) => {
  const map = new Map<string, WorkflowTemplate>()
  for (const item of items || []) {
    const key = `${item.name}::${item.entity_type}`
    const existing = map.get(key)
    if (!existing) {
      map.set(key, item)
      continue
    }
    const version = Number(item.version || 0)
    const existingVersion = Number(existing.version || 0)
    if (version > existingVersion) {
      map.set(key, item)
      continue
    }
    if (version === existingVersion) {
      const existingTime = existing.updated_at ? new Date(existing.updated_at).getTime() : 0
      const itemTime = item.updated_at ? new Date(item.updated_at).getTime() : 0
      if (itemTime > existingTime) map.set(key, item)
    }
  }
  return Array.from(map.values())
}

export const workflowStatusLabel = (status?: string) => {
  if (!status) return '-'
  if (status === 'pending') return '待处理'
  if (status === 'approved') return '已通过'
  if (status === 'rejected') return '已驳回'
  if (status === 'canceled') return '已取消'
  if (status === 'running') return '进行中'
  if (status === 'published') return '已启动'
  if (status === 'draft') return '已停止'
  return status
}
