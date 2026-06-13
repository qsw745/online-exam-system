import { pool } from '@/config/database'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type {
  WorkflowInstanceRow,
  WorkflowTaskRow,
  WorkflowTemplateRow,
  WorkflowTemplateStatus,
  WorkflowTaskStatus,
} from '../domain/workflow.model'

const J = (v: any) => (v === undefined || v === null ? null : JSON.stringify(v))
const parseJson = (raw: any) => {
  if (raw === undefined || raw === null) return null
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(String(raw))
  } catch {
    return null
  }
}

const parseNumberArray = (raw: any): number[] | null => {
  if (raw === undefined || raw === null) return null
  if (Array.isArray(raw)) {
    return raw.map(v => Number(v)).filter(Number.isFinite)
  }
  const parsed = parseJson(raw)
  if (Array.isArray(parsed)) return parsed.map(v => Number(v)).filter(Number.isFinite)
  return null
}

const uniqNumbers = (input: any[]) => {
  const out: number[] = []
  const seen = new Set<number>()
  for (const v of input) {
    const n = Number(v)
    if (!Number.isFinite(n) || n <= 0) continue
    if (!seen.has(n)) {
      seen.add(n)
      out.push(n)
    }
  }
  return out
}

let cachedOrgParentCol: string | null = null
const detectOrgParentColumn = async (): Promise<string> => {
  if (cachedOrgParentCol) return cachedOrgParentCol
  try {
    const [cols] = await pool.query<RowDataPacket[]>('SHOW COLUMNS FROM `organizations`')
    const names = cols.map(c => String((c as any).Field).toLowerCase())
    const found =
      ['parent_id', 'parentId', 'pid', 'p_id', 'parent', 'parentid'].find(c => names.includes(c.toLowerCase())) ||
      'parent_id'
    cachedOrgParentCol = found
    return found
  } catch {
    cachedOrgParentCol = 'parent_id'
    return cachedOrgParentCol
  }
}

const expandOrgIds = async (ids: number[]) => {
  const base = uniqNumbers(ids)
  if (!base.length) return []
  try {
    const parentCol = await detectOrgParentColumn()
    const [rows] = await pool.query<RowDataPacket[]>('SELECT id, ?? AS parent_id FROM organizations', [parentCol] as any)
    const childrenMap = new Map<number, number[]>()
    for (const row of rows) {
      const id = Number((row as any).id)
      if (!Number.isFinite(id)) continue
      const pidRaw = (row as any).parent_id
      const pid = pidRaw == null ? null : Number(pidRaw)
      if (pid != null && Number.isFinite(pid)) {
        if (!childrenMap.has(pid)) childrenMap.set(pid, [])
        childrenMap.get(pid)!.push(id)
      }
    }
    const stack = [...base]
    const all = new Set<number>(base)
    while (stack.length) {
      const cur = stack.pop()!
      const kids = childrenMap.get(cur) || []
      for (const k of kids) {
        if (!all.has(k)) {
          all.add(k)
          stack.push(k)
        }
      }
    }
    return Array.from(all)
  } catch {
    return base
  }
}

