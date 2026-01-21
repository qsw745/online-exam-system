import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  TreeSelect,
  Typography,
} from 'antd'
import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react'
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  Handle,
  Position,
  MarkerType,
} from '@xyflow/react'
import { CheckCircleOutlined, PlayCircleOutlined, StopOutlined } from '@ant-design/icons'
import '@xyflow/react/dist/style.css'
import { workflowsApi, type WorkflowTemplate } from '@/shared/api/endpoints/workflows'
import { usersApi } from '@/shared/api/endpoints/users'
import { rolesApi } from '@/shared/api/endpoints/roles'
import { useDepartmentsTree } from '@/features/tasks/hooks/useDepartmentsTree'
import { pickLatestTemplates, workflowStatusLabel } from '@/shared/utils/workflow'

const { Title, Text } = Typography
const { TextArea } = Input

type NodeType = 'start' | 'approval' | 'end'
type ConditionOp = '==' | '!=' | '>' | '>=' | '<' | '<=' | 'in' | 'not_in'

type WorkflowNodeData = {
  nodeType: NodeType
  label: string
  approverUsers?: number[]
  approverRoles?: number[]
  approverDepartments?: string[]
  approverDepartmentsIncludeChildren?: boolean
  approvers_from?: string
  approval_rule?: 'any' | 'all' | 'majority' | 'count'
  required_approvals?: string
  reject_rule?: 'any' | 'majority' | 'count'
  approverExpression?: string
  approvalPreset?: 'single' | 'multi' | 'countersign' | 'dept'
  formPermissions?: Record<string, 'hidden' | 'read' | 'edit'>
}

type FormBlockType =
  | 'input'
  | 'textarea'
  | 'select'
  | 'number'
  | 'date'
  | 'switch'
  | 'checkbox'
  | 'radio'
  | 'title'
  | 'paragraph'
  | 'divider'

type FormBlock = {
  id: string
  type: FormBlockType
  label?: string
  name?: string
  placeholder?: string
  required?: boolean
  options?: Array<{ label: string; value: string | number }>
}

type FormSource = {
  html: string
  css: string
  js: string
}

type WorkflowNode = Node<WorkflowNodeData, 'workflow'>

type EdgeConditionForm = {
  field?: string
  op?: ConditionOp
  value?: string
}

type ModalMode = 'create' | 'edit' | 'clone'
type ModalState = { open: boolean; mode?: ModalMode; editing?: WorkflowTemplate | null; cloneFrom?: WorkflowTemplate | null }

const statusColor = (s: string) => (s === 'published' ? 'success' : 'default')

const toNumberArray = (input: any) => {
  if (!Array.isArray(input)) return []
  return input.map((v: any) => Number(v)).filter((n: number) => Number.isFinite(n) && n > 0)
}

const toStringArray = (input: any) => {
  if (!Array.isArray(input)) return []
  return input.map((v: any) => String(v))
}

const approvalPresets: Array<{
  key: WorkflowNodeData['approvalPreset']
  label: string
  description: string
  config: Partial<WorkflowNodeData>
}> = [
  {
    key: 'single',
    label: '单人审批',
    description: '仅需一位审批人通过',
    config: { approval_rule: 'count', required_approvals: '1', reject_rule: 'any' },
  },
  {
    key: 'multi',
    label: '多人审批',
    description: '可配置通过人数',
    config: { approval_rule: 'count', required_approvals: '', reject_rule: 'any' },
  },
  {
    key: 'countersign',
    label: '会签（全部）',
    description: '所有人必须通过',
    config: { approval_rule: 'all', required_approvals: '', reject_rule: 'any' },
  },
  {
    key: 'dept',
    label: '部门会签',
    description: '部门内含子部门多人会签',
    config: {
      approval_rule: 'all',
      approverDepartmentsIncludeChildren: true,
      reject_rule: 'any',
    },
  },
]

