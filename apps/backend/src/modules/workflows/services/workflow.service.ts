import HttpError from '@/common/errors/http-error'
import type { AuthUser } from '@/types/auth'
import { CODES } from '@/types/response'
import { ExamRepository } from '@/modules/exams/repositories/exam.repository'
import { RoleRepository } from '@/modules/roles/repositories/role.repository'
import { NotificationService } from '@/modules/notifications/services/notification.service'
import { TodoRepository } from '@/modules/todos/repositories/todo.repository'
import type {
  WorkflowDefinition,
  WorkflowEdge,
  WorkflowInstanceStatus,
  WorkflowNode,
  WorkflowTaskStatus,
  WorkflowTemplateStatus,
} from '../domain/workflow.model'
import { WorkflowRepository } from '../repositories/workflow.repository'

const pickRole = (u?: AuthUser | null) => (u as any)?.role ?? (u as any)?.roles?.[0] ?? undefined

const getPath = (obj: any, path?: string) => {
  if (!path) return undefined
  const parts = path.split('.').filter(Boolean)
  let cur = obj
  for (const p of parts) {
    if (cur == null) return undefined
    cur = cur[p]
  }
  return cur
}

const resolveValue = (val: any, ctx: any) => {
  if (typeof val === 'string' && val.startsWith('payload.')) {
    return getPath(ctx, val)
  }
  return val
}

const toNumberArray = (input: any) => {
  if (!Array.isArray(input)) return []
  return input.map((v: any) => Number(v)).filter((n: number) => Number.isFinite(n) && n > 0)
}

const matchCondition = (edge: WorkflowEdge, ctx: any) => {
  if (!edge.condition) return true
  const { field, op, value } = edge.condition
  const left = getPath(ctx, field)
  const right = resolveValue(value, ctx)
  switch (op) {
    case '==':
      return left == right
    case '!=':
      return left != right
    case '>':
      return Number(left) > Number(right)
    case '>=':
      return Number(left) >= Number(right)
    case '<':
      return Number(left) < Number(right)
    case '<=':
      return Number(left) <= Number(right)
    case 'in':
      return Array.isArray(right) ? right.includes(left) : false
    case 'not_in':
      return Array.isArray(right) ? !right.includes(left) : false
    default:
      return false
  }
}

const findNode = (def: WorkflowDefinition, id: string) => def.nodes.find(n => n.id === id)
const nextNodes = (def: WorkflowDefinition, from: string, ctx: any) =>
  def.edges.filter(e => e.from === from && matchCondition(e, ctx)).map(e => e.to)
const prevNodes = (def: WorkflowDefinition, to: string) =>
  def.edges
    .filter(e => e.to === to)
    .map(e => e.from)
    .filter(Boolean)

const resolveExpressionSources = async (expr: string | undefined, ctx: any, ids: Set<number>) => {
  if (!expr) return
  const entries = String(expr)
    .split(/[;\n]+/)
    .map(v => v.trim())
    .filter(Boolean)
  for (const entry of entries) {
    const [key, raw = ''] = entry.split(':', 2).map(p => p.trim())
    if (!key || !raw) continue
    const tokens = raw
      .split(',')
      .map(v => v.trim())
      .filter(Boolean)
    if (!tokens.length) continue
    if (key === 'user' || key === 'users') {
      for (const tok of tokens) {
        const n = Number(tok)
        if (Number.isFinite(n) && n > 0) ids.add(n)
      }
    } else if (key === 'role' || key === 'roles') {
      const roleIds = tokens.map(tok => Number(tok)).filter(n => Number.isFinite(n) && n > 0)
      if (roleIds.length) {
        const fromRoles = await WorkflowRepository.listUserIdsByRoles(roleIds)
        fromRoles.forEach(uid => ids.add(uid))
      }
    } else if (key === 'dept' || key === 'department') {
      const deptIds = tokens.map(tok => Number(tok)).filter(n => Number.isFinite(n))
      if (deptIds.length) {
        const fromDepts = await WorkflowRepository.listUserIdsByDepartments(deptIds, false)
        fromDepts.forEach(uid => ids.add(uid))
      }
    } else if (key === 'dept-child' || key === 'department-child') {
      const deptIds = tokens.map(tok => Number(tok)).filter(n => Number.isFinite(n))
      if (deptIds.length) {
        const fromDepts = await WorkflowRepository.listUserIdsByDepartments(deptIds, true)
        fromDepts.forEach(uid => ids.add(uid))
      }
    } else if (key === 'payload') {
      for (const tok of tokens) {
        const v = getPath(ctx, tok)
        if (Array.isArray(v)) {
          v.forEach(item => {
            const n = Number(item)
            if (Number.isFinite(n) && n > 0) ids.add(n)
          })
        }
      }
    }
  }
}

