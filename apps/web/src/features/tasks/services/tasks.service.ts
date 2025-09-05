// features/tasks/services/tasks.service.ts
import * as api from '@shared/api/http'
import type { Task } from '../types'

type ApiResult<T> = { success: true; data: T } | { success: false; error?: string }

const normalizeList = (payload: any): { rows: Task[]; total: number } => {
  if (Array.isArray(payload?.tasks))
    return { rows: payload.tasks, total: payload?.pagination?.total ?? payload?.total ?? payload.tasks.length }
  if (Array.isArray(payload)) return { rows: payload, total: payload.length }
  if (Array.isArray(payload?.data)) return { rows: payload.data, total: payload?.total ?? payload.data.length }
  return { rows: [], total: 0 }
}

export const tasksService = {
  async list(params: any) {
    const r: ApiResult<any> = await api.tasks.list(params)
    if (!r.success) throw new Error(r.error || '加载任务失败')
    return normalizeList(r.data)
  },
  async getById(id: string) {
    const r: ApiResult<any> = await api.tasks.getById(id)
    if (!r.success) throw new Error(r.error || '加载任务失败')
    const d = (r.data as any)?.task ?? r.data
    if (!d) throw new Error('任务数据为空')
    return d as Task
  },
  async create(payload: any) {
    const r: ApiResult<any> = await api.tasks.create(payload)
    if (!r.success) throw new Error(r.error || '创建任务失败')
  },
  async update(id: string, payload: any) {
    const r: ApiResult<any> = await api.tasks.update(id, payload)
    if (!r.success) throw new Error(r.error || '更新任务失败')
  },
  async delete(id: string) {
    const r: ApiResult<any> = await api.tasks.delete(id)
    if (!r.success) throw new Error(r.error || '删除任务失败')
  },
  async publish(id: string) {
    const r: ApiResult<any> = await api.tasks.publish(id)
    if (!r.success) throw new Error(r.error || '发布任务失败')
  },
  async unpublish(id: string) {
    const r: ApiResult<any> = await api.tasks.unpublish(id)
    if (!r.success) throw new Error(r.error || '取消发布失败')
  },
}