function WorkflowNodeView({ data }: NodeProps<WorkflowNode>) {
  const nodeType = (data as any)?.nodeType as NodeType
  const bg =
    nodeType === 'start' ? '#ecfdf3' : nodeType === 'end' ? '#fef2f2' : nodeType === 'approval' ? '#eff6ff' : '#fff'
  const border =
    nodeType === 'start' ? '#34d399' : nodeType === 'end' ? '#f87171' : nodeType === 'approval' ? '#60a5fa' : '#e5e7eb'

  return (
    <div style={{ padding: 10, borderRadius: 8, border: `1px solid ${border}`, background: bg, minWidth: 140 }}>
      <Handle type="target" position={Position.Top} />
      <div style={{ fontWeight: 600 }}>{(data as any)?.label || '未命名节点'}</div>
      <div style={{ fontSize: 12, color: '#6b7280' }}>{nodeType}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

const nodeTypes = { workflow: WorkflowNodeView }

const defaultDefinition = () => ({
  nodes: [
    { id: 'start', type: 'start', name: '开始' },
    {
      id: 'review',
      type: 'approval',
      name: '审核',
      approvers_from: 'payload.reviewer_ids',
      approval_rule: 'count',
      required_approvals: 'payload.required_approvals',
      reject_rule: 'any',
    },
    { id: 'end', type: 'end', name: '结束' },
  ],
  edges: [
    { from: 'start', to: 'review' },
    { from: 'review', to: 'end' },
  ],
  form: [],
})

const parseConditionValue = (raw?: string) => {
  if (raw == null) return undefined
  const v = String(raw).trim()
  if (!v) return undefined
  try {
    return JSON.parse(v)
  } catch {
    const n = Number(v)
    return Number.isFinite(n) ? n : v
  }
}

const emptyFormSource: FormSource = { html: '', css: '', js: '' }

const formPalette: Array<{ type: FormBlockType; label: string }> = [
  { type: 'input', label: '单行文本' },
  { type: 'textarea', label: '多行文本' },
  { type: 'select', label: '下拉选择' },
  { type: 'number', label: '数字' },
  { type: 'date', label: '日期' },
  { type: 'switch', label: '开关' },
  { type: 'checkbox', label: '复选框' },
  { type: 'radio', label: '单选框' },
  { type: 'title', label: '标题' },
  { type: 'paragraph', label: '段落' },
  { type: 'divider', label: '分割线' },
]

const defaultFormCss = `
.wf-form {
  font-family: "PingFang SC", "Microsoft YaHei", Arial, sans-serif;
  display: grid;
  gap: 12px;
}
.wf-field {
  display: grid;
  gap: 6px;
}
.wf-label {
  font-weight: 600;
  color: #1f2937;
}
.wf-input, .wf-select, .wf-textarea {
  padding: 8px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
}
.wf-textarea { min-height: 72px; resize: vertical; }
.wf-help { font-size: 12px; color: #6b7280; }
.wf-title { margin: 0; font-size: 18px; }
.wf-paragraph { margin: 0; color: #4b5563; }
.wf-divider { border: none; border-top: 1px solid #e5e7eb; }
.wf-inline { display: flex; gap: 12px; flex-wrap: wrap; }
`

const renderBlockHtml = (block: FormBlock) => {
  const label = block.label || block.name || '未命名字段'
  const name = block.name || block.id
  const required = block.required ? ' required' : ''
  switch (block.type) {
    case 'title':
      return `<h3 class="wf-title">${label}</h3>`
    case 'paragraph':
      return `<p class="wf-paragraph">${label}</p>`
    case 'divider':
      return `<hr class="wf-divider" />`
    case 'textarea':
      return `<label class="wf-field"><span class="wf-label">${label}${block.required ? ' *' : ''}</span><textarea class="wf-textarea" name="${name}" placeholder="${
        block.placeholder || ''
      }"${required}></textarea></label>`
    case 'select':
      return `<label class="wf-field"><span class="wf-label">${label}${block.required ? ' *' : ''}</span><select class="wf-select" name="${name}"${
        required
      }>${(block.options || [])
        .map(opt => `<option value="${String(opt.value)}">${opt.label}</option>`)
        .join('')}</select></label>`
    case 'number':
      return `<label class="wf-field"><span class="wf-label">${label}${block.required ? ' *' : ''}</span><input class="wf-input" type="number" name="${name}" placeholder="${
        block.placeholder || ''
      }"${required} /></label>`
    case 'date':
      return `<label class="wf-field"><span class="wf-label">${label}${block.required ? ' *' : ''}</span><input class="wf-input" type="date" name="${name}"${
        required
      } /></label>`
    case 'switch':
      return `<label class="wf-field"><span class="wf-label">${label}${block.required ? ' *' : ''}</span><input type="checkbox" name="${name}" /></label>`
    case 'checkbox':
      return `<div class="wf-field"><span class="wf-label">${label}${block.required ? ' *' : ''}</span><div class="wf-inline">${(block.options || [])
        .map(
          opt =>
            `<label><input type="checkbox" name="${name}" value="${String(opt.value)}" /> ${opt.label}</label>`
        )
        .join('')}</div></div>`
    case 'radio':
      return `<div class="wf-field"><span class="wf-label">${label}${block.required ? ' *' : ''}</span><div class="wf-inline">${(block.options || [])
        .map(
          opt =>
            `<label><input type="radio" name="${name}" value="${String(opt.value)}" /> ${opt.label}</label>`
        )
        .join('')}</div></div>`
    default:
      return `<label class="wf-field"><span class="wf-label">${label}${block.required ? ' *' : ''}</span><input class="wf-input" type="text" name="${name}" placeholder="${
        block.placeholder || ''
      }"${required} /></label>`
  }
}

const buildFormSourceFromBlocks = (blocks: FormBlock[]): FormSource => {
  const html = `<form class="wf-form">${blocks.map(renderBlockHtml).join('')}</form>`
  return { html, css: defaultFormCss, js: '' }
}

const collectScript = `
<script>
window.__collectFormValues = function () {
  const values = {};
  const fields = document.querySelectorAll('input, select, textarea');
  fields.forEach(el => {
    const name = el.name || el.getAttribute('name');
    if (!name) return;
    if (el.type === 'checkbox') {
      if (!values[name]) values[name] = [];
      if (el.checked) values[name].push(el.value === 'on' ? true : el.value);
      return;
    }
    if (el.type === 'radio') {
      if (el.checked) values[name] = el.value;
      return;
    }
    values[name] = el.value;
  });
  return values;
};
</script>
`

const buildSrcDoc = (source: FormSource) => {
  return `<!doctype html><html><head><meta charset="utf-8"/><style>${source.css || ''}</style></head><body>${source.html || ''}<script>${source.js || ''}</script>${collectScript}</body></html>`
}

const blocksFromDefinition = (def: any): FormBlock[] => {
  if (!def || typeof def !== 'object') return []
  if (Array.isArray(def.form_blocks)) {
    return def.form_blocks.map((b: any, idx: number) => ({
      id: String(b?.id ?? `block-${idx}`),
      type: b?.type as FormBlockType,
      label: b?.label,
      name: b?.name,
      placeholder: b?.placeholder,
      required: Boolean(b?.required),
      options: Array.isArray(b?.options) ? b.options : [],
    }))
  }
  const fields = Array.isArray(def.form_schema?.fields)
    ? def.form_schema.fields
    : Array.isArray(def.form)
      ? def.form
      : []
  return fields.map((f: any, idx: number) => ({
    id: String(f?.key ?? `block-${idx}`),
    type:
      f?.type === 'textarea'
        ? 'textarea'
        : f?.type === 'select'
          ? 'select'
          : f?.type === 'number'
            ? 'number'
            : f?.type === 'date'
              ? 'date'
              : f?.type === 'switch'
                ? 'switch'
                : 'input',
    label: f?.label,
    name: f?.key,
    placeholder: f?.placeholder,
    required: Boolean(f?.required),
    options: Array.isArray(f?.options) ? f.options : [],
  }))
}

export default function WorkflowTemplatesPage() {
  const { message } = App.useApp()
  const [items, setItems] = useState<WorkflowTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [form] = Form.useForm()
  const [editorTab, setEditorTab] = useState<'flow' | 'form'>('flow')
  const [historyModal, setHistoryModal] = useState<{ open: boolean; name?: string; entityType?: string }>({
    open: false,
  })

  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [userOptions, setUserOptions] = useState<Array<{ label: string; value: number }>>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [roleOptions, setRoleOptions] = useState<Array<{ label: string; value: number }>>([])
  const [loadingRoles, setLoadingRoles] = useState(false)
  const { loading: loadingDepts, treeData: deptTree, load: loadDepts } = useDepartmentsTree()
  const roleLabelMap = useMemo(() => {
    const map: Record<number, string> = {}
    for (const option of roleOptions) {
      if (typeof option.value === 'number') {
        map[option.value] = option.label
      }
    }
    return map
  }, [roleOptions])
  const [formBlocks, setFormBlocks] = useState<FormBlock[]>([])
  const [formSource, setFormSource] = useState<FormSource>(emptyFormSource)
  const [formView, setFormView] = useState<'designer' | 'source' | 'preview'>('designer')
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [sourceMode, setSourceMode] = useState<'designer' | 'custom'>('designer')
  const [newPermField, setNewPermField] = useState('')

  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId) ?? null, [nodes, selectedNodeId])
  const selectedEdge = useMemo(() => edges.find(e => e.id === selectedEdgeId) ?? null, [edges, selectedEdgeId])
  const selectedBlock = useMemo(() => formBlocks.find(b => b.id === selectedBlockId) ?? null, [formBlocks, selectedBlockId])
  const isLocked = modal.mode === 'edit' && modal.editing?.status === 'published'
  const permissionFields = useMemo(() => {
    if (!selectedNode?.data?.formPermissions) return []
    const fromBlocks = formBlocks.map(b => b.name).filter(Boolean) as string[]
    const fromPerms = Object.keys(selectedNode.data.formPermissions || {})
    return Array.from(new Set([...fromBlocks, ...fromPerms]))
  }, [formBlocks, selectedNode?.data?.formPermissions])
  const exampleSource = useMemo(() => {
    const exampleBlocks: FormBlock[] = [
      { id: 'title-1', type: 'title', label: '审批表单' },
      { id: 'reason', type: 'textarea', label: '审批说明', name: 'reason', required: true },
      {
        id: 'level',
        type: 'select',
        label: '优先级',
        name: 'level',
        options: [
          { value: 'low', label: '低' },
          { value: 'medium', label: '中' },
          { value: 'high', label: '高' },
        ],
      },
      { id: 'amount', type: 'number', label: '金额', name: 'amount' },
    ]
    return buildFormSourceFromBlocks(exampleBlocks)
  }, [])
  const historyItems = useMemo(() => {
    if (!historyModal.open) return []
    const name = historyModal.name
    const entityType = historyModal.entityType
    return items
      .filter(t => (!name || t.name === name) && (!entityType || t.entity_type === entityType))
      .slice()
      .sort((a, b) => Number(b.version || 0) - Number(a.version || 0))
  }, [historyModal, items])
  const latestItems = useMemo(() => {
    return pickLatestTemplates(items).sort((a, b) => {
      const at = a.updated_at ? new Date(a.updated_at).getTime() : 0
      const bt = b.updated_at ? new Date(b.updated_at).getTime() : 0
      return bt - at
    })
  }, [items])
  const previewSource = useMemo(() => {
    const hasSource = Boolean(formSource.html || formSource.css || formSource.js)
    return hasSource ? formSource : buildFormSourceFromBlocks(formBlocks)
  }, [formBlocks, formSource])
  const previewDoc = useMemo(() => buildSrcDoc(previewSource), [previewSource])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await workflowsApi.listTemplates()
      setItems(res.items || [])
    } catch (e: any) {
      message.error(e?.message || '加载模板失败')
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    load()
  }, [load])

  const fetchUsers = useCallback(
    async (keyword = '') => {
      setLoadingUsers(true)
      try {
        const data = await usersApi.list({ page: 1, limit: 20, search: keyword || undefined })
        const options = (data.users || []).map(u => ({
          value: u.id,
          label: `${u.nickname || u.username || `用户#${u.id}`}${u.email ? `（${u.email}）` : ''}`,
        }))
        setUserOptions(options)
      } catch (e: any) {
        message.error(e?.message || '加载用户失败')
        setUserOptions([])
      } finally {
        setLoadingUsers(false)
      }
    },
    [message]
  )

  const fetchRoles = useCallback(
    async (keyword = '') => {
      setLoadingRoles(true)
      try {
        const res: any = await rolesApi.list({ page: 1, pageSize: 200, keyword: keyword || undefined })
        const payload = res?.data ?? res
        const list = Array.isArray(payload?.roles) ? payload.roles : Array.isArray(payload) ? payload : []
        const options = list.map((r: any) => ({
          value: Number(r.id),
          label: r.name || r.code || `角色#${r.id}`,
        }))
        setRoleOptions(options)
      } catch (e: any) {
        message.error(e?.message || '加载角色失败')
        setRoleOptions([])
      } finally {
        setLoadingRoles(false)
      }
    },
    [message]
  )

  useEffect(() => {
    fetchRoles()
  }, [fetchRoles])

  useEffect(() => {
    if (!modal.open) return
    fetchUsers()
    fetchRoles()
    loadDepts()
  }, [fetchUsers, fetchRoles, loadDepts, modal.open])

  useEffect(() => {
    if (sourceMode !== 'designer') return
    const next = buildFormSourceFromBlocks(formBlocks)
    setFormSource(next)
  }, [formBlocks, sourceMode])

  const applyDefinition = (definition: any) => {
    const def = definition?.nodes?.length ? definition : defaultDefinition()
    const mappedNodes: WorkflowNode[] = (def.nodes || []).map((n: any, idx: number) => ({
      id: n.id,
      type: 'workflow',
      position: n.position && typeof n.position.x === 'number' && typeof n.position.y === 'number'
        ? { x: n.position.x, y: n.position.y }
        : { x: 80 + (idx % 3) * 220, y: 60 + Math.floor(idx / 3) * 160 },
      data: {
        nodeType: n.type as NodeType,
        label: n.name || n.id,
        approverUsers: toNumberArray(n.approver_users ?? n.approvers),
        approverRoles: toNumberArray(n.approver_roles),
        approverDepartments: toStringArray(n.approver_departments),
        approverDepartmentsIncludeChildren:
          typeof n.approver_departments_include_children === 'boolean'
            ? n.approver_departments_include_children
            : typeof n.approver_department_include_children === 'boolean'
              ? n.approver_department_include_children
              : false,
        approvers_from: n.approvers_from,
        approval_rule: n.approval_rule,
        required_approvals: n.required_approvals ? String(n.required_approvals) : undefined,
        reject_rule: n.reject_rule,
        approverExpression: n.approver_expression,
        approvalPreset: (n.approval_preset as WorkflowNodeData['approvalPreset']) ?? undefined,
        formPermissions: (n.form_permissions as WorkflowNodeData['formPermissions']) ?? undefined,
      },
    }))
    const mappedEdges = (def.edges || []).map((e: any, idx: number) => ({
      id: `e-${e.from}-${e.to}-${idx}`,
      source: e.from,
      target: e.to,
      data: e.condition
        ? {
            condition: {
              field: e.condition.field,
              op: e.condition.op,
              value: e.condition.value != null ? JSON.stringify(e.condition.value) : '',
            },
          }
        : undefined,
    }))
    setNodes(mappedNodes)
    setEdges(mappedEdges)
    const blocks = blocksFromDefinition(def)
    setFormBlocks(blocks)
    const source = def?.form_source || {
      html: def?.form_html,
      css: def?.form_css,
      js: def?.form_js,
    }
    const normalized: FormSource = {
      html: typeof source?.html === 'string' ? source.html : '',
      css: typeof source?.css === 'string' ? source.css : '',
      js: typeof source?.js === 'string' ? source.js : '',
    }
    const hasSource = Boolean(normalized.html || normalized.css || normalized.js)
    const fallback = hasSource ? normalized : buildFormSourceFromBlocks(blocks)
    setFormSource(fallback)
    setSourceMode(hasSource ? 'custom' : 'designer')
    setSelectedBlockId(null)
  }

  const openEditor = (tpl?: WorkflowTemplate, mode: ModalMode = tpl ? 'edit' : 'create') => {
    const nextMode = mode || (tpl ? 'edit' : 'create')
    const isClone = nextMode === 'clone'
    if (!isClone && tpl?.status === 'published') {
      message.warning('流程已启动，请先停止后再编辑')
      return
    }
    const nextTpl = tpl || null
    setModal({
      open: true,
      mode: nextMode,
      editing: nextMode === 'edit' ? nextTpl : null,
      cloneFrom: nextMode === 'clone' ? nextTpl : null,
    })
    setEditorTab('flow')
    setFormView('designer')
    form.setFieldsValue({
      name: nextTpl?.name || '',
      entity_type: nextTpl?.entity_type || 'exam',
      app_code: nextTpl?.app_code || undefined,
      module_code: nextTpl?.module_code || undefined,
      form_key: nextTpl?.form_key || undefined,
      form_name: nextTpl?.form_name || undefined,
      status: isClone ? 'draft' : nextTpl?.status || 'draft',
      version: isClone ? undefined : nextTpl?.version,
      starter_roles: nextTpl?.starter_roles || [],
    })
    applyDefinition(nextTpl?.definition || defaultDefinition())
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
  }

  const createBlock = (type: FormBlockType, index: number, id: string): FormBlock => {
    const baseLabel = formPalette.find(p => p.type === type)?.label || '字段'
    const needName = ['input', 'textarea', 'select', 'number', 'date', 'switch', 'checkbox', 'radio'].includes(type)
    const baseName = needName ? `${type}_${index + 1}` : undefined
    const options =
      type === 'select' || type === 'radio' || type === 'checkbox'
        ? [
            { label: '选项A', value: 'A' },
            { label: '选项B', value: 'B' },
          ]
        : undefined
    return {
      id,
      type,
      label: baseLabel,
      name: baseName,
      placeholder: needName ? '请输入' : undefined,
      required: false,
      options,
    }
  }

  const addBlock = (type: FormBlockType) => {
    if (isLocked) return
    const id = `block-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setFormBlocks(prev => {
      const block = createBlock(type, prev.length, id)
      return [...prev, block]
    })
    setSelectedBlockId(id)
  }

  const updateBlock = (id: string, patch: Partial<FormBlock>) => {
    if (isLocked) return
    setFormBlocks(prev => prev.map(b => (b.id === id ? { ...b, ...patch } : b)))
  }

  const removeBlock = (id: string) => {
    if (isLocked) return
    setFormBlocks(prev => prev.filter(b => b.id !== id))
    if (selectedBlockId === id) setSelectedBlockId(null)
  }

  const moveBlock = (id: string, dir: -1 | 1) => {
    if (isLocked) return
    setFormBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id)
      if (idx < 0) return prev
      const nextIdx = idx + dir
      if (nextIdx < 0 || nextIdx >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(idx, 1)
      next.splice(nextIdx, 0, item)
      return next
    })
  }

  const onPaletteDragStart = (evt: DragEvent<HTMLDivElement>, type: FormBlockType) => {
    evt.dataTransfer.setData('text/plain', type)
  }

  const onCanvasDrop = (evt: DragEvent<HTMLDivElement>) => {
    evt.preventDefault()
    const type = evt.dataTransfer.getData('text/plain') as FormBlockType
    if (type) addBlock(type)
  }

  const onCanvasDragOver = (evt: DragEvent<HTMLDivElement>) => {
    evt.preventDefault()
  }

  const addNode = (nodeType: NodeType) => {
    const id = `${nodeType}-${Date.now()}`
    const baseNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null
    const next: WorkflowNode = {
      id,
      type: 'workflow',
      position: baseNode ? { x: baseNode.position.x + 220, y: baseNode.position.y } : { x: 120, y: 120 + nodes.length * 30 },
      data: { nodeType, label: nodeType === 'approval' ? '审批' : nodeType === 'start' ? '开始' : '结束' },
    }
    setNodes(n => [...n, next])
    if (baseNode) {
      setEdges(eds => addEdge({ source: baseNode.id, target: id } as Connection, eds))
    }
    setSelectedNodeId(id)
    setSelectedEdgeId(null)
  }

  const onConnect = useCallback(
    (params: Connection) => {
      if (isLocked) return
      setEdges(eds => addEdge({ ...params, animated: false }, eds))
    },
    [isLocked, setEdges]
  )

  const updateNodeData = (id: string, patch: Partial<WorkflowNodeData>) => {
    if (isLocked) return
    setNodes(ns => ns.map(n => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)))
  }

  const applyPreset = (preset: typeof approvalPresets[number]) => {
    if (!selectedNode || selectedNode.data?.nodeType !== 'approval') return
    updateNodeData(selectedNode.id, {
      ...preset.config,
      approvalPreset: preset.key,
    })
  }

  const updateEdgeCondition = (id: string, patch: Partial<EdgeConditionForm>) => {
    if (isLocked) return
    setEdges(es =>
      es.map(e => {
        if (e.id !== id) return e
        const current = (e.data as any)?.condition || {}
        return { ...e, data: { ...(e.data as any), condition: { ...current, ...patch } } }
      })
    )
  }

  const buildDefinition = () => {
    const nodesOut = nodes.map(n => {
      const data = n.data as WorkflowNodeData
      const base: any = { id: n.id, type: data.nodeType, name: data.label || n.id, position: n.position }
      if (data.nodeType === 'approval') {
        if (data.approvers_from) base.approvers_from = data.approvers_from
        if (data.approverUsers?.length) base.approvers = toNumberArray(data.approverUsers)
        if (data.approverRoles?.length) base.approver_roles = toNumberArray(data.approverRoles)
        if (data.approverDepartments?.length) base.approver_departments = toNumberArray(data.approverDepartments)
        if (typeof data.approverDepartmentsIncludeChildren === 'boolean') {
          base.approver_departments_include_children = data.approverDepartmentsIncludeChildren
        }
        if (data.approval_rule) base.approval_rule = data.approval_rule
        if (data.required_approvals) base.required_approvals = data.required_approvals
        if (data.reject_rule) base.reject_rule = data.reject_rule
        if (data.approverExpression) base.approver_expression = data.approverExpression
        if (data.approvalPreset) base.approval_preset = data.approvalPreset
        if (data.formPermissions && Object.keys(data.formPermissions).length) {
          base.form_permissions = data.formPermissions
        }
      }
      return base
    })
    const edgesOut = edges
      .map(e => {
        const cond = (e.data as any)?.condition as EdgeConditionForm | undefined
        const condition =
          cond && cond.field && cond.op && cond.value != null && String(cond.value).trim()
            ? { field: cond.field, op: cond.op, value: parseConditionValue(cond.value) }
            : undefined
        return condition ? { from: e.source, to: e.target, condition } : { from: e.source, to: e.target }
      })
      .filter(e => e.from && e.to)
    const hasSource = Boolean(formSource.html || formSource.css || formSource.js)
    const source = hasSource ? formSource : buildFormSourceFromBlocks(formBlocks)
    return { nodes: nodesOut, edges: edgesOut, form_source: source, form_blocks: formBlocks }
  }

  const validateDefinition = () => {
    const startCount = nodes.filter(n => n.data?.nodeType === 'start').length
    const endCount = nodes.filter(n => n.data?.nodeType === 'end').length
    if (startCount !== 1) {
      message.error('必须且只能有一个开始节点')
      return false
    }
    if (endCount < 1) {
      message.error('至少需要一个结束节点')
      return false
    }
    const missingApprovers = nodes.filter(n => {
      if (n.data?.nodeType !== 'approval') return false
      const data = n.data as WorkflowNodeData
      return !(
        (data.approverUsers && data.approverUsers.length) ||
        (data.approverRoles && data.approverRoles.length) ||
        (data.approverDepartments && data.approverDepartments.length) ||
        (data.approvers_from && data.approvers_from.trim())
        || (data.approverExpression && data.approverExpression.trim())
      )
    })
    if (missingApprovers.length) {
      message.error('审批节点需要配置审核人（用户/角色/部门/或 payload）')
      return false
    }
    return true
  }

  const validateFormFields = () => {
    if (formView === 'designer') {
      const needName = new Set(['input', 'textarea', 'select', 'number', 'date', 'switch', 'checkbox', 'radio'])
      const names = formBlocks
        .filter(b => needName.has(b.type))
        .map(b => String(b.name || '').trim())
      if (names.some(n => !n)) {
        message.error('表单字段需要填写 name')
        return false
      }
      const unique = new Set(names.filter(Boolean))
      if (unique.size !== names.filter(Boolean).length) {
        message.error('表单字段 name 不能重复')
        return false
      }
      const invalidSelect = formBlocks.some(
        b => (b.type === 'select' || b.type === 'checkbox' || b.type === 'radio') && !(b.options && b.options.length)
      )
      if (invalidSelect) {
        message.error('下拉/单选/复选需要配置选项')
        return false
      }
    }
    return true
  }

  const save = async () => {
    if (isLocked) {
      message.warning('流程已启动，请先停止后再编辑')
      return
    }
    if (!validateDefinition()) return
    if (!validateFormFields()) return
    const values = await form.validateFields()
    const definition = buildDefinition()
    try {
      const version = values.version ? Number(values.version) : undefined
      const starterRoles = Array.isArray(values.starter_roles) && values.starter_roles.length ? values.starter_roles : undefined
      const editing = modal.mode === 'edit' ? modal.editing : null
      if (editing?.id) {
        await workflowsApi.updateTemplate(editing.id, {
          name: values.name,
          entity_type: values.entity_type,
          app_code: values.app_code,
          module_code: values.module_code,
          form_key: values.form_key,
          form_name: values.form_name,
          status: values.status,
          definition,
          starter_roles: starterRoles,
        })
        message.success('模板已更新')
      } else {
        await workflowsApi.createTemplate({
          name: values.name,
          entity_type: values.entity_type,
          app_code: values.app_code,
          module_code: values.module_code,
          form_key: values.form_key,
          form_name: values.form_name,
          status: values.status,
          version,
          definition,
          starter_roles: starterRoles,
        })
        message.success(modal.mode === 'clone' ? '新版本已创建' : '模板已创建')
      }
      setModal({ open: false })
      form.resetFields()
      load()
    } catch (e: any) {
      message.error(e?.message || '保存失败')
    }
  }

  const columns = useMemo(
    () => [
      { title: '模板名', dataIndex: 'name', key: 'name' },
      { title: '实体类型', dataIndex: 'entity_type', key: 'entity_type', width: 120 },
      { title: '应用', dataIndex: 'app_code', key: 'app_code', width: 120 },
      { title: '模块', dataIndex: 'module_code', key: 'module_code', width: 120 },
      { title: '表单', dataIndex: 'form_name', key: 'form_name', width: 140 },
      { title: '版本', dataIndex: 'version', key: 'version', width: 80 },
      {
        title: '发起角色',
        dataIndex: 'starter_roles',
        key: 'starter_roles',
        width: 220,
        render: (val: number[] = []) =>
          val?.length
            ? val.map(id => roleLabelMap[id] || `角色#${id}`).join('、')
            : '不限',
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 100,
        render: (val: string) => <Tag color={statusColor(val)}>{workflowStatusLabel(val)}</Tag>,
      },
      { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at', width: 180 },
      {
        title: '操作',
        key: 'actions',
        width: 240,
        render: (_: any, row: WorkflowTemplate) => (
          <Space>
            <Button type="link" disabled={row.status === 'published'} onClick={() => openEditor(row, 'edit')}>
              编辑
            </Button>
            {row.status === 'published' ? (
              <Popconfirm
                title="停止后才可以编辑流程，确认停止？"
                okText="停止"
                cancelText="取消"
                onConfirm={async () => {
                  try {
                    await workflowsApi.updateTemplate(row.id, { status: 'draft' })
                    message.success('流程已停止')
                    load()
                  } catch (e: any) {
                    message.error(e?.message || '停止失败')
                  }
                }}
              >
                <Button type="link" danger>
                  停止
                </Button>
              </Popconfirm>
            ) : (
              <Button
                type="link"
                onClick={async () => {
                  try {
                    await workflowsApi.publishTemplate(row.id)
                    message.success('流程已启动')
                    load()
                  } catch (e: any) {
                    message.error(e?.message || '启动失败')
                  }
                }}
              >
                启动
              </Button>
            )}
            <Button type="link" onClick={() => setHistoryModal({ open: true, name: row.name, entityType: row.entity_type })}>
              历史
            </Button>
          </Space>
        ),
      },
    ],
    [load, message, roleLabelMap]
  )

  const edgeCondition = (selectedEdge?.data as any)?.condition as EdgeConditionForm | undefined

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <div>
            <Title level={4} style={{ marginBottom: 0 }}>
              流程模板
            </Title>
            <Text type="secondary">拖拽节点 + 连线完成流程配置（选中节点再新增会自动连线）</Text>
          </div>
          <Button type="primary" onClick={() => openEditor(undefined, 'create')}>
            新建模板
          </Button>
        </Space>
      </Card>
      <Card>
        <Table rowKey="id" loading={loading} columns={columns as any} dataSource={latestItems} pagination={false} />
      </Card>
      <Modal
        open={modal.open}
        title={
          modal.mode === 'edit'
            ? '编辑模板'
            : modal.mode === 'clone'
              ? `基于历史版本创建${modal.cloneFrom ? `（v${modal.cloneFrom.version}）` : ''}`
              : '新建模板'
        }
        onCancel={() => setModal({ open: false })}
        onOk={save}
        width={1200}
        destroyOnClose
        okButtonProps={{ disabled: isLocked }}
      >
        <Form form={form} layout="vertical">
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <Text strong>流程参数</Text>
              <Space size="large" style={{ width: '100%', marginTop: 8 }} wrap>
                <Form.Item label="模板名" name="name" rules={[{ required: true, message: '请输入模板名' }]}>
                  <Input style={{ width: 240 }} disabled={isLocked} />
                </Form.Item>
                <Form.Item label="实体类型" name="entity_type" rules={[{ required: true, message: '请选择实体类型' }]}>
                  <Select
                    style={{ width: 200 }}
                    options={[
                      { value: 'exam', label: 'exam' },
                      { value: 'paper', label: 'paper' },
                    ]}
                    disabled={isLocked}
                  />
                </Form.Item>
                <Form.Item label="状态" name="status" initialValue="draft">
                  <Select
                    style={{ width: 200 }}
                    options={[
                      { value: 'draft', label: workflowStatusLabel('draft') },
                      { value: 'published', label: workflowStatusLabel('published') },
                    ]}
                    disabled
                  />
                </Form.Item>
                <Form.Item label="允许发起角色" name="starter_roles">
                  <Select
                    mode="multiple"
                    allowClear
                    placeholder="留空表示不限"
                    options={roleOptions}
                    style={{ width: 240 }}
                    disabled={isLocked}
                  />
                </Form.Item>
                <Form.Item label="版本" name="version">
                  <Input style={{ width: 120 }} placeholder="自动递增" disabled />
                </Form.Item>
              </Space>
            </div>
            <div>
              <Text strong>应用参数</Text>
              <Space size="large" style={{ width: '100%', marginTop: 8 }} wrap>
                <Form.Item label="应用标识" name="app_code">
                  <Input style={{ width: 180 }} placeholder="如 exam-system" disabled={isLocked} />
                </Form.Item>
                <Form.Item label="模块标识" name="module_code">
                  <Input style={{ width: 180 }} placeholder="如 exam/paper" disabled={isLocked} />
                </Form.Item>
                <Form.Item label="表单标识" name="form_key">
                  <Input style={{ width: 200 }} placeholder="如 exam-approval-form" disabled={isLocked} />
                </Form.Item>
                <Form.Item label="表单名称" name="form_name">
                  <Input style={{ width: 200 }} placeholder="如 考试审批表" disabled={isLocked} />
                </Form.Item>
              </Space>
            </div>
          </Space>
        </Form>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <Space>
            <Button type={editorTab === 'flow' ? 'primary' : 'default'} onClick={() => setEditorTab('flow')}>
              流程配置
            </Button>
            <Button type={editorTab === 'form' ? 'primary' : 'default'} onClick={() => setEditorTab('form')}>
              表单配置
            </Button>
          </Space>
        </div>

        {editorTab === 'flow' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, height: 560 }}>
            <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>
                <Space>
                  <Tooltip title="开始">
                    <Button icon={<PlayCircleOutlined />} onClick={() => addNode('start')} disabled={isLocked} />
                  </Tooltip>
                  <Tooltip title="审批">
                    <Button icon={<CheckCircleOutlined />} onClick={() => addNode('approval')} disabled={isLocked} />
                  </Tooltip>
                  <Tooltip title="结束">
                    <Button icon={<StopOutlined />} onClick={() => addNode('end')} disabled={isLocked} />
                  </Tooltip>
                </Space>
              </div>
              <div style={{ height: 500 }}>
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  nodeTypes={nodeTypes}
                  defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed } }}
                  connectionRadius={64}
                  connectionLineStyle={{ strokeWidth: 3, stroke: '#5c6ac4' }}
                  nodesDraggable={!isLocked}
                  nodesConnectable={!isLocked}
                  elementsSelectable={!isLocked}
                  onNodeClick={(_, node) => {
                    if (isLocked) return
                    setSelectedNodeId(node.id)
                    setSelectedEdgeId(null)
                  }}
                  onEdgeClick={(_, edge) => {
                    if (isLocked) return
                    setSelectedEdgeId(edge.id)
                    setSelectedNodeId(null)
                  }}
                  fitView
                >
                  <MiniMap />
                  <Controls />
                  <Background gap={16} />
                </ReactFlow>
              </div>
            </div>

            <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 12, overflow: 'auto' }}>
              <Text strong>节点配置</Text>
              {selectedNode ? (
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <Input
                  value={selectedNode.data.label}
                  disabled={isLocked}
                  onChange={e => updateNodeData(selectedNode.id, { label: e.target.value })}
                  placeholder="节点名称"
                />
                <Select
                  value={selectedNode.data.nodeType}
                  disabled={isLocked}
                  onChange={val => updateNodeData(selectedNode.id, { nodeType: val as NodeType })}
                  options={[
                    { value: 'start', label: 'start' },
                    { value: 'approval', label: 'approval' },
                    { value: 'end', label: 'end' },
                  ]}
                />

                {selectedNode.data.nodeType === 'approval' && (
                  <>
                    <Text type="secondary">快速预设</Text>
                    <Space wrap>
                      {approvalPresets.map(preset => (
                        <Button
                          key={preset.key}
                          size="small"
                          type={selectedNode.data.approvalPreset === preset.key ? 'primary' : 'default'}
                          disabled={isLocked}
                          onClick={() => applyPreset(preset)}
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </Space>
                    <Text type="secondary">
                      {approvalPresets.find(p => p.key === selectedNode.data.approvalPreset)?.description ||
                        '可选预设快速设置审批规则和人数'}
                    </Text>
                    <Text type="secondary">审批人（用户）</Text>
                    <Select
                      mode="multiple"
                      placeholder="搜索并选择用户"
                      showSearch
                      allowClear
                      filterOption={false}
                      options={userOptions}
                      loading={loadingUsers}
                      value={selectedNode.data.approverUsers}
                      disabled={isLocked}
                      onSearch={fetchUsers}
                      onChange={vals => updateNodeData(selectedNode.id, { approverUsers: vals as number[] })}
                      onDropdownVisibleChange={open => {
                        if (open && !userOptions.length) fetchUsers()
                      }}
                      dropdownMatchSelectWidth={false}
                      dropdownStyle={{ minWidth: 360 }}
                      style={{ width: '100%' }}
                    />
                    <Text type="secondary">审批人（角色）</Text>
                    <Select
                      mode="multiple"
                      placeholder="选择角色"
                      allowClear
                      showSearch
                      optionFilterProp="label"
                      options={roleOptions}
                      loading={loadingRoles}
                      value={selectedNode.data.approverRoles}
                      disabled={isLocked}
                      onChange={vals => updateNodeData(selectedNode.id, { approverRoles: vals as number[] })}
                      onDropdownVisibleChange={open => {
                        if (open && !roleOptions.length) fetchRoles()
                      }}
                      dropdownMatchSelectWidth={false}
                      dropdownStyle={{ minWidth: 360 }}
                      style={{ width: '100%' }}
                    />
                    <Text type="secondary">审批人（部门）</Text>
                    <TreeSelect
                      multiple
                      treeCheckable
                      showCheckedStrategy={TreeSelect.SHOW_PARENT}
                      showSearch
                      allowClear
                      treeDefaultExpandAll
                      treeNodeFilterProp="title"
                      treeData={deptTree}
                      placeholder={loadingDepts ? '加载部门中…' : '选择部门'}
                      value={selectedNode.data.approverDepartments}
                      disabled={isLocked}
                      onChange={vals => updateNodeData(selectedNode.id, { approverDepartments: vals as string[] })}
                      dropdownMatchSelectWidth={false}
                      dropdownStyle={{ minWidth: 360 }}
                      onDropdownVisibleChange={open => {
                        if (open && !deptTree.length) loadDepts()
                      }}
                    />
                    <Checkbox
                      checked={selectedNode.data.approverDepartmentsIncludeChildren ?? false}
                      disabled={isLocked}
                      onChange={e => updateNodeData(selectedNode.id, { approverDepartmentsIncludeChildren: e.target.checked })}
                    >
                      包含子部门
                    </Checkbox>
                    <Text type="secondary">审批人表达式</Text>
                    <TextArea
                      value={selectedNode.data.approverExpression}
                      disabled={isLocked}
                      onChange={e => updateNodeData(selectedNode.id, { approverExpression: e.target.value })}
                      placeholder="user:1,2; role:5; dept:10; dept-child:12; payload:payload.reviewer_ids"
                      rows={3}
                    />
                    <Text type="secondary">
                      表达式说明：user/role/dept/dept-child/payload，各段用 ';' 分隔；payload 可带路径。
                    </Text>
                    <Text type="secondary">或从 payload 取（如 payload.reviewer_ids）</Text>
                    <Input
                      value={selectedNode.data.approvers_from}
                      disabled={isLocked}
                      onChange={e => updateNodeData(selectedNode.id, { approvers_from: e.target.value })}
                      placeholder="payload.reviewer_ids"
                    />
                    <Text type="secondary">通过规则</Text>
                    <Select
                      value={selectedNode.data.approval_rule || 'all'}
                      disabled={isLocked}
                      onChange={val => updateNodeData(selectedNode.id, { approval_rule: val as any })}
                      options={[
                        { value: 'any', label: 'any' },
                        { value: 'all', label: 'all' },
                        { value: 'majority', label: 'majority' },
                        { value: 'count', label: 'count' },
                      ]}
                    />
                    <Text type="secondary">通过数量/表达式</Text>
                    <Input
                      value={selectedNode.data.required_approvals}
                      disabled={isLocked}
                      onChange={e => updateNodeData(selectedNode.id, { required_approvals: e.target.value })}
                      placeholder="2 或 payload.required_approvals"
                    />
                    <Text type="secondary">驳回规则</Text>
                    <Select
                      value={selectedNode.data.reject_rule || 'any'}
                      disabled={isLocked}
                      onChange={val => updateNodeData(selectedNode.id, { reject_rule: val as any })}
                      options={[
                        { value: 'any', label: 'any' },
                        { value: 'majority', label: 'majority' },
                        { value: 'count', label: 'count' },
                      ]}
                    />
                    <Text type="secondary">表单字段权限（可见/可编辑）</Text>
                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                      <Space.Compact style={{ width: '100%' }}>
                        <Input
                          placeholder="字段 name（如 title）"
                          value={newPermField}
                          disabled={isLocked}
                          onChange={e => setNewPermField(e.target.value)}
                        />
                        <Button
                          disabled={isLocked}
                          onClick={() => {
                            const name = newPermField.trim()
                            if (!name) return
                            const next = { ...(selectedNode.data.formPermissions || {}), [name]: 'read' as const }
                            updateNodeData(selectedNode.id, { formPermissions: next })
                            setNewPermField('')
                          }}
                        >
                          添加
                        </Button>
                      </Space.Compact>
                      {permissionFields.length ? (
                        permissionFields.map(field => {
                          const current = selectedNode.data.formPermissions?.[field] || 'read'
                          const visible = current !== 'hidden'
                          const editable = current === 'edit'
                          return (
                            <Space key={field} style={{ width: '100%', justifyContent: 'space-between' }}>
                              <Text>{field}</Text>
                              <Space>
                                <Checkbox
                                  checked={visible}
                                  disabled={isLocked}
                                  onChange={e => {
                                    const next = { ...(selectedNode.data.formPermissions || {}) }
                                    if (!e.target.checked) next[field] = 'hidden'
                                    else next[field] = editable ? 'edit' : 'read'
                                    updateNodeData(selectedNode.id, { formPermissions: next })
                                  }}
                                >
                                  可见
                                </Checkbox>
                                <Checkbox
                                  checked={editable}
                                  disabled={isLocked}
                                  onChange={e => {
                                    const next = { ...(selectedNode.data.formPermissions || {}) }
                                    next[field] = e.target.checked ? 'edit' : 'read'
                                    updateNodeData(selectedNode.id, { formPermissions: next })
                                  }}
                                >
                                  可编辑
                                </Checkbox>
                                <Button
                                  size="small"
                                  disabled={isLocked}
                                  danger
                                  onClick={() => {
                                    const next = { ...(selectedNode.data.formPermissions || {}) }
                                    delete next[field]
                                    updateNodeData(selectedNode.id, { formPermissions: next })
                                  }}
                                >
                                  删除
                                </Button>
                              </Space>
                            </Space>
                          )
                        })
                      ) : (
                        <Text type="secondary">暂无字段，拖拽组件后可自动识别 name</Text>
                      )}
                    </Space>
                  </>
                )}
              </Space>
            ) : selectedEdge ? (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Text strong>连线条件</Text>
                <Input
                  value={edgeCondition?.field}
                  disabled={isLocked}
                  onChange={e => updateEdgeCondition(selectedEdge.id, { field: e.target.value })}
                  placeholder="payload.score"
                />
                <Select
                  value={edgeCondition?.op || '=='}
                  disabled={isLocked}
                  onChange={val => updateEdgeCondition(selectedEdge.id, { op: val as ConditionOp })}
                  options={[
                    { value: '==', label: '==' },
                    { value: '!=', label: '!=' },
                    { value: '>', label: '>' },
                    { value: '>=', label: '>=' },
                    { value: '<', label: '<' },
                    { value: '<=', label: '<=' },
                    { value: 'in', label: 'in' },
                    { value: 'not_in', label: 'not_in' },
                  ]}
                />
                <TextArea
                  value={edgeCondition?.value}
                  disabled={isLocked}
                  onChange={e => updateEdgeCondition(selectedEdge.id, { value: e.target.value })}
                  placeholder="100 或 [1,2,3]"
                  rows={4}
                />
              </Space>
            ) : (
              <Text type="secondary">选择节点或连线进行配置</Text>
            )}
            </div>
          </div>
        ) : (
          <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 12, height: 560, overflow: 'auto' }}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Text strong>模板表单</Text>
                <Segmented
                  value={formView}
                  onChange={val => setFormView(val as 'designer' | 'source' | 'preview')}
                  options={[
                    { label: '设计器', value: 'designer' },
                    { label: '源码', value: 'source' },
                    { label: '预览', value: 'preview' },
                  ]}
                />
              </Space>
              {formView === 'designer' ? (
                <>
                  {sourceMode === 'custom' && (
                    <Alert
                      type="warning"
                      showIcon
                      message="源码已自定义，设计器修改不会同步到源码"
                      action={
                        <Button
                          size="small"
                          onClick={() => {
                            if (isLocked) return
                            const next = buildFormSourceFromBlocks(formBlocks)
                            setFormSource(next)
                            setSourceMode('designer')
                          }}
                        >
                          用设计器覆盖源码
                        </Button>
                      }
                    />
                  )}
                  <div style={{ fontWeight: 600 }}>组件库（拖拽到画布）</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {formPalette.map(item => (
                      <div
                        key={item.type}
                        draggable={!isLocked}
                        onDragStart={e => onPaletteDragStart(e, item.type)}
                        style={{
                          padding: '6px 8px',
                          border: '1px solid #e5e7eb',
                          borderRadius: 6,
                          background: '#fff',
                          cursor: isLocked ? 'not-allowed' : 'grab',
                          fontSize: 12,
                        }}
                      >
                        {item.label}
                      </div>
                    ))}
                  </div>
                  <div style={{ fontWeight: 600, marginTop: 8 }}>表单画布</div>
                  <div
                    onDrop={onCanvasDrop}
                    onDragOver={onCanvasDragOver}
                    style={{ minHeight: 120, border: '1px dashed #d1d5db', borderRadius: 6, padding: 8 }}
                  >
                    {formBlocks.length ? (
                      <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        {formBlocks.map((block, idx) => (
                          <div
                            key={block.id}
                            onClick={() => setSelectedBlockId(block.id)}
                            style={{
                              border: '1px solid #e5e7eb',
                              borderRadius: 6,
                              padding: 8,
                              background: selectedBlockId === block.id ? '#f0f9ff' : '#fff',
                              cursor: 'pointer',
                            }}
                          >
                            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                              <div>
                                <div style={{ fontWeight: 600 }}>{block.label || '未命名'}</div>
                                <Text type="secondary">{block.type}</Text>
                              </div>
                              <Space>
                                <Button size="small" disabled={isLocked || idx === 0} onClick={() => moveBlock(block.id, -1)}>
                                  上移
                                </Button>
                                <Button
                                  size="small"
                                  disabled={isLocked || idx === formBlocks.length - 1}
                                  onClick={() => moveBlock(block.id, 1)}
                                >
                                  下移
                                </Button>
                                <Button size="small" danger disabled={isLocked} onClick={() => removeBlock(block.id)}>
                                  删除
                                </Button>
                              </Space>
                            </Space>
                          </div>
                        ))}
                      </Space>
                    ) : (
                      <Text type="secondary">拖拽组件到这里开始搭建表单</Text>
                    )}
                  </div>
                  {selectedBlock && (
                    <div style={{ marginTop: 12 }}>
                      <Text strong>字段属性</Text>
                      <Space direction="vertical" size="small" style={{ width: '100%', marginTop: 8 }}>
                        <Input
                          placeholder="字段标题"
                          value={selectedBlock.label}
                          disabled={isLocked}
                          onChange={e => updateBlock(selectedBlock.id, { label: e.target.value })}
                        />
                        {['input', 'textarea', 'select', 'number', 'date', 'switch', 'checkbox', 'radio'].includes(selectedBlock.type) && (
                          <Input
                            placeholder="字段 name（用于提交）"
                            value={selectedBlock.name}
                            disabled={isLocked}
                            onChange={e => updateBlock(selectedBlock.id, { name: e.target.value })}
                          />
                        )}
                        {['input', 'textarea', 'number', 'date'].includes(selectedBlock.type) && (
                          <Input
                            placeholder="占位提示"
                            value={selectedBlock.placeholder}
                            disabled={isLocked}
                            onChange={e => updateBlock(selectedBlock.id, { placeholder: e.target.value })}
                          />
                        )}
                        {['input', 'textarea', 'select', 'number', 'date', 'checkbox', 'radio'].includes(selectedBlock.type) && (
                          <Space>
                            <Text>必填</Text>
                            <Switch
                              checked={Boolean(selectedBlock.required)}
                              disabled={isLocked}
                              onChange={checked => updateBlock(selectedBlock.id, { required: checked })}
                            />
                          </Space>
                        )}
                        {['select', 'checkbox', 'radio'].includes(selectedBlock.type) && (
                          <TextArea
                            placeholder="选项，每行一个，可写 value|label"
                            rows={4}
                            value={(selectedBlock.options || [])
                              .map(opt => `${opt.value}${opt.label ? `|${opt.label}` : ''}`)
                              .join('\n')}
                            disabled={isLocked}
                            onChange={e =>
                              updateBlock(selectedBlock.id, {
                                options: e.target.value
                                  .split('\n')
                                  .map(line => line.trim())
                                  .filter(Boolean)
                                  .map(line => {
                                    const [value, label] = line.split('|').map(s => s.trim())
                                    return { value, label: label || value }
                                  }),
                              })
                            }
                          />
                        )}
                      </Space>
                    </div>
                  )}
                </>
              ) : formView === 'source' ? (
                <>
                  <TextArea
                    rows={6}
                    value={formSource.html}
                    disabled={isLocked}
                    onChange={e => {
                      setFormSource(prev => ({ ...prev, html: e.target.value }))
                      setSourceMode('custom')
                    }}
                    placeholder="HTML 结构"
                  />
                  <TextArea
                    rows={5}
                    value={formSource.css}
                    disabled={isLocked}
                    onChange={e => {
                      setFormSource(prev => ({ ...prev, css: e.target.value }))
                      setSourceMode('custom')
                    }}
                    placeholder="CSS 样式"
                  />
                  <TextArea
                    rows={5}
                    value={formSource.js}
                    disabled={isLocked}
                    onChange={e => {
                      setFormSource(prev => ({ ...prev, js: e.target.value }))
                      setSourceMode('custom')
                    }}
                    placeholder="JS 脚本（可访问 DOM）"
                  />
                  <Space>
                    <Button
                      size="small"
                      disabled={isLocked}
                      onClick={() => {
                        const next = buildFormSourceFromBlocks(formBlocks)
                        setFormSource(next)
                        setSourceMode('designer')
                      }}
                    >
                      使用设计器生成
                    </Button>
                    <Button
                      size="small"
                      disabled={isLocked}
                      onClick={() => {
                        setFormSource(exampleSource)
                        setSourceMode('custom')
                      }}
                    >
                      插入示例
                    </Button>
                  </Space>
                  <Text type="secondary">提示：iframe 预览会执行 JS，请注意安全。</Text>
                </>
              ) : (
                <iframe
                  title="form-preview"
                  sandbox="allow-scripts allow-same-origin allow-forms"
                  srcDoc={previewDoc}
                  style={{ width: '100%', height: 360, border: '1px solid #e5e7eb', borderRadius: 6 }}
                />
              )}
            </Space>
          </div>
        )}
      </Modal>
      <Modal
        open={historyModal.open}
        title={`历史版本${historyModal.name ? ` - ${historyModal.name}` : ''}`}
        footer={null}
        width={720}
        onCancel={() => setHistoryModal({ open: false })}
      >
        <Table
          rowKey="id"
          size="small"
          dataSource={historyItems}
          pagination={false}
          columns={[
            { title: '版本', dataIndex: 'version', key: 'version', width: 80 },
            {
              title: '状态',
              dataIndex: 'status',
              key: 'status',
              width: 120,
              render: (val: string) => workflowStatusLabel(val),
            },
            { title: '实体类型', dataIndex: 'entity_type', key: 'entity_type', width: 120 },
            { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at' },
            {
              title: '操作',
              key: 'actions',
              width: 140,
              render: (_: any, row: WorkflowTemplate) => (
                <Button
                  type="link"
                  onClick={() => {
                    setHistoryModal({ open: false })
                    openEditor(row, 'clone')
                  }}
                >
                  编辑为新版本
                </Button>
              ),
            },
          ]}
        />
      </Modal>
    </Space>
  )
}
