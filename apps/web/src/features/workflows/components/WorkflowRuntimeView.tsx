import { useMemo, type ReactNode } from 'react'
import { Avatar, Empty, Tag, Tooltip, Typography } from 'antd'
import { Play, UserCheck, Send, Flag, GitBranch, Check, X, Clock } from 'lucide-react'
import type { WorkflowInstanceDetail, WorkflowTask } from '@/shared/api/endpoints/workflows'
import type {
  ConditionBranch,
  FlowDefinition,
  FlowNode,
} from '@/features/workflows/components/ApprovalFlowDesigner'
import { formatDateTime } from '@/shared/utils/datetime'
import { translate } from '@/shared/utils/i18n'

const { Text } = Typography

type RtStatus = 'done' | 'active' | 'reject' | 'wait'

const STATUS: Record<RtStatus, { color: string; bg: string; bar: string; labelKey: string }> = {
  done: { color: '#15803d', bg: '#f0fdf4', bar: '#22c55e', labelKey: 'workflowTemplates.status.approved' },
  active: { color: '#1d4ed8', bg: '#eff6ff', bar: '#3b82f6', labelKey: 'aiAssistant.attachments.processing' },
  reject: { color: '#b91c1c', bg: '#fef2f2', bar: '#ef4444', labelKey: 'workflowTemplates.status.rejected' },
  wait: { color: '#64748b', bg: '#ffffff', bar: '#cbd5e1', labelKey: 'auto.2a8c3e97fb' },
}

const RAIL_LINE = { done: '#86efac', active: '#bfdbfe', reject: '#fca5a5', wait: '#e2e8f0' }

const TASK_STATUS_LABEL_KEY: Record<string, string> = {
  approved: 'workflowTemplates.status.approved',
  rejected: 'workflowTemplates.status.rejected',
  pending: 'workflowTemplates.status.pending',
  canceled: 'workflowTemplates.status.canceled',
}

function formatMessage(key: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (text, [name, value]) => text.replace(new RegExp(`\\\\{${name}\\\\}`, 'g'), String(value)),
    translate(key)
  )
}

// 兜底：旧模板无 design 树时，从扁平 nodes 线性重建（跳过 gateway）
function fallbackTree(definition: any): FlowDefinition {
  const flat = Array.isArray(definition?.nodes) ? definition.nodes : []
  const nodes: FlowNode[] = flat
    .filter((n: any) => n.type !== 'gateway')
    .map((n: any) => ({ id: n.id, type: n.type, name: n.name || n.id }) as FlowNode)
  if (!nodes.length) nodes.push({ id: 'start', type: 'start', name: translate('workflowTemplates.node.start') }, { id: 'end', type: 'end', name: translate('workflowTemplates.node.end') })
  return { nodes }
}

function initials(name?: string, id?: number): string {
  const s = (name || '').trim()
  if (s) return s.slice(0, 1).toUpperCase()
  return id ? String(id).slice(-2) : '?'
}

function branchNodeNames(children: FlowNode[]): string[] {
  const out: string[] = []
  for (const n of children) {
    if (n.type === 'condition') out.push(n.name || translate('workflowTemplates.node.condition'))
    else if (n.type !== 'start' && n.type !== 'end') out.push(n.name)
  }
  return out
}

function parseTime(s?: string | null): number | null {
  if (!s) return null
  const t = new Date(String(s).replace(' ', 'T')).getTime()
  return Number.isFinite(t) ? t : null
}

function humanDuration(ms: number): string {
  const m = Math.max(0, Math.floor(ms / 60000))
  if (m < 1) return translate('workflowRuntime.duration.just_now')
  if (m < 60) return formatMessage('workflowRuntime.duration.minutes', { count: m })
  const h = Math.floor(m / 60)
  if (h < 24) return formatMessage('workflowRuntime.duration.hours', { count: h })
  const d = Math.floor(h / 24)
  const rh = h % 24
  return rh
    ? formatMessage('workflowRuntime.duration.days_hours', { days: d, hours: rh })
    : formatMessage('workflowRuntime.duration.days', { count: d })
}

