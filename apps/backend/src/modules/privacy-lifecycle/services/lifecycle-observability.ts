import type { DataRegion, LifecycleCategoryCode, LifecycleStatus } from '../domain/lifecycle.model'

export type LifecycleMetricLabels = {
  dataRegion?: DataRegion
  category?: LifecycleCategoryCode
  status?: LifecycleStatus | 'SUCCESS' | 'RETRY' | 'ATTENTION_REQUIRED'
  errorCode?: string
}

const ALLOWED_LABELS = new Set(['dataRegion', 'category', 'status', 'errorCode'])
const STABLE_ERROR_CODE = /^LIFECYCLE_[A-Z0-9_]{1,80}$/

export function sanitizeLifecycleMetricLabels(labels: Record<string, unknown>): LifecycleMetricLabels {
  for (const key of Object.keys(labels)) {
    if (!ALLOWED_LABELS.has(key)) {
      throw Object.assign(new Error(`生命周期指标禁止标签：${key}`), {
        code: 'LIFECYCLE_METRIC_LABEL_FORBIDDEN',
      })
    }
  }
  if (labels.dataRegion != null && labels.dataRegion !== 'CN' && labels.dataRegion !== 'GLOBAL') {
    throw Object.assign(new Error('生命周期指标区域标签无效'), { code: 'LIFECYCLE_METRIC_LABEL_FORBIDDEN' })
  }
  if (labels.errorCode != null && !STABLE_ERROR_CODE.test(String(labels.errorCode))) {
    throw Object.assign(new Error('生命周期指标错误码必须是稳定枚举'), {
      code: 'LIFECYCLE_METRIC_LABEL_FORBIDDEN',
    })
  }
  return { ...labels } as LifecycleMetricLabels
}

export type LifecycleMetricEvent = {
  name: string
  value: number
  labels: LifecycleMetricLabels
}

export interface LifecycleMetrics {
  record(name: string, value: number, labels: LifecycleMetricLabels): void
}

export class MemoryLifecycleMetrics implements LifecycleMetrics {
  readonly events: LifecycleMetricEvent[] = []

  record(name: string, value: number, labels: LifecycleMetricLabels): void {
    this.events.push({ name, value, labels: sanitizeLifecycleMetricLabels(labels as Record<string, unknown>) })
  }
}

export class NoopLifecycleMetrics implements LifecycleMetrics {
  record(_name: string, _value: number, labels: LifecycleMetricLabels): void {
    sanitizeLifecycleMetricLabels(labels as Record<string, unknown>)
  }
}
