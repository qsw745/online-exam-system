import {
  Alert,
  App,
  Button,
  Card,
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
  Typography,
} from 'antd'
import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react'
import { workflowsApi, type WorkflowTemplate } from '@/shared/api/endpoints/workflows'
import { isSuccess, getErr } from '@/shared/api/core/types'
import { createTablePaginationConfig } from '@/shared/constants/pagination'
import { usersApi } from '@/shared/api/endpoints/users'
import { rolesApi } from '@/shared/api/endpoints/roles'
import { useLanguage } from '@/shared/contexts/LanguageContext'
import { formatDateTime } from '@/shared/utils/datetime'
import ApprovalFlowDesigner, {
  type FlowDefinition,
  type FlowNode as AfdNode,
  type ApprovalMode,
} from '@/features/workflows/components/ApprovalFlowDesigner'

// —— 钉钉式设计器模型 ↔ 后端 definition 双向转换 ——
function ruleToMode(rule?: string, mode?: string): ApprovalMode {
  if (mode === 'and' || mode === 'or' || mode === 'sequential' || mode === 'single') return mode
  if (rule === 'all') return 'and'
  return 'or'
}
function modeToRule(mode?: ApprovalMode): 'all' | 'any' {
  return mode === 'and' || mode === 'sequential' ? 'all' : 'any'
}
const FORM_FIELD_PREFIX = 'payload.form_values.'

// 后端 definition → 设计器树：优先用保存的 design 树（精确回显含条件分支），否则从线性 nodes 重建（旧数据）
function definitionToFlowDef(def: any, t: TranslateFn): FlowDefinition {
  if (def?.design?.nodes?.length) return def.design as FlowDefinition
  const nodes: AfdNode[] = (def?.nodes || [])
    .filter((n: any) => n.type !== 'gateway')
    .map((n: any) => {
      const type = n.type
      if (type === 'approval') {
        const roles = (n.approver_roles || []).map((x: any) => Number(x)).filter(Number.isFinite)
        const users = (n.approver_users ?? n.approvers ?? []).map((x: any) => Number(x)).filter(Number.isFinite)
        return {
          id: n.id,
          type: 'approval',
          name: n.name || t('workflowTemplates.node.approver'),
          approverType: n.approver_type || (users.length ? 'user' : 'role'),
          approverRoles: roles,
          approverUsers: users,
          mode: ruleToMode(n.approval_rule, n.mode),
          formPermissions: n.form_permissions || undefined,
        } as AfdNode
      }
      if (type === 'cc') {
        return {
          id: n.id,
          type: 'cc',
          name: n.name || t('workflowTemplates.node.cc'),
          ccRoles: (n.cc_roles || []).map((x: any) => Number(x)).filter(Number.isFinite),
          ccUsers: (n.cc_users || []).map((x: any) => Number(x)).filter(Number.isFinite),
        } as AfdNode
      }
      return { id: n.id || type, type, name: n.name || (type === 'start' ? t('workflowTemplates.node.initiator') : t('workflowTemplates.node.end')) } as AfdNode
    })
  if (!nodes.length) {
    nodes.push({ id: 'start', type: 'start', name: t('workflowTemplates.node.initiator') }, { id: 'end', type: 'end', name: t('workflowTemplates.node.end') })
  }
  return { nodes }
}

function approvalToBackend(n: AfdNode): any {
  const base: any = {
    id: n.id,
    type: 'approval',
    name: n.name,
    approver_type: n.approverType || 'role',
    mode: n.mode || 'or',
    approval_rule: modeToRule(n.mode),
  }
  if (n.approverRoles?.length) base.approver_roles = n.approverRoles
  if (n.approverUsers?.length) base.approvers = n.approverUsers
  if (n.formPermissions && Object.keys(n.formPermissions).length) base.form_permissions = n.formPermissions
  return base
}