const resolveApprovers = async (node: WorkflowNode, ctx: any) => {
  const ids = new Set<number>()
  const add = (list: any[]) => {
    for (const n of toNumberArray(list)) ids.add(n)
  }

  if (Array.isArray(node.approvers) && node.approvers.length) add(node.approvers)
  if (Array.isArray(node.approver_users) && node.approver_users.length) add(node.approver_users)

  if (node.approvers_from) {
    const v = getPath(ctx, node.approvers_from)
    if (Array.isArray(v)) add(v)
  }

  if (Array.isArray(node.approver_roles) && node.approver_roles.length) {
    const roleUsers = await WorkflowRepository.listUserIdsByRoles(node.approver_roles)
    add(roleUsers)
  }

  if (Array.isArray(node.approver_departments) && node.approver_departments.length) {
    const deptUsers = await WorkflowRepository.listUserIdsByDepartments(
      node.approver_departments,
      !!node.approver_departments_include_children
    )
    add(deptUsers)
  }

  if (node.approver_expression) {
    await resolveExpressionSources(node.approver_expression, ctx, ids)
  }

  return Array.from(ids)
}

const resolveRequired = (node: WorkflowNode, ctx: any, total: number) => {
  const v = resolveValue(node.required_approvals, ctx)
  const n = Number(v)
  if (Number.isFinite(n) && n > 0) return Math.min(n, total)
  return total
}

const evaluateNode = (node: WorkflowNode, tasks: Array<{ status: WorkflowTaskStatus }>, ctx: any) => {
  const total = tasks.length
  const approved = tasks.filter(t => t.status === 'approved').length
  const rejected = tasks.filter(t => t.status === 'rejected').length
  const rule = node.approval_rule || 'all'
  const rejectRule = node.reject_rule || 'any'

  const approve = () => {
    if (rule === 'any') return approved >= 1
    if (rule === 'majority') return approved > total / 2
    if (rule === 'count') return approved >= resolveRequired(node, ctx, total)
    return approved >= total
  }

  const reject = () => {
    if (rejectRule === 'majority') return rejected > total / 2
    if (rejectRule === 'count') return rejected >= resolveRequired(node, ctx, total)
    return rejected >= 1
  }

  if (reject()) return 'rejected'
  if (approve()) return 'approved'
  return 'pending'
}

export class WorkflowService {
  async listTemplates(user: AuthUser | undefined, query: any) {
    if (!user?.id) throw new HttpError('未授权', 401, { code: CODES.AUTH_UNAUTHORIZED })
    const entityType = query?.entity_type ? String(query.entity_type) : undefined
    const status = query?.status ? String(query.status) : undefined
    const appCode = query?.app_code ? String(query.app_code) : undefined
    const moduleCode = query?.module_code ? String(query.module_code) : undefined
    return WorkflowRepository.listTemplates({ entityType, status, appCode, moduleCode })
  }

  async createTemplate(user: AuthUser | undefined, payload: any) {
    if (!user?.id) throw new HttpError('未授权', 401, { code: CODES.AUTH_UNAUTHORIZED })
    const role = pickRole(user)
    if (role !== 'admin' && role !== 'teacher') throw new HttpError('无权限', 403, { code: CODES.AUTH_FORBIDDEN })
    const name = String(payload?.name || '').trim()
    const entityType = String(payload?.entity_type || payload?.entityType || '').trim()
    const definition = payload?.definition
    const appCode = payload?.app_code ? String(payload.app_code).trim() : undefined
    const moduleCode = payload?.module_code ? String(payload.module_code).trim() : undefined
    const formKey = payload?.form_key ? String(payload.form_key).trim() : undefined
    const formName = payload?.form_name ? String(payload.form_name).trim() : undefined
    if (!name || !entityType || !definition) {
      throw new HttpError('缺少模板信息', 400, { code: CODES.VALIDATION_ERROR })
    }
    const version = payload?.version ? Number(payload.version) : await WorkflowRepository.nextVersion(name)
    const status = (payload?.status as any) || 'draft'
    const starterRoles = toNumberArray(payload?.starter_roles)
    const id = await WorkflowRepository.createTemplate({
      name,
      entityType,
      appCode: appCode || undefined,
      moduleCode: moduleCode || undefined,
      formKey: formKey || undefined,
      formName: formName || undefined,
      version,
      status,
      definition,
      starterRoles: starterRoles.length ? starterRoles : undefined,
      creator: user.id,
    })
    return { id }
  }

