// apps/backend/src/modules/orgs/services/org.service.ts
import type { IOrg, OrgListData, OrgTreeNode } from '../domain/org.model'
import { OrgRepository } from '../repositories/org.repository'
import { LogRepository } from '@/modules/analytics/repositories/log.repository'

function buildTree(rows: IOrg[], parentId: number | null = null): OrgTreeNode[] {
  return rows
    .filter(r => (r.parent_id ?? null) === parentId)
    .sort((a, b) => a.id - b.id)
    .map(r => ({ ...r, children: buildTree(rows, r.id) }))
}

function createsCycle(rows: Array<Pick<IOrg, 'id' | 'parent_id'>>, nodeId: number, newParentId?: number | null) {
  if (newParentId == null) return false
  const map = new Map<number, { parent_id: number | null | undefined }>(rows.map(r => [r.id, r]))
  let cur: number | null | undefined = newParentId
  while (cur != null) {
    if (cur === nodeId) return true
    cur = map.get(cur)?.parent_id ?? null
  }
  return false
}

function makeBaseCode(name?: string) {
  const slug = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || `org_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

async function ensureUniqueCode(base: string): Promise<string> {
  if (!(await OrgRepository.codeExists(base))) return base
  const used = new Set(await OrgRepository.listSimilarCodes(base))
  let i = 1
  while (used.has(`${base}-${i}`)) i++
  return `${base}-${i}`
}

export class OrgService {
  async list(params: {
    page: number
    limit: number
    search?: string
    parentId?: number | null
    includeInactive?: boolean
  }): Promise<OrgListData> {
    const { rows, total } = await OrgRepository.list(params)
    return { orgs: rows, total, page: params.page, limit: params.limit }
  }

  async getTree(includeInactive: boolean): Promise<OrgTreeNode[]> {
    const rows = await OrgRepository.findAll(includeInactive)
    return buildTree(rows)
  }

  async getById(id: number) {
    const row = await OrgRepository.findById(id)
    if (!row) throw new Error('组织不存在')
    return row
  }

  async create(
    user: { id?: number; username?: string } | undefined,
    payload: { name: string; code?: string; parent_id?: number | null; is_active?: boolean },
    reqMeta?: { ip?: string; ua?: string }
  ) {
    const { name, code, parent_id, is_active } = payload
    if (!name || String(name).trim().length === 0) throw new Error('组织名称不能为空')

    let parentId: number | null = null
    if (parent_id !== undefined && parent_id !== null && parent_id !== '') {
      const n = Number(parent_id)
      if (!Number.isNaN(n)) parentId = n
    }
    const finalCode = await ensureUniqueCode(code?.trim() || makeBaseCode(name))
    const id = await OrgRepository.insertOrg({
      name: String(name).trim(),
      code: finalCode,
      parent_id: parentId,
      is_active: is_active ? 1 : 0, // 修正：启用/禁用
    })

    await LogRepository.insertUserLog({
      userId: user?.id || 0,
      username: user?.username,
      action: 'create_org',
      resourceType: 'organization',
      resourceId: id,
      details: { name, code: finalCode, parent_id: parentId },
      ipAddress: reqMeta?.ip,
      userAgent: reqMeta?.ua,
    })

    return { id }
  }

  async update(
    user: { id?: number; username?: string } | undefined,
    id: number,
    patch: Partial<Pick<IOrg, 'name' | 'code' | 'parent_id' | 'is_active'>>,
    reqMeta?: { ip?: string; ua?: string }
  ) {
    if (patch.name !== undefined && !patch.name) throw new Error('组织名称不能为空')

    if (patch.parent_id !== undefined) {
      const rows = await OrgRepository.allForCycleCheck()
      if (createsCycle(rows, id, patch.parent_id ?? null)) throw new Error('不能将组织移动到自身的子孙节点下')
    }

    const affected = await OrgRepository.updateOrg(id, patch)
    if (!affected) throw new Error('组织不存在')

    const row = await OrgRepository.findById(id)
    await LogRepository.insertUserLog({
      userId: user?.id || 0,
      username: user?.username,
      action: 'update_org',
      resourceType: 'organization',
      resourceId: id,
      details: { updatedFields: Object.keys(patch) },
      ipAddress: reqMeta?.ip,
      userAgent: reqMeta?.ua,
    })

    return row!
  }

  async delete(
    user: { id?: number; username?: string } | undefined,
    id: number,
    reqMeta?: { ip?: string; ua?: string }
  ) {
    const existed = await OrgRepository.findById(id)
    if (!existed) throw new Error('组织不存在')
    if (await OrgRepository.hasChildren(id)) throw new Error('请先删除或移动该组织的子节点')
    const affected = await OrgRepository.deleteOrg(id)
    if (!affected) throw new Error('删除组织失败')

    await LogRepository.insertUserLog({
      userId: user?.id || 0,
      username: user?.username,
      action: 'delete_org',
      resourceType: 'organization',
      resourceId: id,
      details: {},
      ipAddress: reqMeta?.ip,
      userAgent: reqMeta?.ua,
    })
    return { message: '组织删除成功' }
  }

  async move(
    user: { id?: number; username?: string } | undefined,
    id: number,
    parent_id: number | null,
    reqMeta?: { ip?: string; ua?: string }
  ) {
    const existed = await OrgRepository.findById(id)
    if (!existed) throw new Error('组织不存在')
    const rows = await OrgRepository.allForCycleCheck()
    if (createsCycle(rows, id, parent_id)) throw new Error('不能将组织移动到自身的子孙节点下')

    await OrgRepository.updateOrg(id, { parent_id })

    await LogRepository.insertUserLog({
      userId: user?.id || 0,
      username: user?.username,
      action: 'move_org',
      resourceType: 'organization',
      resourceId: id,
      details: { parent_id },
      ipAddress: reqMeta?.ip,
      userAgent: reqMeta?.ua,
    })
    return { message: '移动成功' }
  }

  async batchSort(
    user: { id?: number; username?: string } | undefined,
    updates: Array<{ id: number; parent_id?: number | null }>,
    reqMeta?: { ip?: string; ua?: string }
  ) {
    if (!Array.isArray(updates) || updates.length === 0) throw new Error('参数错误：updates 不能为空')

    const rows = await OrgRepository.allForCycleCheck()
    for (const u of updates) {
      const pid = u.parent_id ?? rows.find(r => r.id === u.id)?.parent_id ?? null
      if (createsCycle(rows, u.id, pid)) throw new Error(`更新将导致层级循环：id=${u.id}`)
    }
    for (const u of updates) {
      const patch: any = {}
      if (u.parent_id !== undefined) patch.parent_id = u.parent_id
      if (Object.keys(patch).length) await OrgRepository.updateOrg(u.id, patch)
    }

    await LogRepository.insertUserLog({
      userId: user?.id || 0,
      username: user?.username,
      action: 'batch_update_org_parent',
      resourceType: 'organization',
      resourceId: 0,
      details: { kind: 'batch', count: updates.length },
      ipAddress: reqMeta?.ip,
      userAgent: reqMeta?.ua,
    })
    return { message: '批量更新成功' }
  }
}
