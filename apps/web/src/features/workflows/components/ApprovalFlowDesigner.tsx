import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Button, Drawer, Empty, Input, Popover, Radio, Segmented, Select, Space, Typography } from 'antd'
import { Plus, Trash2, UserCheck, Send, Play, Flag, GitBranch } from 'lucide-react'
import { useLanguage } from '@/shared/contexts/LanguageContext'
import { translate } from '@/shared/utils/i18n'

const { Text } = Typography
type TranslateFn = (key: string, fallback?: string) => string

/** 审批流节点类型（钉钉式竖向链，condition=条件分支组） */
export type FlowNodeType = 'start' | 'approval' | 'cc' | 'condition' | 'end'
export type ApproverType = 'role' | 'user' | 'dept_leader' | 'initiator_self'
export type ApprovalMode = 'single' | 'and' | 'or' | 'sequential'
export type ConditionOp = '==' | '!=' | '>' | '>=' | '<' | '<='
export type FieldPermission = 'edit' | 'read' | 'hidden'

/** 条件分支：default 为兜底分支（无条件），其余按 field op value 求值 */
export type ConditionBranch = {
  id: string
  name: string
  isDefault?: boolean
  field?: string
  op?: ConditionOp
  value?: string
  children: FlowNode[]
}

export type FlowNode = {
  id: string
  type: FlowNodeType
  name: string
  // approval
  approverType?: ApproverType
  approverRoles?: number[]
  approverUsers?: number[]
  mode?: ApprovalMode
  formPermissions?: Record<string, FieldPermission>
  // cc
  ccRoles?: number[]
  ccUsers?: number[]
  // condition
  branches?: ConditionBranch[]
}

/** 设计器数据源：一棵以 start 开头、end 结尾的树（condition 节点内嵌分支子链） */
export type FlowDefinition = { nodes: FlowNode[] }

type NumOption = { label: string; value: number }
type StrOption = { label: string; value: string }

type Props = {
  value?: FlowDefinition
  onChange: (def: FlowDefinition) => void
  roleOptions?: NumOption[]
  userOptions?: NumOption[]
  fieldOptions?: StrOption[]
}

type Editing = { kind: 'node' | 'branch'; id: string } | null

const uid = (p: string) => `${p}_` + Math.random().toString(36).slice(2, 9)

export function emptyDefinition(t: TranslateFn = translate): FlowDefinition {
  return {
    nodes: [
      { id: 'start', type: 'start', name: t('workflowDesigner.node.initiator') },
      { id: 'end', type: 'end', name: t('workflowDesigner.node.end') },
    ],
  }
}

const opLabel = (op: ConditionOp, t: TranslateFn) => t(`workflowDesigner.op.${op}`, op)

const approverTypeLabel = (type: ApproverType, t: TranslateFn) => t(`workflowDesigner.approverType.${type}`, type)

// ---------- 不可变树操作（节点 id / 分支 id 全局唯一，递归命中） ----------
function mapNodes(tree: FlowNode[], id: string, patch: Partial<FlowNode>): FlowNode[] {
  return tree.map(n => {
    if (n.id === id) return { ...n, ...patch }
    if (n.type === 'condition' && n.branches) {
      return { ...n, branches: n.branches.map(b => ({ ...b, children: mapNodes(b.children, id, patch) })) }
    }
    return n
  })
}

function dropNode(tree: FlowNode[], id: string): FlowNode[] {
  return tree
    .filter(n => n.id !== id)
    .map(n =>
      n.type === 'condition' && n.branches
        ? { ...n, branches: n.branches.map(b => ({ ...b, children: dropNode(b.children, id) })) }
        : n
    )
}

function insertNode(tree: FlowNode[], branchId: string | null, index: number, node: FlowNode): FlowNode[] {
  if (branchId === null) {
    return [...tree.slice(0, index), node, ...tree.slice(index)]
  }
  return tree.map(n => {
    if (n.type !== 'condition' || !n.branches) return n
    return {
      ...n,
      branches: n.branches.map(b =>
        b.id === branchId
          ? { ...b, children: [...b.children.slice(0, index), node, ...b.children.slice(index)] }
          : { ...b, children: insertNode(b.children, branchId, index, node) }
      ),
    }
  })
}