  async updateTemplate(user: AuthUser | undefined, id: number, payload: any) {
    if (!user?.id) throw new HttpError('未授权', 401, { code: CODES.AUTH_UNAUTHORIZED })
    const role = pickRole(user)
    if (role !== 'admin' && role !== 'teacher') throw new HttpError('无权限', 403, { code: CODES.AUTH_FORBIDDEN })
    const existed = await WorkflowRepository.getTemplate(id)
    if (!existed) throw new HttpError('模板不存在', 404, { code: CODES.NOT_FOUND })
    const starterRoles = payload?.starter_roles ? toNumberArray(payload?.starter_roles) : undefined
    const entityType = payload?.entity_type ?? payload?.entityType
    const appCode = payload?.app_code !== undefined ? String(payload.app_code || '').trim() || null : undefined
    const moduleCode = payload?.module_code !== undefined ? String(payload.module_code || '').trim() || null : undefined
    const formKey = payload?.form_key !== undefined ? String(payload.form_key || '').trim() || null : undefined
    const formName = payload?.form_name !== undefined ? String(payload.form_name || '').trim() || null : undefined
    const hasDefinition = payload?.definition !== undefined
    if (hasDefinition) {
      const name = String(payload?.name ?? existed.name).trim()
      const nextEntityType = String(entityType ?? existed.entity_type).trim()
      if (!name || !nextEntityType) {
        throw new HttpError('缺少模板信息', 400, { code: CODES.VALIDATION_ERROR })
      }
      const version = await WorkflowRepository.nextVersion(name)
      const status = (payload?.status as WorkflowTemplateStatus) || existed.status || 'draft'
      const nextStarterRoles = starterRoles ?? existed.starter_roles
      const templateId = await WorkflowRepository.createTemplate({
        name,
        entityType: nextEntityType,
        appCode: appCode ?? existed.app_code ?? undefined,
        moduleCode: moduleCode ?? existed.module_code ?? undefined,
        formKey: formKey ?? existed.form_key ?? undefined,
        formName: formName ?? existed.form_name ?? undefined,
        version,
        status,
        definition: payload?.definition,
        starterRoles: nextStarterRoles && nextStarterRoles.length ? nextStarterRoles : undefined,
        creator: user.id,
      })
      return { id: templateId, version, created: true, updated: 1 }
    }
    const updated = await WorkflowRepository.updateTemplate(id, {
      name: payload?.name,
      appCode,
      moduleCode,
      formKey,
      formName,
      status: payload?.status,
      starterRoles: starterRoles ?? undefined,
      entityType: entityType ? String(entityType).trim() : undefined,
    })
    if (!updated) throw new HttpError('模板不存在', 404, { code: CODES.NOT_FOUND })
    return { updated, id }
  }

  async publishTemplate(user: AuthUser | undefined, id: number) {
    return this.updateTemplate(user, id, { status: 'published' })
  }

