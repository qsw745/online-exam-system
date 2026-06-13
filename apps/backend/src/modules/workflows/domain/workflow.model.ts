export type WorkflowTemplateStatus = 'draft' | 'published'
export type WorkflowInstanceStatus = 'running' | 'approved' | 'rejected' | 'canceled'
export type WorkflowTaskStatus = 'pending' | 'approved' | 'rejected' | 'canceled'

export type WorkflowNodeType = 'start' | 'approval' | 'end'

export type WorkflowEdgeCondition = {
  field: string
  op: '==' | '!=' | '>' | '>=' | '<' | '<=' | 'in' | 'not_in'
  value: any
}

export type WorkflowNode = {
  id: string
  type: WorkflowNodeType
  name: string
  approvers?: number[]
  approver_users?: number[]
  approver_roles?: number[]
  approver_departments?: number[]
  approver_departments_include_children?: boolean
  approvers_from?: string
  approver_expression?: string
  approval_rule?: 'any' | 'all' | 'majority' | 'count'
  required_approvals?: number | string
  reject_rule?: 'any' | 'majority' | 'count'
  form_permissions?: Record<string, 'hidden' | 'read' | 'edit'>
}

export type WorkflowEdge = {
  from: string
  to: string
  condition?: WorkflowEdgeCondition
}

export type WorkflowDefinition = {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

export type WorkflowTemplateRow = {
  id: number
  name: string
  entity_type: string
  app_code?: string | null
  module_code?: string | null
  form_key?: string | null
  form_name?: string | null
  version: number
  status: WorkflowTemplateStatus
  definition: WorkflowDefinition
  starter_roles?: number[]
  created_by: number
  created_at: string
  updated_at: string
}

export type WorkflowInstanceRow = {
  id: number
  template_id: number
  entity_type: string
  entity_id: number
  status: WorkflowInstanceStatus
  current_nodes: string[]
  payload?: any
  created_by: number
  created_at: string
  updated_at: string
}

export type WorkflowTaskRow = {
  id: number
  instance_id: number
  node_id: string
  node_name: string
  assignee_id: number
  status: WorkflowTaskStatus
  comment?: string | null
  decided_at?: string | null
  meta?: any
  created_at: string
  updated_at: string
  payload?: any
}