function patchBranch(tree: FlowNode[], branchId: string, patch: Partial<ConditionBranch>): FlowNode[] {
  return tree.map(n => {
    if (n.type !== 'condition' || !n.branches) return n
    return {
      ...n,
      branches: n.branches.map(b =>
        b.id === branchId ? { ...b, ...patch } : { ...b, children: patchBranch(b.children, branchId, patch) }
      ),
    }
  })
}

function addBranch(tree: FlowNode[], condId: string, t: TranslateFn): FlowNode[] {
  return tree.map(n => {
    if (n.id === condId && n.type === 'condition' && n.branches) {
      const idx = n.branches.filter(b => !b.isDefault).length + 1
      const defaultIdx = n.branches.findIndex(b => b.isDefault)
      const fresh: ConditionBranch = { id: uid('br'), name: `${t('workflowDesigner.branch.condition')}${idx}`, op: '==', value: '', children: [] }
      const branches = [...n.branches]
      if (defaultIdx >= 0) branches.splice(defaultIdx, 0, fresh)
      else branches.push(fresh)
      return { ...n, branches }
    }
    if (n.type === 'condition' && n.branches) {
      return { ...n, branches: n.branches.map(b => ({ ...b, children: addBranch(b.children, condId, t) })) }
    }
    return n
  })
}

function dropBranch(tree: FlowNode[], branchId: string): FlowNode[] {
  return tree.map(n => {
    if (n.type !== 'condition' || !n.branches) return n
    if (n.branches.some(b => b.id === branchId)) {
      return { ...n, branches: n.branches.filter(b => b.id !== branchId) }
    }
    return { ...n, branches: n.branches.map(b => ({ ...b, children: dropBranch(b.children, branchId) })) }
  })
}

function findNode(tree: FlowNode[], id: string): FlowNode | null {
  for (const n of tree) {
    if (n.id === id) return n
    if (n.type === 'condition' && n.branches) {
      for (const b of n.branches) {
        const hit = findNode(b.children, id)
        if (hit) return hit
      }
    }
  }
  return null
}

function findBranch(tree: FlowNode[], id: string): ConditionBranch | null {
  for (const n of tree) {
    if (n.type === 'condition' && n.branches) {
      for (const b of n.branches) {
        if (b.id === id) return b
        const hit = findBranch(b.children, id)
        if (hit) return hit
      }
    }
  }
  return null
}

function newApproval(t: TranslateFn): FlowNode {
  return { id: uid('n'), type: 'approval', name: t('workflowDesigner.node.approver'), approverType: 'role', approverRoles: [], mode: 'or' }
}
function newCc(t: TranslateFn): FlowNode {
  return { id: uid('n'), type: 'cc', name: t('workflowDesigner.node.cc'), ccRoles: [] }
}
function newCondition(t: TranslateFn): FlowNode {
  return {
    id: uid('cond'),
    type: 'condition',
    name: t('workflowDesigner.node.condition'),
    branches: [
      { id: uid('br'), name: `${t('workflowDesigner.branch.condition')}1`, op: '==', value: '', children: [] },
      { id: uid('br'), name: t('workflowDesigner.branch.other'), isDefault: true, children: [] },
    ],
  }
}

type InsertKind = 'approval' | 'cc' | 'condition'
function makeNode(kind: InsertKind, t: TranslateFn): FlowNode {
  if (kind === 'approval') return newApproval(t)
  if (kind === 'cc') return newCc(t)
  return newCondition(t)
}

