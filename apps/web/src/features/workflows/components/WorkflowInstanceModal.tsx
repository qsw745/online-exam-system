import { App, Modal, Space, Spin, Tag, Typography } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { Background, Controls, MiniMap, ReactFlow, MarkerType, Handle, Position, type Edge, type Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { workflowsApi, type WorkflowInstanceDetail, type WorkflowTask } from '@/shared/api/endpoints/workflows'
import { workflowStatusLabel } from '@/shared/utils/workflow'

const { Text, Title } = Typography

type NodeType = 'start' | 'approval' | 'end'

type FlowNodeData = {
  label: string
  nodeType: NodeType
  status?: string
  running?: boolean
}

type FlowNode = Node<FlowNodeData, 'workflow'>

const statusColor = (status?: string) => {
  if (status === 'rejected') return '#fee2e2'
  if (status === 'approved') return '#dcfce7'
  if (status === 'pending') return '#fef3c7'
  if (status === 'running') return '#e0f2fe'
  return '#f8fafc'
}

function FlowNodeView({ data }: { data: FlowNodeData }) {
  return (
    <div
      style={{
        padding: 10,
        borderRadius: 8,
        border: `1px solid ${data.running ? '#3b82f6' : '#e5e7eb'}`,
        background: statusColor(data.running ? 'running' : data.status),
        minWidth: 140,
      }}
    >
      <Handle type="target" position={Position.Top} />
      <div style={{ fontWeight: 600 }}>{data.label}</div>
      <div style={{ fontSize: 12, color: '#6b7280' }}>{data.nodeType}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

const nodeTypes = { workflow: FlowNodeView }

const normalizeDef = (def: any) => (def && Array.isArray(def.nodes) ? def : { nodes: [], edges: [] })

const buildNodes = (detail: WorkflowInstanceDetail): FlowNode[] => {
  const def = normalizeDef(detail.template?.definition)
  const nodeList = def.nodes || []
  const current = new Set<string>(detail.instance?.current_nodes || [])
  const tasksByNode = new Map<string, WorkflowTask[]>()
  for (const t of detail.tasks || []) {
    if (!tasksByNode.has(t.node_id)) tasksByNode.set(t.node_id, [])
    tasksByNode.get(t.node_id)!.push(t)
  }
  return nodeList.map((n: any, idx: number) => {
    const position =
      n.position && typeof n.position.x === 'number' && typeof n.position.y === 'number'
        ? n.position
        : { x: 80 + (idx % 3) * 220, y: 60 + Math.floor(idx / 3) * 160 }
    const tasks = tasksByNode.get(n.id) || []
    const status = tasks.some(t => t.status === 'rejected')
      ? 'rejected'
      : tasks.some(t => t.status === 'pending')
        ? 'pending'
        : tasks.some(t => t.status === 'approved')
          ? 'approved'
          : undefined
    return {
      id: n.id,
      type: 'workflow',
      position,
      data: {
        label: n.name || n.id,
        nodeType: n.type as NodeType,
        status,
        running: current.has(n.id),
      },
    }
  })
}

const buildEdges = (detail: WorkflowInstanceDetail): Edge[] => {
  const def = normalizeDef(detail.template?.definition)
  return (def.edges || []).map((e: any, idx: number) => ({
    id: `e-${e.from}-${e.to}-${idx}`,
    source: e.from,
    target: e.to,
    animated: false,
  }))
}

export default function WorkflowInstanceModal({
  instanceId,
  open,
  onClose,
}: {
  instanceId: number | null
  open: boolean
  onClose: () => void
}) {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<WorkflowInstanceDetail | null>(null)

  useEffect(() => {
    if (!open || !instanceId) return
    setLoading(true)
    workflowsApi
      .getInstance(instanceId)
      .then(res => setDetail(res))
      .catch(err => message.error(err?.message || '加载流程详情失败'))
      .finally(() => setLoading(false))
  }, [instanceId, message, open])

  const nodes = useMemo(() => (detail ? buildNodes(detail) : []), [detail])
  const edges = useMemo(() => (detail ? buildEdges(detail) : []), [detail])

  return (
    <Modal open={open} onCancel={onClose} footer={null} width={900} title="流程详情">
      {loading || !detail ? (
        <Spin />
      ) : (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={5} style={{ marginBottom: 4 }}>
              {detail.template?.name || '流程'}
            </Title>
            <Space size="middle">
              <Text>实例状态</Text>
              <Tag>{workflowStatusLabel(detail.instance?.status)}</Tag>
              <Text>实体</Text>
              <Tag>{detail.instance?.entity_type}</Tag>
              <Text>编号</Text>
              <Tag>{detail.instance?.entity_id}</Tag>
            </Space>
          </div>

          <div style={{ height: 320, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              defaultEdgeOptions={{
                markerEnd: { type: MarkerType.ArrowClosed },
                style: { stroke: '#94a3b8', strokeWidth: 2 },
              }}
              fitView
            >
              <MiniMap />
              <Controls />
              <Background gap={16} />
            </ReactFlow>
          </div>

          <div>
            <Title level={5}>处理过程</Title>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              {(detail.tasks || []).map(task => (
                <div
                  key={task.id}
                  style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: 8, background: '#fff' }}
                >
                  <Space size="middle">
                    <Tag>{workflowStatusLabel(task.status)}</Tag>
                    <Text strong>{task.node_name}</Text>
                    <Text type="secondary">处理人：{task.assignee_name || task.assignee_id}</Text>
                  </Space>
                  {task.comment && (
                    <div style={{ marginTop: 6, textAlign: 'right' }}>
                      <Text type="secondary" style={{ whiteSpace: 'pre-line' }}>
                        {task.comment}
                      </Text>
                    </div>
                  )}
                  {task.decided_at && (
                    <div style={{ marginTop: 4 }}>
                      <Text type="secondary">处理时间：{task.decided_at}</Text>
                    </div>
                  )}
                </div>
              ))}
              {!detail.tasks?.length && <Text type="secondary">暂无处理记录</Text>}
            </Space>
          </div>
        </Space>
      )}
    </Modal>
  )
}
