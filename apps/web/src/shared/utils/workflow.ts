import type { WorkflowTemplate } from '@/shared/api/endpoints/workflows'
import { translate } from '@/shared/utils/i18n'

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

const STATUS_KEYS: Record<string, string> = {
  pending: 'workflow.status_pending',
  approved: 'workflow.status_approved',
  rejected: 'workflow.status_rejected',
  canceled: 'workflow.status_canceled',
  running: 'workflow.status_running',
  published: 'workflow.status_published',
  draft: 'workflow.status_draft',
}

export const workflowStatusLabel = (status?: string) => {
  if (!status) return '-'
  const key = STATUS_KEYS[status]
  return key ? translate(key) : status
}

const ENTITY_KEYS: Record<string, string> = {
  paper: 'workflow.entity_paper',
  exam: 'workflow.entity_exam',
}

/** 实体类型对应的 i18n key；组件内应优先用它配合 useLanguage 的 t()，以便切换语言时重渲染 */
export const workflowEntityLabelKey = (entityType?: string) => (entityType ? ENTITY_KEYS[entityType] : undefined)

/** 实体类型的可读名称，供无法使用 hook 的场景（非响应式，与 workflowStatusLabel 一致） */
export const workflowEntityLabel = (entityType?: string) => {
  if (!entityType) return '-'
  const key = workflowEntityLabelKey(entityType)
  return key ? translate(key) : entityType
}