  async startInstance(user: AuthUser | undefined, payload: any) {
    if (!user?.id) throw new HttpError('未授权', 401, { code: CODES.AUTH_UNAUTHORIZED })
    const entityType = String(payload?.entity_type || payload?.entityType || '').trim()
    const entityId = Number(payload?.entity_id ?? payload?.entityId)
    if (!entityType || !entityId) throw new HttpError('缺少流程对象', 400, { code: CODES.VALIDATION_ERROR })
    const templateId = payload?.template_id ? Number(payload.template_id) : 0
    const template =
      templateId > 0 ? await WorkflowRepository.getTemplate(templateId) : await WorkflowRepository.getLatestPublished(entityType)
    if (!template) throw new HttpError('未找到流程模板', 404, { code: CODES.NOT_FOUND })
    if (template.status !== 'published') {
      throw new HttpError('流程模板未发布', 400, { code: CODES.VALIDATION_ERROR })
    }
    const allowedStarters = template.starter_roles || []
    if (allowedStarters.length) {
      const userRoles = await RoleRepository.getUserRoles(user.id)
      const hasStarterRole = userRoles.some((r: { id: number }) => allowedStarters.includes(Number(r.id)))
      if (!hasStarterRole) {
        throw new HttpError('无权限发起该流程', 403, { code: CODES.AUTH_FORBIDDEN })
      }
    }

    const def = template.definition as WorkflowDefinition
    const startNode = def.nodes.find(n => n.type === 'start')
    if (!startNode) throw new HttpError('流程缺少开始节点', 400, { code: CODES.VALIDATION_ERROR })

    const ctx = { payload: payload?.payload ?? payload }
    const next = nextNodes(def, startNode.id, ctx)
    if (!next.length) throw new HttpError('流程缺少后续节点', 400, { code: CODES.VALIDATION_ERROR })
    const { activeNodes, hasEnd } = this.splitNextNodes(def, next)

    const instanceId = await WorkflowRepository.createInstance({
      templateId: template.id,
      entityType,
      entityId,
      currentNodes: activeNodes,
      payload: ctx.payload,
      createdBy: user.id,
    })

    if (!activeNodes.length && hasEnd) {
      await WorkflowRepository.updateInstance(instanceId, { status: 'approved', currentNodes: [] })
      await this.syncEntityStatus({ entity_type: entityType, entity_id: entityId }, 'approved')
      return { id: instanceId, template_id: template.id, status: 'approved' }
    }

    await this.createTasksForNodes(instanceId, def, activeNodes, ctx, {
      actorId: user.id,
      entityType,
      entityId,
      templateName: template.name,
      templateId: template.id,
    })
    return { id: instanceId, template_id: template.id, status: 'running' }
  }

  private async createTasksForNodes(
    instanceId: number,
    def: WorkflowDefinition,
    nodeIds: string[],
    ctx: any,
    opts?: { actorId?: number; entityType?: string; entityId?: number; templateName?: string; templateId?: number }
  ) {
    const items: Array<{ instanceId: number; nodeId: string; nodeName: string; assigneeId: number; meta?: any }> = []
    const assignees = new Set<number>()
    for (const id of nodeIds) {
      const node = findNode(def, id)
      if (!node) continue
      if (node.type === 'approval') {
        const approvers = await resolveApprovers(node, ctx)
        if (!approvers.length) throw new HttpError(`节点 ${node.name} 未配置审核人`, 400, { code: CODES.VALIDATION_ERROR })
        for (const uid of approvers) {
          items.push({ instanceId, nodeId: node.id, nodeName: node.name, assigneeId: uid, meta: { rule: node.approval_rule } })
          assignees.add(uid)
        }
      }
    }
    await WorkflowRepository.createTasks(items)
    if (opts?.actorId && assignees.size) {
      const templateName = opts.templateName ? `「${opts.templateName}」` : '流程'
      const title = `${templateName}新审批任务`
      const content = `您有新的审批任务，请及时处理。`
      try {
        await NotificationService.createBatch(opts.actorId, {
          user_ids: Array.from(assignees),
          title,
          content,
          source: 'workflow',
          target_path: '/admin/workflows/tasks',
          metadata: {
            instance_id: instanceId,
            entity_type: opts.entityType,
            entity_id: opts.entityId,
            template_id: opts.templateId,
          },
        })
      } catch {}
    }
    if (assignees.size) {
      const templateName = opts?.templateName ? `「${opts.templateName}」` : '流程'
      const title = `${templateName}审批待办`
      const todoItems = items.map(it => ({
        user_id: it.assigneeId,
        title,
        content: `节点：${it.nodeName}`,
        source: 'workflow',
        target_path: '/admin/workflows/tasks',
        metadata: {
          instance_id: instanceId,
          node_id: it.nodeId,
          node_name: it.nodeName,
          entity_type: opts?.entityType,
          entity_id: opts?.entityId,
          template_id: opts?.templateId,
        },
      }))
      try {
        await TodoRepository.insertMany(todoItems)
      } catch {}
    }
  }

