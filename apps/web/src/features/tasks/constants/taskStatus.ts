// 统一的任务状态字典（英文枚举 ↔ 中文显示 & 颜色）
export type TaskStatus = 'not_started' | 'in_progress' | 'completed' | 'expired' | 'published' | 'unpublished' | 'draft'

export const TASK_STATUS_DICT: Record<
  TaskStatus,
  { label: string; color: 'default' | 'processing' | 'success' | 'warning' | 'error' }
> = {
  not_started: { label: '待开始', color: 'default' },
  in_progress: { label: '进行中', color: 'processing' },
  completed: { label: '已完成', color: 'success' },
  expired: { label: '已过期', color: 'error' },
  published: { label: '已发布', color: 'processing' }, // 可开始（在时间窗口内）
  unpublished: { label: '未发布', color: 'warning' },
  draft: { label: '草稿', color: 'default' },
}

export const TASK_STATUS_OPTIONS = (Object.keys(TASK_STATUS_DICT) as TaskStatus[]).map(k => ({
  label: TASK_STATUS_DICT[k].label,
  value: k,
}))

export function getTaskStatusLabel(s?: string) {
  const meta = TASK_STATUS_DICT[s as TaskStatus]
  return meta?.label ?? (s || '-')
}

export function getTaskStatusColor(s?: string) {
  const meta = TASK_STATUS_DICT[s as TaskStatus]
  return meta?.color ?? 'default'
}

/** 是否允许运行（进入考试/练习），仅按状态判断；时间窗口由业务再校验 */
export function isStartableStatus(s?: string) {
  return s === 'not_started' || s === 'in_progress' || s === 'published'
}