export function taskDurationText(task: WorkflowTask, now: number): string {
  const created = parseTime(task.created_at)
  if (task.status === 'pending') {
    return created ? formatMessage('workflowRuntime.waited_for', { duration: humanDuration(now - created) }) : ''
  }
  const decided = parseTime(task.decided_at)
  return decided && created ? formatMessage('workflowRuntime.spent', { duration: humanDuration(decided - created) }) : ''
}

const SUMMARY_TONE: Record<string, { color: string; bg: string; icon: ReactNode; labelKey: string }> = {
  running: { color: '#1d4ed8', bg: '#eff6ff', icon: <Clock size={15} />, labelKey: 'aiAssistant.attachments.processing' },
  approved: { color: '#15803d', bg: '#f0fdf4', icon: <Check size={15} />, labelKey: 'workflowTemplates.status.approved' },
  rejected: { color: '#b91c1c', bg: '#fef2f2', icon: <X size={15} />, labelKey: 'workflowTemplates.status.rejected' },
  canceled: { color: '#64748b', bg: '#f8fafc', icon: <X size={15} />, labelKey: 'workflow.msg_withdrawn' },
}

export function RuntimeSummary({ detail }: { detail: WorkflowInstanceDetail }) {
  const now = Date.now()
  const status = String(detail.instance?.status || 'running')
  const tone = SUMMARY_TONE[status] || SUMMARY_TONE.running
  const tasks = detail.tasks || []
  let detailText = ''
  if (status === 'running') {
    const pending = tasks.filter(t => t.status === 'pending')
    if (pending.length) {
      const nodeName = pending[0].node_name
      const who = pending
        .map(t => t.assignee_name || formatMessage('workflowRuntime.user_fallback', { id: t.assignee_id }))
        .slice(0, 3)
        .join(translate('workflowRuntime.list_separator'))
      const waited = Math.max(...pending.map(t => now - (parseTime(t.created_at) ?? now)))
      detailText = formatMessage('workflowRuntime.current_detail', {
        node: nodeName,
        assignees: who,
        duration: humanDuration(waited),
      })
    } else {
      detailText = translate('workflowRuntime.in_progress')
    }
  } else if (status === 'approved' || status === 'rejected') {
    const times = tasks.map(t => parseTime(t.decided_at)).filter((v): v is number => v != null)
    const starts = tasks.map(t => parseTime(t.created_at)).filter((v): v is number => v != null)
    if (times.length && starts.length) {
      detailText = formatMessage('workflowRuntime.total_spent', {
        duration: humanDuration(Math.max(...times) - Math.min(...starts)),
      })
    }
  }
  return (
    <div className="wrt-summary" style={{ color: tone.color, background: tone.bg }}>
      <span className="wrt-summary-ico">{tone.icon}</span>
      <span className="wrt-summary-label">{translate(tone.labelKey)}</span>
      {detailText && <span className="wrt-summary-detail">{detailText}</span>}
    </div>
  )
}