  async listMyTasks(user: AuthUser | undefined, query: any) {
    if (!user?.id) throw new HttpError('未授权', 401, { code: CODES.AUTH_UNAUTHORIZED })
    const page = Math.max(1, parseInt(String(query?.page || '1')) || 1)
    const limit = Math.max(1, Math.min(100, parseInt(String(query?.limit || '20')) || 20))
    const status = query?.status ? (String(query.status) as any) : undefined
    const entityType = query?.entity_type ? String(query.entity_type) : undefined
    const data = await WorkflowRepository.listTasksForUser(user.id, status, page, limit, entityType)
    return data
  }

  async decideTask(
    user: AuthUser | undefined,
    taskId: number,
    action: WorkflowTaskStatus,
    comment?: string,
    formValues?: Record<string, any>
  ) {
    if (!user?.id) throw new HttpError('未授权', 401, { code: CODES.AUTH_UNAUTHORIZED })
    const task = await WorkflowRepository.getTaskById(taskId)
    if (!task) throw new HttpError('任务不存在', 404, { code: CODES.NOT_FOUND })
    if (task.assignee_id !== user.id) throw new HttpError('无权限审核', 403, { code: CODES.AUTH_FORBIDDEN })
    const updated = await WorkflowRepository.updateTaskStatus(taskId, action, comment)
    if (!updated) throw new HttpError('任务已处理', 400, { code: CODES.VALIDATION_ERROR })
    try {
      await TodoRepository.markDoneByWorkflowMeta(user.id, task.instance_id, task.node_id)
    } catch {}

    const instance = await WorkflowRepository.getInstance(task.instance_id)
    if (!instance) throw new HttpError('流程实例不存在', 404, { code: CODES.NOT_FOUND })
    if (formValues && typeof formValues === 'object') {
      const existing = (instance.payload || {}) as any
      const mergedForm = { ...(existing.form_values || {}), ...formValues }
      const nextPayload = { ...existing, form_values: mergedForm }
      await WorkflowRepository.updateInstancePayload(instance.id, nextPayload)
      instance.payload = nextPayload
    }
    const template = await WorkflowRepository.getTemplate(instance.template_id)
    if (!template) throw new HttpError('流程模板不存在', 404, { code: CODES.NOT_FOUND })

    const def = template.definition as WorkflowDefinition
    const node = findNode(def, task.node_id)
    if (!node) return { status: instance.status }

    const ctx = { payload: instance.payload ?? {} }
    const tasks = await WorkflowRepository.listTasksByNode(instance.id, task.node_id)
    const nodeResult = evaluateNode(node, tasks, ctx)

    if (nodeResult === 'pending') return { status: instance.status }

    await WorkflowRepository.cancelPendingTasks(instance.id, task.node_id)
    try {
      await TodoRepository.markDoneByWorkflowNode(instance.id, task.node_id)
    } catch {}

    if (nodeResult === 'rejected') {
      const rawBack = prevNodes(def, task.node_id)
      const backNodes = Array.from(
        new Set(
          rawBack.flatMap(id => {
            const n = findNode(def, id)
            if (n?.type === 'start') {
              return nextNodes(def, id, ctx)
            }
            return id
          })
        )
      )
      const forward = nextNodes(def, task.node_id, ctx)
      const forwardTargets = forward.filter(id => {
        const n = findNode(def, id)
        return n && n.type !== 'end'
      })
      const targetNodes = backNodes.length ? backNodes : forwardTargets
      if (targetNodes.length) {
        const { activeNodes } = this.splitNextNodes(def, targetNodes)
        const nextSet = new Set<string>(instance.current_nodes || [])
        nextSet.delete(task.node_id)
        for (const n of activeNodes) nextSet.add(n)
        const nextNodesList = Array.from(nextSet)
        await WorkflowRepository.updateInstance(instance.id, { status: 'running', currentNodes: nextNodesList })
        if (instance.entity_type === 'exam') {
          await ExamRepository.updateStatus(instance.entity_id, 'reviewing')
        }
        await this.createTasksForNodes(instance.id, def, activeNodes, ctx, {
          actorId: user.id,
          entityType: instance.entity_type,
          entityId: instance.entity_id,
          templateName: template.name,
          templateId: template.id,
        })
        return { status: 'running' }
      }
      await WorkflowRepository.updateInstance(instance.id, { status: 'rejected', currentNodes: [] })
      await this.syncEntityStatus(instance, 'rejected')
      return { status: 'rejected' }
    }

    const outgoing = nextNodes(def, task.node_id, ctx)
    if (!outgoing.length) {
      await WorkflowRepository.updateInstance(instance.id, { status: 'approved', currentNodes: [] })
      await this.syncEntityStatus(instance, 'approved')
      return { status: 'approved' }
    }
    const { activeNodes, hasEnd } = this.splitNextNodes(def, outgoing)
    const nextSet = new Set<string>(instance.current_nodes || [])
    nextSet.delete(task.node_id)
    for (const n of activeNodes) nextSet.add(n)
    const nextNodesList = Array.from(nextSet)

    if (!nextNodesList.length && hasEnd) {
      await WorkflowRepository.updateInstance(instance.id, { status: 'approved', currentNodes: [] })
      await this.syncEntityStatus(instance, 'approved')
      return { status: 'approved' }
    }

    await WorkflowRepository.updateInstance(instance.id, { currentNodes: nextNodesList })
    await this.createTasksForNodes(instance.id, def, activeNodes, ctx, {
      actorId: user.id,
      entityType: instance.entity_type,
      entityId: instance.entity_id,
      templateName: template.name,
      templateId: template.id,
    })
    return { status: 'running' }
  }