export default function ApprovalFlowDesigner({
  value,
  onChange,
  roleOptions = [],
  userOptions = [],
  fieldOptions = [],
}: Props) {
  const { t } = useLanguage()
  const def = value && value.nodes?.length ? value : emptyDefinition(t)
  const tree = def.nodes
  const [editing, setEditing] = useState<Editing>(null)

  const editingNode = useMemo(
    () => (editing?.kind === 'node' ? findNode(tree, editing.id) : null),
    [tree, editing]
  )
  const editingBranch = useMemo(
    () => (editing?.kind === 'branch' ? findBranch(tree, editing.id) : null),
    [tree, editing]
  )

  const commit = (next: FlowNode[]) => onChange({ nodes: next })

  const ctx: ChainCtx = {
    roleOptions,
    editingId: editing?.id ?? null,
    onInsert: (branchId, index, kind) => {
      const node = makeNode(kind, t)
      commit(insertNode(tree, branchId, index, node))
      setEditing(node.type === 'condition' ? null : { kind: 'node', id: node.id })
    },
    onRemoveNode: id => commit(dropNode(tree, id)),
    onEditNode: id => setEditing({ kind: 'node', id }),
    onEditBranch: id => setEditing({ kind: 'branch', id }),
    onAddBranch: condId => commit(addBranch(tree, condId, t)),
    onRemoveBranch: branchId => commit(dropBranch(tree, branchId)),
  }

  return (
    <div className="afd-root">
      <DesignerStyles />
      <Chain nodes={tree} branchId={null} isTop ctx={ctx} />

      <NodeConfigDrawer
        node={editingNode}
        branch={editingBranch}
        roleOptions={roleOptions}
        userOptions={userOptions}
        fieldOptions={fieldOptions}
        onClose={() => setEditing(null)}
        onChangeNode={patch => editingNode && commit(mapNodes(tree, editingNode.id, patch))}
        onChangeBranch={patch => editingBranch && commit(patchBranch(tree, editingBranch.id, patch))}
      />
    </div>
  )
}

// ---------- 渲染：链 ----------
type ChainCtx = {
  roleOptions: NumOption[]
  editingId: string | null
  onInsert: (branchId: string | null, index: number, kind: InsertKind) => void
  onRemoveNode: (id: string) => void
  onEditNode: (id: string) => void
  onEditBranch: (id: string) => void
  onAddBranch: (condId: string) => void
  onRemoveBranch: (branchId: string) => void
}

function Chain({
  nodes,
  branchId,
  isTop,
  ctx,
}: {
  nodes: FlowNode[]
  branchId: string | null
  isTop: boolean
  ctx: ChainCtx
}) {
  // 顶层链固定 start…end，仅在节点之间插入；分支子链可在首/中/尾任意位置插入
  const insertAt = (index: number) => <InsertButton key={`ins-${branchId}-${index}`} onPick={k => ctx.onInsert(branchId, index, k)} />

  if (!isTop && nodes.length === 0) {
    return (
      <div className="afd-chain">
        <div className="afd-line afd-line-sm" />
        {insertAt(0)}
        <div className="afd-line afd-line-sm" />
      </div>
    )
  }

  const items: ReactNode[] = []
  if (!isTop) {
    items.push(<div key="lead" className="afd-line afd-line-sm" />, insertAt(0))
  }
  nodes.forEach((node, idx) => {
    items.push(
      <div key={`seg-${node.id}`} className="afd-seg">
        <NodeOrCondition node={node} ctx={ctx} />
      </div>
    )
    const isLast = idx === nodes.length - 1
    if (isTop) {
      if (!isLast) {
        items.push(<div key={`c1-${idx}`} className="afd-line" />, insertAt(idx + 1), <div key={`c2-${idx}`} className="afd-line" />)
      }
    } else {
      items.push(<div key={`bc-${idx}`} className="afd-line afd-line-sm" />, insertAt(idx + 1))
    }
  })

  return <div className="afd-chain">{items}</div>
}

function NodeOrCondition({ node, ctx }: { node: FlowNode; ctx: ChainCtx }) {
  if (node.type === 'condition') return <ConditionGroup node={node} ctx={ctx} />
  const isEndOrStart = node.type === 'start' || node.type === 'end'
  return (
    <NodeCard
      node={node}
      active={ctx.editingId === node.id}
      roleOptions={ctx.roleOptions}
      onClick={() => !isEndOrStart && ctx.onEditNode(node.id)}
      onDelete={node.type === 'approval' || node.type === 'cc' ? () => ctx.onRemoveNode(node.id) : undefined}
    />
  )
}