// 设计器树 → 后端 {nodes, edges}：条件组编译成 gateway 节点 + 带 condition/priority 的出边
// 右→左遍历每条链，使每个元素都知道其后继 entry id，分支天然汇聚到后继
function flattenFlowDef(flow: FlowDefinition, t: TranslateFn): { nodes: any[]; edges: any[] } {
  const outNodes: any[] = []
  const outEdges: any[] = []

  const emitSeq = (seq: AfdNode[], successorId: string): string => {
    let succ = successorId
    for (let i = seq.length - 1; i >= 0; i--) succ = emitNode(seq[i], succ)
    return succ
  }

  const emitNode = (node: AfdNode, successorId: string): string => {
    if (node.type === 'condition') {
      const gatewayId = node.id
      outNodes.push({ id: gatewayId, type: 'gateway', name: node.name || t('workflowTemplates.node.condition') })
      ;(node.branches || []).forEach((branch, idx) => {
        const priority = branch.isDefault ? 999 : idx
        const entry =
          branch.children && branch.children.length ? emitSeq(branch.children, successorId) : successorId
        const edge: any = { from: gatewayId, to: entry, priority }
        if (!branch.isDefault && branch.field) {
          edge.condition = {
            field: branch.field.startsWith('payload.') ? branch.field : `${FORM_FIELD_PREFIX}${branch.field}`,
            op: branch.op || '==',
            value: branch.value ?? '',
          }
        }
        outEdges.push(edge)
      })
      return gatewayId
    }
    if (node.type === 'approval') outNodes.push(approvalToBackend(node))
    else if (node.type === 'cc') {
      const base: any = { id: node.id, type: 'cc', name: node.name }
      if (node.ccRoles?.length) base.cc_roles = node.ccRoles
      if (node.ccUsers?.length) base.cc_users = node.ccUsers
      outNodes.push(base)
    } else outNodes.push({ id: node.id, type: node.type, name: node.name })
    if (node.type !== 'end') outEdges.push({ from: node.id, to: successorId })
    return node.id
  }

  emitSeq(flow.nodes || [], '__end__')
  return { nodes: outNodes, edges: outEdges }
}
import { pickLatestTemplates } from '@/shared/utils/workflow'

const { Title, Text } = Typography
const { TextArea } = Input

type TranslateFn = (key: string, fallback?: string) => string
type TranslationValues = Record<string, string | number | null | undefined>

const formatText = (template: string, values: TranslationValues = {}) =>
  Object.entries(values).reduce((next, [key, value]) => next.replaceAll(`{${key}}`, String(value ?? '')), template)

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

type ModalMode = 'create' | 'edit' | 'clone'
type ModalState = { open: boolean; mode?: ModalMode; editing?: WorkflowTemplate | null; cloneFrom?: WorkflowTemplate | null }

const statusColor = (s: string) => (s === 'published' ? 'success' : 'default')

const defaultDefinition = (t: TranslateFn) => ({
  nodes: [
    { id: 'start', type: 'start', name: t('workflowTemplates.node.start') },
    {
      id: 'review',
      type: 'approval',
      name: t('workflowTemplates.node.review'),
      approvers_from: 'payload.reviewer_ids',
      approval_rule: 'count',
      required_approvals: 'payload.required_approvals',
      reject_rule: 'any',
    },
    { id: 'end', type: 'end', name: t('workflowTemplates.node.end') },
  ],
  edges: [
    { from: 'start', to: 'review' },
    { from: 'review', to: 'end' },
  ],
  form: [],
})

const emptyFormSource: FormSource = { html: '', css: '', js: '' }