export const WorkflowRepository = {
  async listTemplates(params: { entityType?: string; status?: string; appCode?: string; moduleCode?: string }) {
    const vals: any[] = []
    const conds: string[] = []
    if (params.entityType) {
      conds.push('entity_type = ?')
      vals.push(params.entityType)
    }
    if (params.appCode) {
      conds.push('app_code = ?')
      vals.push(params.appCode)
    }
    if (params.moduleCode) {
      conds.push('module_code = ?')
      vals.push(params.moduleCode)
    }
    if (params.status && params.status !== 'all') {
      conds.push('status = ?')
      vals.push(params.status)
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM workflow_templates ${where} ORDER BY updated_at DESC`,
      vals
    )
    return (rows as any[]).map(r => ({
      ...r,
      definition: parseJson(r.definition),
      starter_roles: parseNumberArray(r.starter_roles) ?? undefined,
    })) as WorkflowTemplateRow[]
  },

  async getTemplate(id: number): Promise<WorkflowTemplateRow | null> {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM workflow_templates WHERE id = ?', [id])
    const row = (rows as any[])[0]
    if (!row) return null
    return {
      ...row,
      definition: parseJson(row.definition),
      starter_roles: parseNumberArray(row.starter_roles) ?? undefined,
    } as WorkflowTemplateRow
  },

  async getLatestPublished(entityType: string): Promise<WorkflowTemplateRow | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM workflow_templates
       WHERE entity_type = ? AND status = 'published'
       ORDER BY updated_at DESC LIMIT 1`,
      [entityType]
    )
    const row = (rows as any[])[0]
    if (!row) return null
    return {
      ...row,
      definition: parseJson(row.definition),
      starter_roles: parseNumberArray(row.starter_roles) ?? undefined,
    } as WorkflowTemplateRow
  },

  async nextVersion(name: string): Promise<number> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT MAX(version) as max_version FROM workflow_templates WHERE name = ?',
      [name]
    )
    const max = Number((rows as any[])[0]?.max_version || 0)
    return max + 1
  },

  async createTemplate(input: {
    name: string
    entityType: string
    version: number
    status: WorkflowTemplateStatus
    definition: any
    creator: number
    starterRoles?: number[]
    appCode?: string | null
    moduleCode?: string | null
    formKey?: string | null
    formName?: string | null
  }) {
    const [ret] = await pool.query<ResultSetHeader>(
      `INSERT INTO workflow_templates (name, entity_type, app_code, module_code, form_key, form_name, version, status, definition, starter_roles, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.name,
        input.entityType,
        input.appCode ?? null,
        input.moduleCode ?? null,
        input.formKey ?? null,
        input.formName ?? null,
        input.version,
        input.status,
        J(input.definition),
        input.starterRoles ? JSON.stringify(input.starterRoles) : null,
        input.creator,
      ]
    )
    return ret.insertId
  },

  async updateTemplate(
    id: number,
    input: {
      name?: string
      status?: WorkflowTemplateStatus
      definition?: any
      starterRoles?: number[]
      entityType?: string
      version?: number
      appCode?: string | null
      moduleCode?: string | null
      formKey?: string | null
      formName?: string | null
    }
  ) {
    const sets: string[] = []
    const vals: any[] = []
    if (input.name !== undefined) {
      sets.push('name = ?')
      vals.push(input.name)
    }
    if (input.appCode !== undefined) {
      sets.push('app_code = ?')
      vals.push(input.appCode)
    }
    if (input.moduleCode !== undefined) {
      sets.push('module_code = ?')
      vals.push(input.moduleCode)
    }
    if (input.formKey !== undefined) {
      sets.push('form_key = ?')
      vals.push(input.formKey)
    }
    if (input.formName !== undefined) {
      sets.push('form_name = ?')
      vals.push(input.formName)
    }
    if (input.version !== undefined) {
      sets.push('version = ?')
      vals.push(input.version)
    }
    if (input.entityType !== undefined) {
      sets.push('entity_type = ?')
      vals.push(input.entityType)
    }
    if (input.status !== undefined) {
      sets.push('status = ?')
      vals.push(input.status)
    }
    if (input.definition !== undefined) {
      sets.push('definition = ?')
      vals.push(J(input.definition))
    }
    if (input.starterRoles !== undefined) {
      sets.push('starter_roles = ?')
      vals.push(input.starterRoles ? JSON.stringify(input.starterRoles) : null)
    }
    if (!sets.length) return 0
    const [ret] = await pool.query<ResultSetHeader>(
      `UPDATE workflow_templates SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ?`,
      [...vals, id]
    )
    return ret.affectedRows
  },

  async createInstance(input: {
    templateId: number
    entityType: string
    entityId: number
    currentNodes: string[]
    payload?: any
    createdBy: number
  }) {
    const [ret] = await pool.query<ResultSetHeader>(
      `INSERT INTO workflow_instances
       (template_id, entity_type, entity_id, status, current_nodes, payload, created_by)
       VALUES (?, ?, ?, 'running', ?, ?, ?)`,
      [input.templateId, input.entityType, input.entityId, JSON.stringify(input.currentNodes), J(input.payload), input.createdBy]
    )
    return ret.insertId
  },

  async updateInstance(id: number, input: { status?: string; currentNodes?: string[] }) {
    const sets: string[] = []
    const vals: any[] = []
    if (input.status !== undefined) {
      sets.push('status = ?')
      vals.push(input.status)
    }
    if (input.currentNodes !== undefined) {
      sets.push('current_nodes = ?')
      vals.push(JSON.stringify(input.currentNodes))
    }
    if (!sets.length) return 0
    const [ret] = await pool.query<ResultSetHeader>(
      `UPDATE workflow_instances SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ?`,
      [...vals, id]
    )
    return ret.affectedRows
  },

  async getInstance(id: number): Promise<WorkflowInstanceRow | null> {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM workflow_instances WHERE id = ?', [id])
    const row = (rows as any[])[0]
    if (!row) return null
    return {
      ...row,
      current_nodes: parseJson(row.current_nodes) ?? [],
      payload: parseJson(row.payload),
    } as WorkflowInstanceRow
  },

  async deleteInstancesByEntity(entityType: string, entityId: number) {
    await pool.query<ResultSetHeader>(
      `DELETE FROM workflow_tasks
       WHERE instance_id IN (SELECT id FROM workflow_instances WHERE entity_type = ? AND entity_id = ?)`,
      [entityType, entityId]
    )
    const [ret] = await pool.query<ResultSetHeader>(
      'DELETE FROM workflow_instances WHERE entity_type = ? AND entity_id = ?',
      [entityType, entityId]
    )
    return ret.affectedRows
  },

  async listTasksForUser(userId: number, status?: WorkflowTaskStatus | 'all', page = 1, limit = 20, entityType?: string) {
    const offset = (page - 1) * limit
    const vals: any[] = [userId]
    let where = 't.assignee_id = ?'
    if (status && status !== 'all') {
      where += ' AND t.status = ?'
      vals.push(status)
    }
    if (entityType) {
      where += ' AND i.entity_type = ?'
      vals.push(entityType)
    }
    const listSql = `
      SELECT t.*, i.entity_type, i.entity_id, i.status as instance_status, i.payload
      FROM workflow_tasks t
      JOIN workflow_instances i ON i.id = t.instance_id
      WHERE ${where}
      ORDER BY t.created_at DESC
      LIMIT ?, ?
    `
    const countSql = `
      SELECT COUNT(*) as total
      FROM workflow_tasks t
      JOIN workflow_instances i ON i.id = t.instance_id
      WHERE ${where}
    `
    const [rows] = await pool.query<RowDataPacket[]>(listSql, [...vals, offset, limit])
    const [cnt] = await pool.query<RowDataPacket[]>(countSql, vals)
    const total = Number((cnt as any)[0]?.total || 0)
    const items = (rows as any[]).map(r => ({
      ...r,
      meta: parseJson(r.meta),
      payload: parseJson(r.payload),
    }))
    return { items, total, page, limit }
  },

  async listTasksByNode(instanceId: number, nodeId: string) {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM workflow_tasks WHERE instance_id = ? AND node_id = ? ORDER BY created_at ASC',
      [instanceId, nodeId]
    )
    return rows as WorkflowTaskRow[]
  },

  async updateInstancePayload(instanceId: number, payload: any) {
    await pool.query<ResultSetHeader>(
      'UPDATE workflow_instances SET payload = ?, updated_at = NOW() WHERE id = ?',
      [J(payload), instanceId]
    )
  },

  async listTasksByInstance(instanceId: number) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT t.*, u.username, u.nickname
       FROM workflow_tasks t
       LEFT JOIN users u ON u.id = t.assignee_id
       WHERE t.instance_id = ?
       ORDER BY t.created_at ASC`,
      [instanceId]
    )
    return (rows as any[]).map(r => ({
      ...r,
      meta: parseJson(r.meta),
      assignee_name: r.nickname || r.username || String(r.assignee_id),
    }))
  },

  async createTasks(items: Array<{ instanceId: number; nodeId: string; nodeName: string; assigneeId: number; meta?: any }>) {
    if (!items.length) return
    const vals = items.map(it => [it.instanceId, it.nodeId, it.nodeName, it.assigneeId, 'pending', J(it.meta)])
    await pool.query(
      'INSERT INTO workflow_tasks (instance_id, node_id, node_name, assignee_id, status, meta) VALUES ?',
      [vals] as any
    )
  },

  async updateTaskStatus(id: number, status: WorkflowTaskStatus, comment?: string) {
    const [ret] = await pool.query<ResultSetHeader>(
      `UPDATE workflow_tasks
       SET status = ?, comment = ?, decided_at = NOW(), updated_at = NOW()
       WHERE id = ? AND status = 'pending'`,
      [status, comment ?? null, id]
    )
    return ret.affectedRows
  },

  async cancelPendingTasks(instanceId: number, nodeId: string) {
    await pool.query<ResultSetHeader>(
      `UPDATE workflow_tasks
       SET status = 'canceled', updated_at = NOW()
       WHERE instance_id = ? AND node_id = ? AND status = 'pending'`,
      [instanceId, nodeId]
    )
  },

  async getTaskById(id: number): Promise<WorkflowTaskRow | null> {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM workflow_tasks WHERE id = ?', [id])
    const row = (rows as any[])[0]
    if (!row) return null
    return { ...row, meta: parseJson(row.meta) } as WorkflowTaskRow
  },

  async listUserIdsByRoles(roleIds: number[]) {
    const ids = uniqNumbers(roleIds)
    if (!ids.length) return []
    const placeholders = ids.map(() => '?').join(',')
    const sql = `
      SELECT DISTINCT user_id FROM user_roles WHERE role_id IN (${placeholders})
      UNION
      SELECT DISTINCT user_id FROM user_org_roles WHERE role_id IN (${placeholders})
    `
    const [rows] = await pool.query<RowDataPacket[]>(sql, [...ids, ...ids])
    const base = (rows as any[]).map(r => Number((r as any).user_id)).filter(Number.isFinite)

    const [roleRows] = await pool.query<RowDataPacket[]>(`SELECT code FROM roles WHERE id IN (${placeholders})`, ids)
    const codes = (roleRows as any[])
      .map(r => String((r as any).code || '').toLowerCase())
      .filter(Boolean)
    if (!codes.length) return base

    const codePlaceholders = codes.map(() => '?').join(',')
    const [legacyRows] = await pool.query<RowDataPacket[]>(
      `SELECT DISTINCT id as user_id FROM users WHERE LOWER(role) IN (${codePlaceholders})`,
      codes
    )
    const legacy = (legacyRows as any[]).map(r => Number((r as any).user_id)).filter(Number.isFinite)
    return Array.from(new Set([...base, ...legacy]))
  },

  async listUserIdsByDepartments(departmentIds: number[], includeChildren = false) {
    const baseIds = uniqNumbers(departmentIds)
    if (!baseIds.length) return []
    const ids = includeChildren ? await expandOrgIds(baseIds) : baseIds
    if (!ids.length) return []
    const placeholders = ids.map(() => '?').join(',')
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DISTINCT user_id FROM user_organizations WHERE org_id IN (${placeholders})`,
      ids
    )
    return (rows as any[]).map(r => Number((r as any).user_id)).filter(Number.isFinite)
  },
}

export default WorkflowRepository