function ConditionGroup({ node, ctx }: { node: FlowNode; ctx: ChainCtx }) {
  const { t } = useLanguage()
  const branches = node.branches ?? []
  return (
    <div className="afd-cond">
      <div className="afd-cond-head">
        <GitBranch size={14} />
        <span>{node.name || t('workflowDesigner.node.condition')}</span>
        <Button size="small" type="link" onClick={() => ctx.onAddBranch(node.id)} icon={<Plus size={13} />}>
          {t('workflowDesigner.add_branch')}
        </Button>
        <Trash2 className="afd-del" size={14} onClick={() => ctx.onRemoveNode(node.id)} />
      </div>
      <div className="afd-branches">
        {branches.map(branch => (
          <div key={branch.id} className="afd-branch">
            <BranchHeader
              branch={branch}
              active={ctx.editingId === branch.id}
              onClick={() => ctx.onEditBranch(branch.id)}
              onDelete={branches.length > 1 ? () => ctx.onRemoveBranch(branch.id) : undefined}
            />
            <Chain nodes={branch.children} branchId={branch.id} isTop={false} ctx={ctx} />
          </div>
        ))}
      </div>
    </div>
  )
}

function branchSummary(branch: ConditionBranch, t: TranslateFn): string {
  if (branch.isDefault) return t('workflowDesigner.branch.default_summary')
  if (!branch.field) return t('workflowDesigner.branch.not_configured')
  return `${branch.field} ${opLabel(branch.op || '==', t)} ${branch.value ?? ''}`.trim()
}

function BranchHeader({
  branch,
  active,
  onClick,
  onDelete,
}: {
  branch: ConditionBranch
  active: boolean
  onClick: () => void
  onDelete?: () => void
}) {
  const { t } = useLanguage()
  return (
    <div className={`afd-branch-head${active ? ' afd-active' : ''}`} onClick={onClick}>
      <div className="afd-branch-name afd-truncate">{branch.name || t('workflowDesigner.branch.condition')}</div>
      <div className="afd-branch-sub afd-truncate">{branchSummary(branch, t)}</div>
      {onDelete && (
        <Trash2
          className="afd-del afd-branch-del"
          size={13}
          onClick={e => {
            e.stopPropagation()
            onDelete()
          }}
        />
      )}
    </div>
  )
}

function nodeVisual(type: FlowNodeType): { color: string; bar: string; icon: ReactNode } {
  switch (type) {
    case 'start':
      return { color: 'linear-gradient(135deg,#10b981,#059669)', bar: '#10b981', icon: <Play size={18} /> }
    case 'approval':
      return { color: 'linear-gradient(135deg,#6366f1,#8b5cf6)', bar: '#6366f1', icon: <UserCheck size={18} /> }
    case 'cc':
      return { color: 'linear-gradient(135deg,#0ea5e9,#0284c7)', bar: '#0ea5e9', icon: <Send size={18} /> }
    case 'condition':
      return { color: 'linear-gradient(135deg,#f59e0b,#d97706)', bar: '#f59e0b', icon: <GitBranch size={18} /> }
    case 'end':
      return { color: 'linear-gradient(135deg,#94a3b8,#64748b)', bar: '#94a3b8', icon: <Flag size={18} /> }
  }
}

function approverSummary(node: FlowNode, roleOptions: NumOption[], t: TranslateFn): string {
  if (node.type === 'approval') {
    const type = node.approverType || 'role'
    if (type === 'role') {
      const names = (node.approverRoles || []).map(id => roleOptions.find(r => r.value === id)?.label || id).join('、')
      const mode = node.mode === 'and' ? t('workflowDesigner.mode.and_short') : node.mode === 'sequential' ? t('workflowDesigner.mode.sequential_short') : t('workflowDesigner.mode.or_short')
      return names ? `${approverTypeLabel(type, t)}: ${names} (${mode})` : t('workflowDesigner.summary.no_approver')
    }
    return approverTypeLabel(type, t)
  }
  if (node.type === 'cc') {
    const names = (node.ccRoles || []).map(id => roleOptions.find(r => r.value === id)?.label || id).join('、')
    return names ? `${t('workflowDesigner.summary.cc')}: ${names}` : t('workflowDesigner.summary.no_cc')
  }
  return ''
}