const getFormPalette = (t: TranslateFn): Array<{ type: FormBlockType; label: string }> => [
  { type: 'input', label: t('workflowTemplates.formPalette.input') },
  { type: 'textarea', label: t('workflowTemplates.formPalette.textarea') },
  { type: 'select', label: t('workflowTemplates.formPalette.select') },
  { type: 'number', label: t('workflowTemplates.formPalette.number') },
  { type: 'date', label: t('workflowTemplates.formPalette.date') },
  { type: 'switch', label: t('workflowTemplates.formPalette.switch') },
  { type: 'checkbox', label: t('workflowTemplates.formPalette.checkbox') },
  { type: 'radio', label: t('workflowTemplates.formPalette.radio') },
  { type: 'title', label: t('workflowTemplates.formPalette.title') },
  { type: 'paragraph', label: t('workflowTemplates.formPalette.paragraph') },
  { type: 'divider', label: t('workflowTemplates.formPalette.divider') },
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

const renderBlockHtml = (block: FormBlock, t: TranslateFn) => {
  const label = block.label || block.name || t('workflowTemplates.form.unnamed_field')
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

const buildFormSourceFromBlocks = (blocks: FormBlock[], t: TranslateFn): FormSource => {
  const html = `<form class="wf-form">${blocks.map(block => renderBlockHtml(block, t)).join('')}</form>`
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
  const { t } = useLanguage()
  const [items, setItems] = useState<WorkflowTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [form] = Form.useForm()
  const [editorTab, setEditorTab] = useState<'flow' | 'form'>('flow')
  const [relatedModal, setRelatedModal] = useState<{
    open: boolean
    loading?: boolean
    name?: string
    data?: Awaited<ReturnType<typeof workflowsApi.templateRelated>> | null
  }>({ open: false })
  const [historyModal, setHistoryModal] = useState<{ open: boolean; name?: string; entityType?: string }>({
    open: false,
  })
  const formPalette = useMemo(() => getFormPalette(t), [t])

  // 钉钉式设计器模型（新设计器的数据源）
  const [flowDef, setFlowDef] = useState<FlowDefinition>(() => definitionToFlowDef(null, t))
  const [userOptions, setUserOptions] = useState<Array<{ label: string; value: number }>>([])
  const [roleOptions, setRoleOptions] = useState<Array<{ label: string; value: number }>>([])
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

  const selectedBlock = useMemo(() => formBlocks.find(b => b.id === selectedBlockId) ?? null, [formBlocks, selectedBlockId])
  // 条件分支可选的表单字段（供设计器选择判断字段）
  const fieldOptions = useMemo(
    () =>
      formBlocks
        .filter(b => b.name && b.name.trim())
        .map(b => ({ label: `${b.label || b.name} (${b.name})`, value: String(b.name) })),
    [formBlocks]
  )
  const isLocked = modal.mode === 'edit' && modal.editing?.status === 'published'
  const exampleSource = useMemo(() => {
    const exampleBlocks: FormBlock[] = [
      { id: 'title-1', type: 'title', label: t('workflowTemplates.example.title') },
      { id: 'reason', type: 'textarea', label: t('workflowTemplates.example.reason'), name: 'reason', required: true },
      {
        id: 'level',
        type: 'select',
        label: t('workflowTemplates.example.priority'),
        name: 'level',
        options: [
          { value: 'low', label: t('workflowTemplates.example.priority_low') },
          { value: 'medium', label: t('workflowTemplates.example.priority_medium') },
          { value: 'high', label: t('workflowTemplates.example.priority_high') },
        ],
      },
      { id: 'amount', type: 'number', label: t('workflowTemplates.example.amount'), name: 'amount' },
    ]
    return buildFormSourceFromBlocks(exampleBlocks, t)
  }, [t])
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
  // 名称搜索 + 分页（模板量级不大，客户端过滤即可）
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const filteredItems = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return latestItems
    return latestItems.filter(
      it => String(it.name || '').toLowerCase().includes(kw) || String(it.entity_type || '').toLowerCase().includes(kw)
    )
  }, [latestItems, keyword])
  const previewSource = useMemo(() => {
    const hasSource = Boolean(formSource.html || formSource.css || formSource.js)
    return hasSource ? formSource : buildFormSourceFromBlocks(formBlocks, t)
  }, [formBlocks, formSource, t])
  const previewDoc = useMemo(() => buildSrcDoc(previewSource), [previewSource])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await workflowsApi.listTemplates()
      setItems(res.items || [])
    } catch (e: any) {
      message.error(e?.message || t('workflowTemplates.errors.load_templates_failed'))
    } finally {
      setLoading(false)
    }
  }, [message, t])

  useEffect(() => {
    load()
  }, [load])

  const fetchUsers = useCallback(
    async (keyword = '') => {
      try {
        const data = await usersApi.list({ page: 1, limit: 20, search: keyword || undefined })
        const options = (data.users || []).map(u => ({
          value: u.id,
          label: `${u.nickname || u.username || formatText(t('workflowTemplates.user_fallback'), { id: u.id })}${u.email ? ` (${u.email})` : ''}`,
        }))
        setUserOptions(options)
      } catch (e: any) {
        message.error(e?.message || t('workflowTemplates.errors.load_users_failed'))
        setUserOptions([])
      }
    },
    [message, t]
  )

  const fetchRoles = useCallback(
    async (keyword = '') => {
      try {
        const res: any = await rolesApi.list({ page: 1, pageSize: 200, keyword: keyword || undefined })
        const payload = res?.data ?? res
        const list = Array.isArray(payload?.roles) ? payload.roles : Array.isArray(payload) ? payload : []
        const options = list.map((r: any) => ({
          value: Number(r.id),
          label: r.name || r.code || formatText(t('workflowTemplates.role_fallback'), { id: r.id }),
        }))
        setRoleOptions(options)
      } catch (e: any) {
        message.error(e?.message || t('workflowTemplates.errors.load_roles_failed'))
        setRoleOptions([])
      }
    },
    [message, t]
  )

  useEffect(() => {
    fetchRoles()
  }, [fetchRoles])

  useEffect(() => {
    if (!modal.open) return
    fetchUsers()
    fetchRoles()
  }, [fetchUsers, fetchRoles, modal.open])

  useEffect(() => {
    if (sourceMode !== 'designer') return
    const next = buildFormSourceFromBlocks(formBlocks, t)
    setFormSource(next)
  }, [formBlocks, sourceMode, t])

  const applyDefinition = (definition: any) => {
    const def = definition?.nodes?.length ? definition : defaultDefinition(t)
    setFlowDef(definitionToFlowDef(def, t))
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
    const fallback = hasSource ? normalized : buildFormSourceFromBlocks(blocks, t)
    setFormSource(fallback)
    setSourceMode(hasSource ? 'custom' : 'designer')
    setSelectedBlockId(null)
  }

  const openEditor = (tpl?: WorkflowTemplate, mode: ModalMode = tpl ? 'edit' : 'create') => {
    const nextMode = mode || (tpl ? 'edit' : 'create')
    const isClone = nextMode === 'clone'
    if (!isClone && tpl?.status === 'published') {
      message.warning(t('workflowTemplates.errors.stop_before_edit'))
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
    applyDefinition(nextTpl?.definition || defaultDefinition(t))
  }

  const createBlock = (type: FormBlockType, index: number, id: string): FormBlock => {
    const baseLabel = formPalette.find(p => p.type === type)?.label || t('workflowTemplates.form.field')
    const needName = ['input', 'textarea', 'select', 'number', 'date', 'switch', 'checkbox', 'radio'].includes(type)
    const baseName = needName ? `${type}_${index + 1}` : undefined
    const options =
      type === 'select' || type === 'radio' || type === 'checkbox'
        ? [
            { label: t('workflowTemplates.form.option_a'), value: 'A' },
            { label: t('workflowTemplates.form.option_b'), value: 'B' },
          ]
        : undefined
    return {
      id,
      type,
      label: baseLabel,
      name: baseName,
      placeholder: needName ? t('app.enter') : undefined,
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

  const buildDefinition = () => {
    // 钉钉式设计器是流程数据源；树扁平化为后端 {nodes,edges}，并保存 design 树用于精确回显
    const flat = flattenFlowDef(flowDef, t)
    const hasSource = Boolean(formSource.html || formSource.css || formSource.js)
    const source = hasSource ? formSource : buildFormSourceFromBlocks(formBlocks, t)
    return { nodes: flat.nodes, edges: flat.edges, design: flowDef, form_source: source, form_blocks: formBlocks }
  }

  const validateDefinition = () => {
    let approvalCount = 0
    let error: string | null = null
    const walk = (seq: AfdNode[]) => {
      for (const n of seq) {
        if (error) return
        if (n.type === 'approval') {
          approvalCount += 1
          const approverType = n.approverType || 'role'
          if (approverType === 'role' && !(n.approverRoles && n.approverRoles.length)) error = t('workflowTemplates.errors.approver_required')
          if (approverType === 'user' && !(n.approverUsers && n.approverUsers.length)) error = t('workflowTemplates.errors.approver_required')
        } else if (n.type === 'condition') {
          const branches = n.branches || []
          const conditioned = branches.filter(b => !b.isDefault)
          if (!conditioned.length) error = t('workflowTemplates.errors.condition_required')
          for (const b of conditioned) {
            if (!b.field || b.value === undefined || String(b.value).trim() === '') {
              error = formatText(t('workflowTemplates.errors.condition_field_required'), { name: b.name || t('workflowTemplates.condition') })
            }
            walk(b.children)
          }
          for (const b of branches.filter(b => b.isDefault)) walk(b.children)
        }
      }
    }
    walk(flowDef.nodes)
    if (!approvalCount) {
      message.error(t('workflowTemplates.errors.approval_node_required'))
      return false
    }
    if (error) {
      message.error(error)
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
        message.error(t('workflowTemplates.errors.field_name_required'))
        return false
      }
      const unique = new Set(names.filter(Boolean))
      if (unique.size !== names.filter(Boolean).length) {
        message.error(t('workflowTemplates.errors.field_name_duplicate'))
        return false
      }
      const invalidSelect = formBlocks.some(
        b => (b.type === 'select' || b.type === 'checkbox' || b.type === 'radio') && !(b.options && b.options.length)
      )
      if (invalidSelect) {
        message.error(t('workflowTemplates.errors.options_required'))
        return false
      }
    }
    return true
  }

  const save = async () => {
    if (isLocked) {
      message.warning(t('workflowTemplates.errors.stop_before_edit'))
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
        message.success(t('workflowTemplates.messages.updated'))
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
        message.success(modal.mode === 'clone' ? t('workflowTemplates.messages.new_version_created') : t('workflowTemplates.messages.created'))
      }
      setModal({ open: false })
      form.resetFields()
      load()
    } catch (e: any) {
      message.error(e?.message || t('workflowTemplates.errors.save_failed'))
    }
  }

  const statusLabel = useCallback((status?: string) => {
    if (!status) return '-'
    return t(`workflowTemplates.status.${status}`, status)
  }, [t])

  const columns = useMemo(
    () => [
      { title: t('workflowTemplates.columns.name'), dataIndex: 'name', key: 'name' },
      { title: t('workflowTemplates.columns.entity_type'), dataIndex: 'entity_type', key: 'entity_type', width: 120 },
      { title: t('workflowTemplates.columns.app'), dataIndex: 'app_code', key: 'app_code', width: 120 },
      { title: t('workflowTemplates.columns.module'), dataIndex: 'module_code', key: 'module_code', width: 120 },
      { title: t('workflowTemplates.columns.form'), dataIndex: 'form_name', key: 'form_name', width: 140 },
      { title: t('workflowTemplates.columns.version'), dataIndex: 'version', key: 'version', width: 80 },
      {
        title: t('workflowTemplates.columns.starter_roles'),
        dataIndex: 'starter_roles',
        key: 'starter_roles',
        width: 220,
        render: (val: number[] = []) =>
          val?.length
            ? val.map(id => roleLabelMap[id] || formatText(t('workflowTemplates.role_fallback'), { id })).join(', ')
            : t('workflowTemplates.unlimited'),
      },
      {
        title: t('workflowTemplates.columns.status'),
        dataIndex: 'status',
        key: 'status',
        width: 100,
        render: (val: string) => <Tag color={statusColor(val)}>{statusLabel(val)}</Tag>,
      },
      { title: t('workflowTemplates.columns.updated_at'), dataIndex: 'updated_at', key: 'updated_at', width: 180, render: (v?: string) => (v ? formatDateTime(v) : '-') },
      {
        title: t('workflowTemplates.columns.actions'),
        key: 'actions',
        width: 340,
        render: (_: any, row: WorkflowTemplate) => (
          <Space>
            <Button type="link" disabled={row.status === 'published'} onClick={() => openEditor(row, 'edit')}>
              {t('app.edit')}
            </Button>
            {row.status === 'published' ? (
              <Popconfirm
                title={t('workflowTemplates.confirm.stop_before_edit')}
                okText={t('workflowTemplates.stop')}
                cancelText={t('app.cancel')}
                onConfirm={async () => {
                  try {
                    await workflowsApi.updateTemplate(row.id, { status: 'draft' })
                    message.success(t('workflowTemplates.messages.stopped'))
                    load()
                  } catch (e: any) {
                    message.error(e?.message || t('workflowTemplates.errors.stop_failed'))
                  }
                }}
              >
                <Button type="link" danger>
                  {t('workflowTemplates.stop')}
                </Button>
              </Popconfirm>
            ) : (
              <Button
                type="link"
                onClick={async () => {
                  try {
                    await workflowsApi.publishTemplate(row.id)
                    message.success(t('workflowTemplates.messages.started'))
                    load()
                  } catch (e: any) {
                    message.error(e?.message || t('workflowTemplates.errors.start_failed'))
                  }
                }}
              >
                {t('workflowTemplates.start')}
              </Button>
            )}
            <Button type="link" onClick={() => setHistoryModal({ open: true, name: row.name, entityType: row.entity_type })}>
              {t('workflowTemplates.history')}
            </Button>
            <Button
              type="link"
              onClick={async () => {
                try {
                  const res: any = await workflowsApi.copyTemplate(row.id)
                  // HTTP 封装失败时不抛异常而是返回 {success:false}，必须显式检查
                  if (!isSuccess(res)) throw new Error(getErr(res, t('workflowTemplates.errors.copy_failed')))
                  const name = res?.data?.name || ''
                  message.success(`${t('workflowTemplates.messages.copied')}${name ? `：${name}` : ''}`)
                  load()
                } catch (e: any) {
                  message.error(e?.message || t('workflowTemplates.errors.copy_failed'))
                }
              }}
            >
              {t('workflowTemplates.copy')}
            </Button>
            <Button
              type="link"
              onClick={async () => {
                setRelatedModal({ open: true, loading: true, name: row.name })
                try {
                  const data = await workflowsApi.templateRelated(row.id)
                  setRelatedModal({ open: true, loading: false, name: row.name, data })
                } catch (e: any) {
                  message.error(e?.message || t('workflowTemplates.errors.related_failed'))
                  setRelatedModal({ open: false })
                }
              }}
            >
              {t('workflowTemplates.related')}
            </Button>
            <Popconfirm
              title={t('workflowTemplates.confirm.delete_title')}
              description={t('workflowTemplates.confirm.delete_desc')}
              okText={t('app.delete')}
              okButtonProps={{ danger: true }}
              cancelText={t('app.cancel')}
              onConfirm={async () => {
                try {
                  const res: any = await workflowsApi.deleteTemplate(row.id)
                  // HTTP 封装失败时不抛异常而是返回 {success:false}，必须显式检查
                  if (!isSuccess(res)) throw new Error(getErr(res, t('workflowTemplates.errors.delete_failed')))
                  message.success(t('workflowTemplates.messages.deleted'))
                  load()
                } catch (e: any) {
                  // 有实例时后端会拒绝并说明数量，原样展示
                  message.error(e?.message || t('workflowTemplates.errors.delete_failed'))
                }
              }}
            >
              <Button type="link" danger>
                {t('app.delete')}
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [load, message, roleLabelMap, statusLabel, t]
  )

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <div>
            <Title level={4} style={{ marginBottom: 0 }}>
              {t('workflowTemplates.title')}
            </Title>
            <Text type="secondary">{t('workflowTemplates.description')}</Text>
          </div>
          <Button type="primary" onClick={() => openEditor(undefined, 'create')}>
            {t('workflowTemplates.add_template')}
          </Button>
        </Space>
      </Card>
      <Card>
        <Space style={{ marginBottom: 12 }}>
          <Input.Search
            allowClear
            placeholder={t('workflowTemplates.search_placeholder')}
            style={{ width: 280 }}
            onSearch={val => {
              setKeyword(val)
              setPage(1)
            }}
            onChange={e => {
              if (!e.target.value) {
                setKeyword('')
                setPage(1)
              }
            }}
          />
        </Space>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns as any}
          dataSource={filteredItems}
          pagination={createTablePaginationConfig({
            current: page,
            pageSize,
            total: filteredItems.length,
            onChange: (p, ps) => {
              setPage(p)
              if (ps) setPageSize(ps)
            },
          })}
        />
      </Card>
      <Modal
        open={modal.open}
        title={
          modal.mode === 'edit'
            ? t('workflowTemplates.modal.edit_title')
            : modal.mode === 'clone'
              ? modal.cloneFrom
                ? formatText(t('workflowTemplates.modal.clone_title_with_version'), { version: modal.cloneFrom.version })
                : t('workflowTemplates.modal.clone_title')
              : t('workflowTemplates.modal.create_title')
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
              <Text strong>{t('workflowTemplates.sections.flow_params')}</Text>
              <Space size="large" style={{ width: '100%', marginTop: 8 }} wrap>
                <Form.Item label={t('workflowTemplates.columns.name')} name="name" rules={[{ required: true, message: t('workflowTemplates.errors.name_required') }]}>
                  <Input style={{ width: 240 }} disabled={isLocked} />
                </Form.Item>
                <Form.Item label={t('workflowTemplates.columns.entity_type')} name="entity_type" rules={[{ required: true, message: t('workflowTemplates.errors.entity_type_required') }]}>
                  <Select
                    style={{ width: 200 }}
                    options={[
                      { value: 'exam', label: 'exam' },
                      { value: 'paper', label: 'paper' },
                    ]}
                    disabled={isLocked}
                  />
                </Form.Item>
                <Form.Item label={t('workflowTemplates.columns.status')} name="status" initialValue="draft">
                  <Select
                    style={{ width: 200 }}
                    options={[
                      { value: 'draft', label: statusLabel('draft') },
                      { value: 'published', label: statusLabel('published') },
                    ]}
                    disabled
                  />
                </Form.Item>
                <Form.Item label={t('workflowTemplates.columns.starter_roles')} name="starter_roles">
                  <Select
                    mode="multiple"
                    allowClear
                    placeholder={t('workflowTemplates.unlimited_placeholder')}
                    options={roleOptions}
                    style={{ width: 240 }}
                    disabled={isLocked}
                  />
                </Form.Item>
                <Form.Item label={t('workflowTemplates.columns.version')} name="version">
                  <Input style={{ width: 120 }} placeholder={t('workflowTemplates.auto_increment')} disabled />
                </Form.Item>
              </Space>
            </div>
            <div>
              <Text strong>{t('workflowTemplates.sections.app_params')}</Text>
              <Space size="large" style={{ width: '100%', marginTop: 8 }} wrap>
                <Form.Item label={t('workflowTemplates.form.app_code')} name="app_code">
                  <Input style={{ width: 180 }} placeholder={t('workflowTemplates.placeholders.app_code')} disabled={isLocked} />
                </Form.Item>
                <Form.Item label={t('workflowTemplates.form.module_code')} name="module_code">
                  <Input style={{ width: 180 }} placeholder={t('workflowTemplates.placeholders.module_code')} disabled={isLocked} />
                </Form.Item>
                <Form.Item label={t('workflowTemplates.form.form_key')} name="form_key">
                  <Input style={{ width: 200 }} placeholder={t('workflowTemplates.placeholders.form_key')} disabled={isLocked} />
                </Form.Item>
                <Form.Item label={t('workflowTemplates.form.form_name')} name="form_name">
                  <Input style={{ width: 200 }} placeholder={t('workflowTemplates.placeholders.form_name')} disabled={isLocked} />
                </Form.Item>
              </Space>
            </div>
          </Space>
        </Form>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <Space>
            <Button type={editorTab === 'flow' ? 'primary' : 'default'} onClick={() => setEditorTab('flow')}>
              {t('workflowTemplates.tabs.flow')}
            </Button>
            <Button type={editorTab === 'form' ? 'primary' : 'default'} onClick={() => setEditorTab('form')}>
              {t('workflowTemplates.tabs.form')}
            </Button>
          </Space>
        </div>

        {editorTab === 'flow' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, height: 560 }}>
            <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>
                <Text type="secondary">{t('workflowTemplates.flow_hint')}</Text>
              </div>
              <div style={{ height: 500, overflow: 'auto', background: 'var(--ant-color-bg-layout,#f8fafc)' }}>
                <ApprovalFlowDesigner
                  value={flowDef}
                  onChange={setFlowDef}
                  roleOptions={roleOptions}
                  userOptions={userOptions}
                  fieldOptions={fieldOptions}
                />
              </div>
            </div>
          </div>
        ) : (
          <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 12, height: 560, overflow: 'auto' }}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Text strong>{t('workflowTemplates.template_form')}</Text>
                <Segmented
                  value={formView}
                  onChange={val => setFormView(val as 'designer' | 'source' | 'preview')}
                  options={[
                    { label: t('workflowTemplates.formView.designer'), value: 'designer' },
                    { label: t('workflowTemplates.formView.source'), value: 'source' },
                    { label: t('workflowTemplates.formView.preview'), value: 'preview' },
                  ]}
                />
              </Space>
              {formView === 'designer' ? (
                <>
                  {sourceMode === 'custom' && (
                    <Alert
                      type="warning"
                      showIcon
                      message={t('workflowTemplates.source_custom_warning')}
                      action={
                        <Button
                          size="small"
                          onClick={() => {
                            if (isLocked) return
                            const next = buildFormSourceFromBlocks(formBlocks, t)
                            setFormSource(next)
                            setSourceMode('designer')
                          }}
                        >
                          {t('workflowTemplates.override_source')}
                        </Button>
                      }
                    />
                  )}
                  <div style={{ fontWeight: 600 }}>{t('workflowTemplates.palette_title')}</div>
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
                  <div style={{ fontWeight: 600, marginTop: 8 }}>{t('workflowTemplates.canvas_title')}</div>
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
                                <div style={{ fontWeight: 600 }}>{block.label || t('workflowTemplates.form.unnamed')}</div>
                                <Text type="secondary">{block.type}</Text>
                              </div>
                              <Space>
                                <Button size="small" disabled={isLocked || idx === 0} onClick={() => moveBlock(block.id, -1)}>
                                  {t('workflowTemplates.move_up')}
                                </Button>
                                <Button
                                  size="small"
                                  disabled={isLocked || idx === formBlocks.length - 1}
                                  onClick={() => moveBlock(block.id, 1)}
                                >
                                  {t('workflowTemplates.move_down')}
                                </Button>
                                <Button size="small" danger disabled={isLocked} onClick={() => removeBlock(block.id)}>
                                  {t('app.delete')}
                                </Button>
                              </Space>
                            </Space>
                          </div>
                        ))}
                      </Space>
                    ) : (
                      <Text type="secondary">{t('workflowTemplates.empty_canvas')}</Text>
                    )}
                  </div>
                  {selectedBlock && (
                    <div style={{ marginTop: 12 }}>
                      <Text strong>{t('workflowTemplates.field_properties')}</Text>
                      <Space direction="vertical" size="small" style={{ width: '100%', marginTop: 8 }}>
                        <Input
                          placeholder={t('workflowTemplates.placeholders.field_label')}
                          value={selectedBlock.label}
                          disabled={isLocked}
                          onChange={e => updateBlock(selectedBlock.id, { label: e.target.value })}
                        />
                        {['input', 'textarea', 'select', 'number', 'date', 'switch', 'checkbox', 'radio'].includes(selectedBlock.type) && (
                          <Input
                            placeholder={t('workflowTemplates.placeholders.field_name')}
                            value={selectedBlock.name}
                            disabled={isLocked}
                            onChange={e => updateBlock(selectedBlock.id, { name: e.target.value })}
                          />
                        )}
                        {['input', 'textarea', 'number', 'date'].includes(selectedBlock.type) && (
                          <Input
                            placeholder={t('workflowTemplates.placeholders.field_placeholder')}
                            value={selectedBlock.placeholder}
                            disabled={isLocked}
                            onChange={e => updateBlock(selectedBlock.id, { placeholder: e.target.value })}
                          />
                        )}
                        {['input', 'textarea', 'select', 'number', 'date', 'checkbox', 'radio'].includes(selectedBlock.type) && (
                          <Space>
                            <Text>{t('workflowTemplates.required')}</Text>
                            <Switch
                              checked={Boolean(selectedBlock.required)}
                              disabled={isLocked}
                              onChange={checked => updateBlock(selectedBlock.id, { required: checked })}
                            />
                          </Space>
                        )}
                        {['select', 'checkbox', 'radio'].includes(selectedBlock.type) && (
                          <TextArea
                            placeholder={t('workflowTemplates.placeholders.options')}
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
                    placeholder={t('workflowTemplates.placeholders.html')}
                  />
                  <TextArea
                    rows={5}
                    value={formSource.css}
                    disabled={isLocked}
                    onChange={e => {
                      setFormSource(prev => ({ ...prev, css: e.target.value }))
                      setSourceMode('custom')
                    }}
                    placeholder={t('workflowTemplates.placeholders.css')}
                  />
                  <TextArea
                    rows={5}
                    value={formSource.js}
                    disabled={isLocked}
                    onChange={e => {
                      setFormSource(prev => ({ ...prev, js: e.target.value }))
                      setSourceMode('custom')
                    }}
                    placeholder={t('workflowTemplates.placeholders.js')}
                  />
                  <Space>
                    <Button
                      size="small"
                      disabled={isLocked}
                      onClick={() => {
                        const next = buildFormSourceFromBlocks(formBlocks, t)
                        setFormSource(next)
                        setSourceMode('designer')
                      }}
                    >
                      {t('workflowTemplates.generate_from_designer')}
                    </Button>
                    <Button
                      size="small"
                      disabled={isLocked}
                      onClick={() => {
                        setFormSource(exampleSource)
                        setSourceMode('custom')
                      }}
                    >
                      {t('workflowTemplates.insert_example')}
                    </Button>
                  </Space>
                  <Text type="secondary">{t('workflowTemplates.preview_warning')}</Text>
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
        title={formatText(t('workflowTemplates.history_title'), { name: historyModal.name ? ` - ${historyModal.name}` : '' })}
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
            { title: t('workflowTemplates.columns.version'), dataIndex: 'version', key: 'version', width: 80 },
            {
              title: t('workflowTemplates.columns.status'),
              dataIndex: 'status',
              key: 'status',
              width: 120,
              render: (val: string) => statusLabel(val),
            },
            { title: t('workflowTemplates.columns.entity_type'), dataIndex: 'entity_type', key: 'entity_type', width: 120 },
            { title: t('workflowTemplates.columns.updated_at'), dataIndex: 'updated_at', key: 'updated_at', render: (v?: string) => (v ? formatDateTime(v) : '-') },
            {
              title: t('workflowTemplates.columns.actions'),
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
                  {t('workflowTemplates.edit_as_new_version')}
                </Button>
              ),
            },
          ]}
        />
      </Modal>

      <Modal
        title={`${t('workflowTemplates.related_title')}${relatedModal.name ? `：${relatedModal.name}` : ''}`}
        open={relatedModal.open}
        onCancel={() => setRelatedModal({ open: false })}
        footer={null}
        width={720}
      >
        {relatedModal.loading ? (
          <Text type="secondary">{t('app.loading')}</Text>
        ) : relatedModal.data ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Space wrap>
              <Tag color={relatedModal.data.instanceCount > 0 ? 'blue' : 'default'}>
                {formatText(t('workflowTemplates.related_count'), { count: relatedModal.data.instanceCount })}
              </Tag>
              {(relatedModal.data.statusCounts || []).map(s => (
                <Tag key={s.status} color={s.status === 'running' ? 'processing' : s.status === 'approved' ? 'success' : s.status === 'rejected' ? 'error' : 'default'}>
                  {s.status}: {s.count}
                </Tag>
              ))}
            </Space>
            {relatedModal.data.instanceCount === 0 ? (
              <Text type="secondary">{t('workflowTemplates.related_empty')}</Text>
            ) : (
              <Table
                size="small"
                rowKey="id"
                pagination={false}
                dataSource={relatedModal.data.instances || []}
                columns={[
                  { title: 'ID', dataIndex: 'id', width: 70 },
                  { title: t('workflowTemplates.columns.entity_type'), dataIndex: 'entity_type', width: 110 },
                  { title: t('workflowTemplates.related_entity_id'), dataIndex: 'entity_id', width: 90 },
                  { title: t('workflowTemplates.columns.status'), dataIndex: 'status', width: 100 },
                  {
                    title: t('workflowTemplates.columns.updated_at'),
                    dataIndex: 'created_at',
                    render: (v?: string) => (v ? formatDateTime(v) : '-'),
                  },
                ]}
              />
            )}
          </Space>
        ) : null}
      </Modal>
    </Space>
  )
}
