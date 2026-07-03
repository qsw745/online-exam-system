import { translate } from '@/shared/utils/i18n'

// 统一的任务状态字典（英文枚举 ↔ 显示文案 key & 颜色）
export type TaskStatus = 'not_started' | 'in_progress' | 'completed' | 'expired' | 'published' | 'unpublished' | 'draft'

export const TASK_STATUS_DICT: Record<
  TaskStatus,
  { labelKey: string; color: 'default' | 'processing' | 'success' | 'warning' | 'error' }
> = {
  not_started: { labelKey: 'auto.5349eb3e57', color: 'default' },
  in_progress: { labelKey: 'dashboard.status_in_progress', color: 'processing' },
  completed: { labelKey: 'dashboard.status_completed', color: 'success' },
  expired: { labelKey: 'dashboard.status_expired', color: 'error' },
  published: { labelKey: 'auto.176a2eb4eb', color: 'processing' }, // 可开始（在时间窗口内）
  unpublished: { labelKey: 'auto.5a65ae692a', color: 'warning' },
  draft: { labelKey: 'auto.0f436818c0', color: 'default' },
}

export const getTaskStatusOptions = () => (Object.keys(TASK_STATUS_DICT) as TaskStatus[]).map(k => ({
  label: translate(TASK_STATUS_DICT[k].labelKey),
  value: k,
}))

export function getTaskStatusLabel(s?: string) {
  const meta = TASK_STATUS_DICT[s as TaskStatus]
  return meta ? translate(meta.labelKey) : (s || '-')
}

export function getTaskStatusColor(s?: string) {
  const meta = TASK_STATUS_DICT[s as TaskStatus]
  return meta?.color ?? 'default'
}

/** 是否允许运行（进入考试/练习），仅按状态判断；时间窗口由业务再校验 */
export function isStartableStatus(s?: string) {
  return s === 'not_started' || s === 'in_progress' || s === 'published'
}