function NodeCard({
  node,
  active,
  roleOptions,
  onClick,
  onDelete,
}: {
  node: FlowNode
  active: boolean
  roleOptions: NumOption[]
  onClick: () => void
  onDelete?: () => void
}) {
  const { t } = useLanguage()
  const v = nodeVisual(node.type)
  const sub = approverSummary(node, roleOptions, t)
  return (
    <div className={`afd-card${active ? ' afd-active' : ''}`} onClick={onClick}>
      <div className="afd-bar" style={{ background: v.bar }} />
      <div className="afd-body">
        <div className="afd-ico" style={{ background: v.color }}>
          {v.icon}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="afd-name">{node.name}</div>
          {sub && <div className="afd-sub afd-truncate">{sub}</div>}
        </div>
        {onDelete && (
          <Trash2
            className="afd-del"
            size={16}
            onClick={e => {
              e.stopPropagation()
              onDelete()
            }}
          />
        )}
      </div>
    </div>
  )
}

function InsertButton({ onPick }: { onPick: (k: InsertKind) => void }) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const pick = (k: InsertKind) => {
    onPick(k)
    setOpen(false)
  }
  const content = (
    <Space direction="vertical" style={{ width: 150 }}>
      <Button block icon={<UserCheck size={15} />} onClick={() => pick('approval')}>
        {t('workflowDesigner.node.approver')}
      </Button>
      <Button block icon={<Send size={15} />} onClick={() => pick('cc')}>
        {t('workflowDesigner.node.cc')}
      </Button>
      <Button block icon={<GitBranch size={15} />} onClick={() => pick('condition')}>
        {t('workflowDesigner.node.condition')}
      </Button>
    </Space>
  )
  return (
    <Popover content={content} trigger="click" open={open} onOpenChange={setOpen} placement="right">
      <div className="afd-add">
        <Plus size={16} />
      </div>
    </Popover>
  )
}