export default function WorkflowRuntimeView({
  detail,
  showSummary = true,
}: {
  detail: WorkflowInstanceDetail
  showSummary?: boolean
}) {
  const ctx = useMemo(() => {
    const def = detail.template?.definition
    const tree: FlowDefinition = def?.design?.nodes?.length ? (def.design as FlowDefinition) : fallbackTree(def)
    const tasksByNode = new Map<string, WorkflowTask[]>()
    for (const t of detail.tasks || []) {
      const key = String(t.node_id)
      if (!tasksByNode.has(key)) tasksByNode.set(key, [])
      tasksByNode.get(key)!.push(t)
    }
    const currentSet = new Set<string>((detail.instance?.current_nodes || []).map(String))
    return { tree, tasksByNode, currentSet, instanceStatus: detail.instance?.status }
  }, [detail])

  const { tree, tasksByNode, currentSet, instanceStatus } = ctx

  const nodeReached = (node: FlowNode): boolean => {
    if (currentSet.has(node.id)) return true
    if ((tasksByNode.get(node.id) || []).length) return true
    if (node.type === 'condition') return (node.branches || []).some(branchReached)
    return false
  }
  const branchReached = (branch: ConditionBranch): boolean => branch.children.some(nodeReached)

  const statusOf = (node: FlowNode): RtStatus => {
    if (node.type === 'start') return 'done'
    if (node.type === 'end') return instanceStatus === 'approved' ? 'done' : 'wait'
    const ts = tasksByNode.get(node.id) || []
    if (ts.some(t => t.status === 'rejected')) return 'reject'
    if (currentSet.has(node.id) || ts.some(t => t.status === 'pending')) return 'active'
    if (ts.some(t => t.status === 'approved')) return 'done'
    return 'wait'
  }

  const helpers: ChainHelpers = { statusOf, tasksByNode, branchReached }

  if (!tree.nodes.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={translate('auto.54157c23bb')} />

  return (
    <div className="wrt-root">
      <RuntimeStyles />
      {showSummary && <RuntimeSummary detail={detail} />}
      <RuntimeChain nodes={tree.nodes} nested={false} helpers={helpers} />
    </div>
  )
}

type ChainHelpers = {
  statusOf: (n: FlowNode) => RtStatus
  tasksByNode: Map<string, WorkflowTask[]>
  branchReached: (b: ConditionBranch) => boolean
}

function RuntimeChain({ nodes, nested, helpers }: { nodes: FlowNode[]; nested: boolean; helpers: ChainHelpers }) {
  return (
    <div className="wrt-chain">
      {nodes.map((node, idx) => {
        const isLast = idx === nodes.length - 1
        if (node.type === 'condition') {
          return <ConditionGroup key={node.id} node={node} isLast={isLast} nested={nested} helpers={helpers} />
        }
        return (
          <RuntimeNode
            key={node.id}
            node={node}
            status={helpers.statusOf(node)}
            isLast={isLast}
            nested={nested}
            tasks={helpers.tasksByNode.get(node.id) || []}
          />
        )
      })}
    </div>
  )
}

function nodeIcon(type: FlowNode['type']): ReactNode {
  switch (type) {
    case 'start':
      return <Play size={16} />
    case 'approval':
      return <UserCheck size={16} />
    case 'cc':
      return <Send size={16} />
    case 'condition':
      return <GitBranch size={16} />
    case 'end':
      return <Flag size={16} />
    default:
      return null
  }
}

function modeTag(node: FlowNode): ReactNode {
  if (node.type !== 'approval' || !node.mode || node.mode === 'single') return null
  const label =
    node.mode === 'and'
      ? translate('workflowDesigner.mode.and_short')
      : node.mode === 'sequential'
        ? translate('workflowDesigner.mode.sequential_short')
        : translate('workflowDesigner.mode.or_short')
  return (
    <Tag bordered={false} color="purple" className="wrt-tag">
      {label}
    </Tag>
  )
}

function Rail({ status, isLast }: { status: RtStatus; isLast: boolean }) {
  const meta = STATUS[status]
  return (
    <div className="wrt-rail">
      <span
        className={`wrt-dot${status === 'active' ? ' wrt-dot-active' : ''}`}
        style={{ background: meta.bar, boxShadow: `0 0 0 3px ${meta.bg === '#ffffff' ? '#f1f5f9' : meta.bg}` }}
      />
      {!isLast && <span className="wrt-line" style={{ background: RAIL_LINE[status] }} />}
    </div>
  )
}

function RuntimeNode({
  node,
  status,
  isLast,
  nested,
  tasks,
}: {
  node: FlowNode
  status: RtStatus
  isLast: boolean
  nested: boolean
  tasks: WorkflowTask[]
}) {
  const meta = STATUS[status]
  const isCc = node.type === 'cc'
  const isActive = status === 'active'
  return (
    <div className="wrt-row">
      {!nested && <Rail status={status} isLast={isLast} />}
      <div
        className={`wrt-card${isActive ? ' wrt-card-active' : ''}`}
        style={{ background: meta.bg, borderColor: meta.bar }}
      >
        <div className="wrt-card-head">
          <span className="wrt-ico" style={{ color: meta.color }}>
            {nodeIcon(node.type)}
          </span>
          <span className="wrt-name">{node.name}</span>
          {modeTag(node)}
          {isCc ? (
            <Tag bordered={false} color="cyan" className="wrt-tag">
              {translate('workflowDesigner.summary.cc')}</Tag>
          ) : (
            <span className="wrt-status" style={{ color: meta.color }}>
              {translate(meta.labelKey)}
            </span>
          )}
        </div>
        {node.type === 'approval' && tasks.length > 0 && (
          <div className="wrt-approvers">
            {tasks.map(t => (
              <ApproverRow key={t.id} task={t} />
            ))}
          </div>
        )}
        {node.type === 'approval' && tasks.length === 0 && status === 'wait' && (
          <Text type="secondary" className="wrt-hint">
            {translate('auto.55cf11a9fd')}</Text>
        )}
      </div>
    </div>
  )
}

function ApproverRow({ task }: { task: WorkflowTask }) {
  const st = String(task.status)
  const tone =
    st === 'approved' ? STATUS.done : st === 'rejected' ? STATUS.reject : st === 'pending' ? STATUS.active : STATUS.wait
  const icon = st === 'approved' ? <Check size={12} /> : st === 'rejected' ? <X size={12} /> : <Clock size={12} />
  const name = task.assignee_name || formatMessage('workflowRuntime.user_fallback', { id: task.assignee_id })
  const durText = taskDurationText(task, Date.now())
  return (
    <div className="wrt-approver">
      <Avatar size={26} style={{ background: tone.bar, flex: '0 0 auto', fontSize: 12 }}>
        {initials(task.assignee_name, task.assignee_id)}
      </Avatar>
      <div className="wrt-approver-main">
        <div className="wrt-approver-line">
          <Text strong className="wrt-approver-name">
            {name}
          </Text>
          <span className="wrt-approver-state" style={{ color: tone.color }}>
            {icon}
            {TASK_STATUS_LABEL_KEY[st] ? translate(TASK_STATUS_LABEL_KEY[st]) : st}
          </span>
          {durText && (
            <Tooltip title={formatDateTime(task.decided_at || task.created_at)}>
              <Text type="secondary" className="wrt-approver-time">
                {durText}
              </Text>
            </Tooltip>
          )}
        </div>
        {task.comment && <div className="wrt-approver-comment">{task.comment}</div>}
      </div>
    </div>
  )
}

function ConditionGroup({
  node,
  isLast,
  nested,
  helpers,
}: {
  node: FlowNode
  isLast: boolean
  nested: boolean
  helpers: ChainHelpers
}) {
  const branches = node.branches || []
  const anyReached = branches.some(helpers.branchReached)
  const railStatus: RtStatus = anyReached ? 'done' : 'wait'
  return (
    <div className="wrt-row">
      {!nested && <Rail status={railStatus} isLast={isLast} />}
      <div className="wrt-cond">
        <div className="wrt-cond-head">
          <GitBranch size={14} />
          <span>{node.name || translate('workflowTemplates.node.condition')}</span>
        </div>
        {branches.map(branch => {
          const taken = helpers.branchReached(branch)
          const rule = branch.isDefault
            ? translate('workflowRuntime.branch.default')
            : branch.field
              ? `${branch.field} ${branch.op} ${branch.value}`
              : translate('workflowRuntime.branch.not_configured')
          if (!taken) {
            const names = branchNodeNames(branch.children)
            return (
              <div key={branch.id} className="wrt-branch-collapsed">
                <span className="wrt-branch-name">{branch.name || translate('workflowTemplates.condition')}</span>
                <span className="wrt-branch-rule">{rule}</span>
                <Tag bordered={false} className="wrt-tag wrt-tag-muted">
                  {translate('auto.434b19686a')}</Tag>
                {names.length > 0 && <span className="wrt-branch-trail">{names.join(' → ')}</span>}
              </div>
            )
          }
          return (
            <div key={branch.id} className="wrt-branch-taken">
              <div className="wrt-branch-head">
                <Check size={13} style={{ color: '#16a34a' }} />
                <span className="wrt-branch-name">{branch.name || translate('workflowTemplates.condition')}</span>
                <span className="wrt-branch-rule">{rule}</span>
                <Tag bordered={false} color="green" className="wrt-tag">
                  {translate('auto.808d2d3d7b')}</Tag>
              </div>
              {branch.children.length > 0 ? (
                <RuntimeChain nodes={branch.children} nested helpers={helpers} />
              ) : (
                <Text type="secondary" className="wrt-hint">
                  {translate('auto.d8682167ad')}</Text>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RuntimeStyles() {
  return (
    <style>{`
      .wrt-root { width: 100%; }
      .wrt-summary { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 9px 14px; border-radius: 10px; margin-bottom: 16px; font-size: 13px; }
      .wrt-summary-ico { display: inline-flex; }
      .wrt-summary-label { font-weight: 600; }
      .wrt-summary-detail { color: inherit; opacity: .85; }
      .wrt-chain { display: flex; flex-direction: column; }
      @keyframes wrtPulse { 0% { opacity: .5; transform: scale(1); } 70% { opacity: 0; transform: scale(2.2); } 100% { opacity: 0; transform: scale(2.2); } }
      .wrt-dot-active { position: relative; }
      .wrt-dot-active::after { content: ''; position: absolute; inset: 0; border-radius: 50%; background: #3b82f6; animation: wrtPulse 1.8s ease-out infinite; z-index: -1; }
      .wrt-row { display: flex; gap: 12px; padding-bottom: 14px; }
      .wrt-row:last-child { padding-bottom: 0; }
      .wrt-rail { width: 14px; display: flex; flex-direction: column; align-items: center; flex: 0 0 auto; padding-top: 14px; }
      .wrt-dot { width: 11px; height: 11px; border-radius: 50%; flex: 0 0 auto; z-index: 1; }
      .wrt-line { flex: 1; width: 2px; margin-top: 4px; min-height: 12px; border-radius: 2px; }
      .wrt-card { flex: 1; min-width: 0; border: 0.5px solid; border-left-width: 3px; border-radius: 10px; padding: 10px 14px; transition: box-shadow .18s ease; }
      .wrt-card:hover { box-shadow: 0 4px 14px rgba(15,23,42,.07); }
      .wrt-card-active { box-shadow: 0 0 0 3px rgba(59,130,246,.12); }
      .wrt-card-active:hover { box-shadow: 0 0 0 3px rgba(59,130,246,.16), 0 4px 14px rgba(15,23,42,.07); }
      .wrt-card-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .wrt-ico { display: inline-flex; }
      .wrt-name { font-weight: 600; font-size: 14px; color: #0f172a; }
      .wrt-status { margin-left: auto; font-size: 12px; font-weight: 600; }
      .wrt-tag { border-radius: 6px; margin: 0; }
      .wrt-tag-muted { color: #94a3b8; background: #f1f5f9; }
      .wrt-approvers { margin-top: 10px; display: flex; flex-direction: column; gap: 10px; }
      .wrt-approver { display: flex; gap: 10px; align-items: flex-start; }
      .wrt-approver-main { min-width: 0; flex: 1; }
      .wrt-approver-line { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .wrt-approver-name { font-size: 13px; }
      .wrt-approver-state { display: inline-flex; align-items: center; gap: 3px; font-size: 12px; font-weight: 600; }
      .wrt-approver-time { font-size: 12px; }
      .wrt-approver-comment { margin-top: 4px; font-size: 13px; color: #475569; background: #fff; border: 1px solid #eef2f7; border-radius: 8px; padding: 6px 10px; white-space: pre-wrap; }
      .wrt-hint { font-size: 12px; }
      /* 条件分支 */
      .wrt-cond { flex: 1; min-width: 0; border: 0.5px solid #fde9c8; border-left: 3px solid #f59e0b; border-radius: 10px; background: #fffdf7; padding: 10px 14px; }
      .wrt-cond-head { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: #b45309; margin-bottom: 10px; }
      .wrt-branch-collapsed { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 5px 0; font-size: 12px; color: #94a3b8; }
      .wrt-branch-taken { padding: 2px 0 4px; }
      .wrt-branch-taken + .wrt-branch-taken { margin-top: 8px; }
      .wrt-branch-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
      .wrt-branch-name { font-weight: 600; font-size: 13px; color: #334155; }
      .wrt-branch-rule { font-size: 12px; color: #94a3b8; }
      .wrt-branch-trail { font-size: 12px; color: #cbd5e1; }
    `}</style>
  )
}