  async getInstanceDetail(user: AuthUser | undefined, instanceId: number) {
    if (!user?.id) throw new HttpError('未授权', 401, { code: CODES.AUTH_UNAUTHORIZED })
    const instance = await WorkflowRepository.getInstance(instanceId)
    if (!instance) throw new HttpError('流程实例不存在', 404, { code: CODES.NOT_FOUND })
    const template = await WorkflowRepository.getTemplate(instance.template_id)
    if (!template) throw new HttpError('流程模板不存在', 404, { code: CODES.NOT_FOUND })
    const tasks = await WorkflowRepository.listTasksByInstance(instanceId)
    return { instance, template, tasks }
  }

  async deleteEntityWorkflows(entityType: string, entityId: number) {
    if (!entityType || !entityId) return 0
    await WorkflowRepository.deleteInstancesByEntity(entityType, entityId)
    try {
      await TodoRepository.deleteByWorkflowEntity(entityType, entityId)
    } catch {}
    return 1
  }

  async submitExamReview(user: AuthUser | undefined, examId: number, payload: any) {
    if (!user?.id) throw new HttpError('未授权', 401, { code: CODES.AUTH_UNAUTHORIZED })
    const exam = await ExamRepository.findById(examId)
    if (!exam) throw new HttpError('考试不存在', 404, { code: CODES.NOT_FOUND })
    if (exam.created_by !== user.id) throw new HttpError('考试不存在或无权限修改', 404, { code: CODES.NOT_FOUND })

    const reviewerIds = Array.isArray(payload?.reviewer_ids) ? payload.reviewer_ids : []
    const required = payload?.required_approvals
    const instance = await this.startInstance(user, {
      entity_type: 'exam',
      entity_id: examId,
      template_id: payload?.template_id,
      payload: {
        reviewer_ids: reviewerIds,
        required_approvals: required ?? reviewerIds.length,
      },
    })
    await ExamRepository.updateStatus(examId, 'reviewing')
    return instance
  }

  private async syncEntityStatus(instance: { entity_type: string; entity_id: number }, status: WorkflowInstanceStatus) {
    if (instance.entity_type === 'exam') {
      if (status === 'approved') await ExamRepository.updateStatus(instance.entity_id, 'approved')
      if (status === 'rejected') await ExamRepository.updateStatus(instance.entity_id, 'rejected')
    }
  }

  private splitNextNodes(def: WorkflowDefinition, nodes: string[]) {
    const activeNodes: string[] = []
    let hasEnd = false
    for (const id of nodes) {
      const node = findNode(def, id)
      if (!node) continue
      if (node.type === 'end') {
        hasEnd = true
        continue
      }
      activeNodes.push(id)
    }
    return { activeNodes, hasEnd }
  }
}

export default WorkflowService