function NodeConfigDrawer({
  node,
  branch,
  roleOptions,
  userOptions,
  fieldOptions,
  onClose,
  onChangeNode,
  onChangeBranch,
}: {
  node: FlowNode | null
  branch: ConditionBranch | null
  roleOptions: NumOption[]
  userOptions: NumOption[]
  fieldOptions: StrOption[]
  onClose: () => void
  onChangeNode: (patch: Partial<FlowNode>) => void
  onChangeBranch: (patch: Partial<ConditionBranch>) => void
}) {
  const { t } = useLanguage()
  const open = !!node || !!branch
  const title = node
    ? `${t('workflowDesigner.drawer.config_node')}: ${node.name}`
    : branch
      ? `${t('workflowDesigner.drawer.config_branch')}: ${branch.name}`
      : t('workflowDesigner.drawer.title')
  return (
    <Drawer title={title} open={open} onClose={onClose} width={400} destroyOnHidden>
      {node && node.type === 'approval' && (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Field label={t('workflowDesigner.fields.node_name')}>
            <input className="afd-input" value={node.name} onChange={e => onChangeNode({ name: e.target.value })} style={inputStyle} />
          </Field>
          <Field label={t('workflowDesigner.fields.approver_source')}>
            <Radio.Group
              value={node.approverType || 'role'}
              onChange={e => onChangeNode({ approverType: e.target.value })}
              optionType="button"
              buttonStyle="solid"
              options={[
                { label: t('workflowDesigner.approverSource.role'), value: 'role' },
                { label: t('workflowDesigner.approverSource.user'), value: 'user' },
                { label: t('workflowDesigner.approverSource.dept_leader'), value: 'dept_leader' },
                { label: t('workflowDesigner.approverSource.initiator_self'), value: 'initiator_self' },
              ]}
            />
          </Field>
          {(node.approverType || 'role') === 'role' && (
            <Field label={t('workflowDesigner.fields.select_role')}>
              <Select
                mode="multiple"
                style={{ width: '100%' }}
                placeholder={t('workflowDesigner.placeholders.approver_role')}
                options={roleOptions}
                value={node.approverRoles || []}
                onChange={v => onChangeNode({ approverRoles: v })}
              />
            </Field>
          )}
          {(node.approverType || 'role') === 'user' && (
            <Field label={t('workflowDesigner.fields.select_user')}>
              <Select
                mode="multiple"
                style={{ width: '100%' }}
                placeholder={t('workflowDesigner.placeholders.approver_user')}
                options={userOptions}
                value={node.approverUsers || []}
                onChange={v => onChangeNode({ approverUsers: v })}
              />
            </Field>
          )}
          <Field label={t('workflowDesigner.fields.approval_mode')}>
            <Radio.Group
              value={node.mode || 'or'}
              onChange={e => onChangeNode({ mode: e.target.value })}
              options={[
                { label: t('workflowDesigner.mode.or'), value: 'or' },
                { label: t('workflowDesigner.mode.and'), value: 'and' },
                { label: t('workflowDesigner.mode.sequential'), value: 'sequential' },
              ]}
            />
          </Field>
          <Field label={t('workflowDesigner.fields.form_permissions')}>
            {fieldOptions.length ? (
              <FieldPermissionEditor
                fields={fieldOptions}
                value={node.formPermissions || {}}
                onChange={fp => onChangeNode({ formPermissions: fp })}
              />
            ) : (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('workflowDesigner.form_permissions_empty')}
              </Text>
            )}
          </Field>
        </Space>
      )}

      {node && node.type === 'cc' && (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Field label={t('workflowDesigner.fields.node_name')}>
            <input className="afd-input" value={node.name} onChange={e => onChangeNode({ name: e.target.value })} style={inputStyle} />
          </Field>
          <Field label={t('workflowDesigner.fields.cc_role')}>
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              placeholder={t('workflowDesigner.placeholders.cc_role')}
              options={roleOptions}
              value={node.ccRoles || []}
              onChange={v => onChangeNode({ ccRoles: v })}
            />
          </Field>
          <Field label={t('workflowDesigner.fields.cc_user')}>
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              placeholder={t('workflowDesigner.placeholders.cc_user')}
              options={userOptions}
              value={node.ccUsers || []}
              onChange={v => onChangeNode({ ccUsers: v })}
            />
          </Field>
        </Space>
      )}

      {branch && (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Field label={t('workflowDesigner.fields.branch_name')}>
            <input className="afd-input" value={branch.name} onChange={e => onChangeBranch({ name: e.target.value })} style={inputStyle} />
          </Field>
          {branch.isDefault ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('workflowDesigner.branch.default_description')} />
          ) : (
            <>
              <Field label={t('workflowDesigner.fields.form_field')}>
                <Select
                  showSearch
                  allowClear
                  style={{ width: '100%' }}
                  placeholder={fieldOptions.length ? t('workflowDesigner.placeholders.condition_field') : t('workflowDesigner.placeholders.add_field_first')}
                  options={fieldOptions}
                  value={branch.field}
                  onChange={v => onChangeBranch({ field: v })}
                  filterOption={(input, opt) => String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                />
              </Field>
              <Field label={t('workflowDesigner.fields.compare_op')}>
                <Select
                  style={{ width: '100%' }}
                  options={(['==', '!=', '>', '>=', '<', '<='] as ConditionOp[]).map(op => ({ label: opLabel(op, t), value: op }))}
                  value={branch.op || '=='}
                  onChange={v => onChangeBranch({ op: v })}
                />
              </Field>
              <Field label={t('workflowDesigner.fields.compare_value')}>
                <Input
                  placeholder={t('workflowDesigner.placeholders.compare_value')}
                  value={branch.value}
                  onChange={e => onChangeBranch({ value: e.target.value })}
                />
              </Field>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('workflowDesigner.branch.match_hint')}
              </Text>
            </>
          )}
        </Space>
      )}
    </Drawer>
  )
}

