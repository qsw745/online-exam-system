// apps/backend/src/modules/orgs/services/org.service.ts
import HttpError from '@/common/errors/http-error'
import { LogService } from '@/modules/logs/services/log.service'
import type { IOrg, OrgListData, OrgTreeNode } from '../domain/org.model'
import { OrgRepository } from '../repositories/org.repository'

// 放文件顶部
let RC: any = null
;(async () => {
  try {
    RC = (await import('@/common/redis/cache')).default || (await import('@/common/redis/cache'))
  } catch {}
})()
const ORG_TTL = 600
const kOrg = (inactive: boolean) => `org:tree:${inactive ? 1 : 0}`
async function cget<T = any>(k: string) {
  try {
    const v = await RC?.get?.(k)
    return v ? JSON.parse(v) : null
  } catch {
    return null
  }
}
async function cset(k: string, v: any, ttl = ORG_TTL) {
  try {
    await RC?.set?.(k, JSON.stringify(v), ttl)
  } catch {}
}
async function cdel(...ks: string[]) {
  try {
    for (const k of ks) await RC?.del?.(k)
  } catch {}
}

/** ---------- tree & cycle utils ---------- */
function buildTree(rows: IOrg[], parentId: number | null = null): OrgTreeNode[] {
  return rows
    .filter(r => (r.parent_id ?? null) === parentId)
    .sort((a, b) => a.id - b.id)
    .map(r => ({ ...r, children: buildTree(rows, r.id) }))
}

function createsCycle(rows: Array<Pick<IOrg, 'id' | 'parent_id'>>, nodeId: number, newParentId?: number | null) {
  if (newParentId == null) return false
  // 用 parent_id 的规范化值作为 Map 的 value
  const map = new Map<number, number | null>(rows.map(r => [r.id, r.parent_id ?? null] as [number, number | null]))
  let cur: number | null | undefined = newParentId
  while (cur != null) {
    if (cur === nodeId) return true
    cur = map.get(cur) ?? null
  }
  return false
}

/** ---------- code helpers ---------- */
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

/** ---------- service ---------- */
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
    const ck = kOrg(includeInactive)
    const hit = await cget<OrgTreeNode[]>(ck)
    if (hit) return hit
    const rows = await OrgRepository.findAll(includeInactive)
    const tree = buildTree(rows)
    await cset(ck, tree, 600)
    return tree
  }

  async getById(id: number) {
    const row = await OrgRepository.findById(id)
    if (!row) throw new Error('组织不存在')
    return row
  }

  async create(
    user: { id?: number; username?: string } | undefined,
    payload: { name: string; code?: string; parent_id?: number | string | null; is_active?: boolean | 0 | 1 },
    reqMeta?: { ip?: string; ua?: string }
  ) {
    const { name, code, parent_id, is_active } = payload
    if (!name || String(name).trim().length === 0) throw new Error('组织名称不能为空')

    // parent_id 规范化
    let parentId: number | null = null

    if (parent_id !== undefined && parent_id !== null && parent_id !== '') {
      const n = Number(parent_id) // 既支持字符串也支持数字
      if (!Number.isNaN(n)) parentId = n
    }

    const finalCode = await ensureUniqueCode(code?.toString().trim() || makeBaseCode(name))
    // 未传 is_active 时默认启用（1）
    const activeFlag: 0 | 1 = is_active === undefined ? 1 : is_active === true || is_active === 1 ? 1 : 0

    const id = await OrgRepository.insertOrg({
      name: String(name).trim(),
      code: finalCode,
      parent_id: parentId,
      is_active: activeFlag,
    })

    await LogService.log(
      {
        type: 'audit',
        userId: user?.id,
        username: user?.username,
        action: '创建组织',
        message: `创建组织成功：${name}（编码：${finalCode}，上级：${parentId ?? '无'}）`,
        resourceType: 'organization',
        resourceId: id,
        status: 'success',
        details: { name, code: finalCode, parent_id: parentId, is_active: activeFlag },
      },
      // 传入 req 元信息
      {
        ip: reqMeta?.ip as any,
        get: (h: string) => (h.toLowerCase() === 'user-agent' ? reqMeta?.ua || '' : '') as any,
      } as any
    )
    await cdel(kOrg(false), kOrg(true))

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
      if (createsCycle(rows, id, patch.parent_id ?? null)) {
        throw new HttpError('不能将组织移动到自身的子孙节点下')
      }
    }

    const affected = await OrgRepository.updateOrg(id, patch)
    if (!affected) throw new Error('组织不存在')

    const row = await OrgRepository.findById(id)

    await LogService.log(
      {
        type: 'audit',
        userId: user?.id,
        username: user?.username,
        action: '更新组织',
        message: `更新组织成功：#${id}（变更字段：${Object.keys(patch).join(', ') || '无'}）`,
        resourceType: 'organization',
        resourceId: id,
        status: 'success',
        details: { updatedFields: Object.keys(patch), after: row },
      },
      {
        ip: reqMeta?.ip as any,
        get: (h: string) => (h.toLowerCase() === 'user-agent' ? reqMeta?.ua || '' : '') as any,
      } as any
    )
await cdel(kOrg(false), kOrg(true))

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

    await LogService.log(
      {
        type: 'audit',
        userId: user?.id,
        username: user?.username,
        action: '删除组织',
        message: `删除组织成功：#${id}（${existed.name}）`,
        resourceType: 'organization',
        resourceId: id,
        status: 'success',
        details: {},
      },
      {
        ip: reqMeta?.ip as any,
        get: (h: string) => (h.toLowerCase() === 'user-agent' ? reqMeta?.ua || '' : '') as any,
      } as any
    )
await cdel(kOrg(false), kOrg(true))

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

    await LogService.log(
      {
        type: 'audit',
        userId: user?.id,
        username: user?.username,
        action: '移动组织',
        message: `移动组织成功：#${id} -> 上级=${parent_id ?? '无'}`,
        resourceType: 'organization',
        resourceId: id,
        status: 'success',
        details: { parent_id },
      },
      {
        ip: reqMeta?.ip as any,
        get: (h: string) => (h.toLowerCase() === 'user-agent' ? reqMeta?.ua || '' : '') as any,
      } as any
    )
await cdel(kOrg(false), kOrg(true))

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
      const patch: Partial<IOrg> = {}
      if (u.parent_id !== undefined) patch.parent_id = u.parent_id
      if (Object.keys(patch).length) await OrgRepository.updateOrg(u.id, patch)
    }

    await LogService.log(
      {
        type: 'audit',
        userId: user?.id,
        username: user?.username,
        action: '批量更新组织父级',
        message: `批量更新组织父级成功，共 ${updates.length} 条`,
        resourceType: 'organization',
        resourceId: 0,
        status: 'success',
        details: { kind: 'batch', count: updates.length },
      },
      {
        ip: reqMeta?.ip as any,
        get: (h: string) => (h.toLowerCase() === 'user-agent' ? reqMeta?.ua || '' : '') as any,
      } as any
    )
await cdel(kOrg(false), kOrg(true))

    return { message: '批量更新成功' }
  }
}