function FieldPermissionEditor({
  fields,
  value,
  onChange,
}: {
  fields: StrOption[]
  value: Record<string, FieldPermission>
  onChange: (next: Record<string, FieldPermission>) => void
}) {
  const { t } = useLanguage()
  const setPerm = (name: string, perm: FieldPermission) => onChange({ ...value, [name]: perm })
  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      {fields.map(f => (
        <div key={f.value} className="afd-perm-row">
          <span className="afd-perm-label afd-truncate" title={f.label}>
            {f.label}
          </span>
          <Segmented
            size="small"
            value={value[f.value] || 'edit'}
            onChange={v => setPerm(f.value, v as FieldPermission)}
            options={[
              { label: t('workflowDesigner.permission.edit'), value: 'edit' },
              { label: t('workflowDesigner.permission.read'), value: 'read' },
              { label: t('workflowDesigner.permission.hidden'), value: 'hidden' },
            ]}
          />
        </div>
      ))}
    </Space>
  )
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '6px 11px',
  borderRadius: 8,
  border: '1px solid var(--ant-color-border,#d9d9d9)',
  outline: 'none',
  fontSize: 14,
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Text style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--ant-color-text-secondary,#6b7280)' }}>
        {label}
      </Text>
      {children}
    </div>
  )
}

function DesignerStyles() {
  return (
    <style>{`
      .afd-root { display:flex; flex-direction:column; align-items:center; padding: 8px 0 24px; }
      .afd-chain { display:flex; flex-direction:column; align-items:center; }
      .afd-seg { display:flex; flex-direction:column; align-items:center; }
      .afd-card { width: 280px; border-radius: 12px; background: var(--ant-color-bg-container,#fff); border:1px solid var(--ant-color-border,#e5e7eb);
        box-shadow: 0 2px 8px rgba(0,0,0,.06); cursor:pointer; transition: box-shadow .2s, transform .2s; overflow:hidden; }
      .afd-card:hover { box-shadow: 0 6px 18px rgba(0,0,0,.12); transform: translateY(-1px); }
      .afd-card.afd-active { border-color:#6366f1; box-shadow:0 0 0 2px rgba(99,102,241,.25); }
      .afd-bar { height: 6px; }
      .afd-body { padding: 12px 14px; display:flex; align-items:center; gap:10px; }
      .afd-ico { width:34px; height:34px; border-radius:9px; display:flex; align-items:center; justify-content:center; color:#fff; flex:0 0 auto; }
      .afd-name { font-weight:600; font-size:14px; line-height:1.2; }
      .afd-sub { font-size:12px; color: var(--ant-color-text-secondary,#6b7280); margin-top:2px; }
      .afd-line { width:2px; height:26px; background:#d1d5db; }
      .afd-line-sm { height:16px; }
      .afd-add { width:26px; height:26px; border-radius:50%; border:1px dashed #9ca3af; background:#fff; color:#6366f1;
        display:flex; align-items:center; justify-content:center; cursor:pointer; }
      .afd-add:hover { border-color:#6366f1; background:#eef2ff; }
      .afd-del { color:#9ca3af; flex:0 0 auto; cursor:pointer; }
      .afd-del:hover { color:#ef4444; }
      .afd-truncate { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      /* 条件分支组 */
      .afd-cond { border:1px dashed #f59e0b; border-radius:12px; background:rgba(245,158,11,.04); padding:10px 12px 14px; }
      .afd-cond-head { display:flex; align-items:center; gap:6px; font-size:13px; font-weight:600; color:#b45309; margin-bottom:6px; }
      .afd-cond-head .afd-del { margin-left:auto; }
      .afd-branches { display:flex; align-items:flex-start; gap:16px; }
      .afd-branch { display:flex; flex-direction:column; align-items:center; min-width:240px; }
      .afd-branch-head { width:220px; border-radius:10px; background:#fff; border:1px solid #fcd9a3; padding:8px 12px; cursor:pointer;
        position:relative; transition: box-shadow .2s; }
      .afd-branch-head:hover { box-shadow:0 4px 12px rgba(0,0,0,.08); }
      .afd-branch-head.afd-active { border-color:#f59e0b; box-shadow:0 0 0 2px rgba(245,158,11,.25); }
      .afd-branch-name { font-weight:600; font-size:13px; }
      .afd-branch-sub { font-size:12px; color:#9a7a3a; margin-top:2px; }
      .afd-branch-del { position:absolute; top:8px; right:8px; }
      /* 字段权限行 */
      .afd-perm-row { display:flex; align-items:center; gap:10px; justify-content:space-between; }
      .afd-perm-label { font-size:13px; color: var(--ant-color-text,#374151); max-width:150px; }
    `}</style>
  )
}
