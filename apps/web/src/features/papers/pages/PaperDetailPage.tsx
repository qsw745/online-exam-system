import React, { useEffect, useMemo, useState, useCallback } from 'react'
import {
  App,
  Breadcrumb,
  Button,
  Card,
  Descriptions,
  Space,
  Typography,
  Result,
  Table,
  Tag,
  Popconfirm,
  Modal,
  Form,
  InputNumber,
  Input,
  Select,
  message as antdMessage,
} from 'antd'
import { ArrowUpOutlined, ArrowDownOutlined, PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import LoadingSpinner from '@/shared/components/LoadingSpinner'
import { papersApi } from '@/shared/api/endpoints/papers'

type Paper = {
  id: number | string
  title: string
  description?: string
  difficulty?: 'easy' | 'medium' | 'hard' | string
  total_score?: number
  duration?: number
  created_at?: string
  updated_at?: string
  [k: string]: any
}

type Row = {
  paper_id: number
  question_id: number
  score: number
  order: number
  question_title?: string
  question_type?: string
  question_content?: string
  question_answer?: string
  question_difficulty?: 'easy' | 'medium' | 'hard' | string
}

const diffText: Record<string, string> = { easy: '简单', medium: '中等', hard: '困难' }
const typeText: Record<string, string> = {
  single_choice: '单选',
  multiple_choice: '多选',
  true_false: '判断',
  fill_blank: '填空',
  essay: '简答',
}

const fmt = (dt?: string) => {
  if (!dt) return '—'
  const d = new Date(dt)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('zh-CN')
}

const PaperDetailPage: React.FC = () => {
  const { message } = App.useApp()
  const nav = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [paper, setPaper] = useState<Paper | null>(null)
  const [notFound, setNotFound] = useState(false)

  const [rows, setRows] = useState<Row[]>([])
  const [savingOrder, setSavingOrder] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  // —— 基本信息编辑（当前页）
  const [editOpen, setEditOpen] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [editForm] = Form.useForm<{
    title: string
    description?: string
    difficulty: 'easy' | 'medium' | 'hard' | string
    total_score: number
    duration: number
  }>()

  const [form] = Form.useForm<{ questionId: number; score: number; order?: number }>()

  const fetchAll = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [paperRes, qs] = await Promise.all([papersApi.getById(id), papersApi.getQuestions(id)])
      setPaper(paperRes)
      setRows(qs.sort((a, b) => a.order - b.order) as Row[])
      setNotFound(false)
    } catch (e: any) {
      if (/不存在|404/i.test(e?.message)) setNotFound(true)
      else message.error(e?.message || '获取试卷详情失败')
    } finally {
      setLoading(false)
    }
  }, [id, message])

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!alive) return
      await fetchAll()
    })()
    return () => {
      alive = false
    }
  }, [fetchAll])

  const openEditModal = () => {
    if (!paper) return
    editForm.setFieldsValue({
      title: paper.title,
      description: paper.description,
      difficulty: (paper.difficulty as any) ?? 'medium',
      total_score: paper.total_score ?? rows.reduce((s, r) => s + (r.score || 0), 0),
      duration: paper.duration ?? 60,
    })
    setEditOpen(true)
  }

  const submitEdit = async () => {
    try {
      const values = await editForm.validateFields()
      setEditLoading(true)
      const res: any = await (papersApi as any).update?.(id!, values)
      const ok = res?.success ?? (res?.status >= 200 && res?.status < 300) ?? true
      if (!ok) throw new Error(res?.message || '更新失败')
      message.success('更新试卷成功')
      setEditOpen(false)
      await fetchAll()
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.message || '更新试卷失败')
    } finally {
      setEditLoading(false)
    }
  }

  const move = (qid: number, dir: 'up' | 'down') => {
    setRows(prev => {
      const idx = prev.findIndex(r => r.question_id === qid)
      if (idx < 0) return prev
      const newArr = [...prev]
      const swapIdx = dir === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= newArr.length) return prev
      const a = { ...newArr[idx] }
      const b = { ...newArr[swapIdx] }
      const tmpOrder = a.order
      a.order = b.order
      b.order = tmpOrder
      newArr[idx] = b
      newArr[swapIdx] = a
      return newArr.sort((x, y) => x.order - y.order)
    })
  }

  const remove = async (qid: number) => {
    try {
      await papersApi.removeQuestion(id!, qid)
      antdMessage.success('已移除题目')
      await fetchAll()
    } catch (e: any) {
      antdMessage.error(e?.message || '移除失败')
    }
  }

  const saveOrder = async () => {
    try {
      setSavingOrder(true)
      const orders = rows.map(r => ({ questionId: r.question_id, order: r.order }))
      await papersApi.updateOrder(id!, orders)
      antdMessage.success('题目顺序已保存')
      await fetchAll()
    } catch (e: any) {
      antdMessage.error(e?.message || '保存顺序失败')
    } finally {
      setSavingOrder(false)
    }
  }

  const onAdd = async () => {
    try {
      const v = await form.validateFields()
      const order =
        typeof v.order === 'number' && Number.isFinite(v.order)
          ? v.order
          : rows.length
          ? Math.max(...rows.map(r => r.order)) + 1
          : 1
      await papersApi.addQuestion(id!, { questionId: Number(v.questionId), score: Number(v.score), order })
      antdMessage.success('添加成功')
      setAddOpen(false)
      form.resetFields()
      await fetchAll()
    } catch (e: any) {
      if (e?.errorFields) return
      antdMessage.error(e?.message || '添加失败')
    }
  }

  const columns = useMemo(
    () => [
      { title: '序号', dataIndex: 'order', width: 80 },
      {
        title: '题目',
        dataIndex: 'question_title',
        render: (_: any, r: Row) => (
          <div style={{ maxWidth: 720 }}>
            <div style={{ fontWeight: 600 }}>{r.question_title ?? `#${r.question_id}`}</div>
            {r.question_content ? (
              <div style={{ color: '#444', marginTop: 4, whiteSpace: 'pre-wrap' }}>{r.question_content}</div>
            ) : null}
          </div>
        ),
      },
      {
        title: '类型/难度',
        dataIndex: 'question_type',
        width: 180,
        render: (_: any, r: Row) => (
          <Space size={4} wrap>
            <Tag>{typeText[r.question_type || ''] || r.question_type || '—'}</Tag>
            <Tag color="blue">{diffText[r.question_difficulty || ''] || r.question_difficulty || '—'}</Tag>
          </Space>
        ),
      },
      { title: '分值', dataIndex: 'score', width: 100, align: 'right' as const },
      {
        title: '操作',
        key: 'actions',
        fixed: 'right' as const,
        width: 220,
        render: (_: any, r: Row, idx: number) => (
          <Space wrap>
            <Button
              size="small"
              icon={<ArrowUpOutlined />}
              onClick={() => move(r.question_id, 'up')}
              disabled={idx === 0}
            >
              上移
            </Button>
            <Button
              size="small"
              icon={<ArrowDownOutlined />}
              onClick={() => move(r.question_id, 'down')}
              disabled={idx === rows.length - 1}
            >
              下移
            </Button>
            <Popconfirm
              title="确认删除此题目？"
              okText="删除"
              okButtonProps={{ danger: true }}
              onConfirm={() => remove(r.question_id)}
            >
              <Button size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [move, remove, rows.length]
  )

  if (loading) return <LoadingSpinner center="page" text="加载试卷详情…" />

  if (notFound || !paper) {
    return (
      <Result
        status="404"
        title="试卷不存在"
        subTitle="请确认链接是否正确，或该试卷已被删除。"
        extra={<Button onClick={() => nav(-1)}>返回</Button>}
      />
    )
  }

  const totalScore = rows.reduce((s, r) => s + (r.score || 0), 0)

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Breadcrumb
        items={[
          { title: '题库' },
          { title: <a onClick={() => nav('/admin/papers')}>试卷管理</a> },
          { title: '试卷详情' },
        ]}
      />
      <Card
        title={
          <Typography.Title level={4} style={{ margin: 0 }}>
            {paper.title}
          </Typography.Title>
        }
        extra={
          <Space wrap>
            <Button onClick={() => nav('/admin/papers')}>返回列表</Button>
            {/* 在当前页编辑，不跳转 */}
            <Button type="primary" icon={<EditOutlined />} onClick={openEditModal}>
              编辑基本信息
            </Button>
          </Space>
        }
      >
        <Descriptions column={2} bordered labelStyle={{ width: 120 }}>
          <Descriptions.Item label="试卷标题" span={2}>
            {paper.title}
          </Descriptions.Item>
          <Descriptions.Item label="难度">
            {diffText[paper.difficulty || ''] || paper.difficulty || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="总分">{paper.total_score ?? totalScore ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="时长（分钟）">{paper.duration ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{fmt(paper.created_at ?? (paper as any).createdAt)}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{fmt(paper.updated_at ?? (paper as any).updatedAt)}</Descriptions.Item>
          <Descriptions.Item label="描述" span={2}>
            {paper.description || '—'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        title={`题目列表（共 ${rows.length} 题，合计 ${totalScore} 分）`}
        extra={
          <Space wrap>
            <Button onClick={() => setAddOpen(true)} type="primary" icon={<PlusOutlined />}>
              添加题目
            </Button>
            <Button onClick={saveOrder} loading={savingOrder}>
              保存顺序
            </Button>
          </Space>
        }
        styles={{ body: { padding: 0 } }}
      >
        <Table<Row>
          rowKey={r => `${r.paper_id}-${r.question_id}`}
          sticky
          size="middle"
          scroll={{ x: 1000 }}
          columns={columns as any}
          dataSource={rows}
          pagination={false}
        />
      </Card>

      {/* 添加题目弹窗 */}
      <Modal
        title="添加题目到本试卷"
        open={addOpen}
        destroyOnHidden
        onCancel={() => {
          setAddOpen(false)
          form.resetFields()
        }}
        onOk={onAdd}
        okText="添加"
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            label="题目 ID（从题库表）"
            name="questionId"
            rules={[{ required: true, message: '请输入题目ID' }]}
          >
            <InputNumber min={1} precision={0} style={{ width: '100%' }} placeholder="例如：101" />
          </Form.Item>
          <Form.Item label="分值" name="score" rules={[{ required: true, message: '请输入分值' }]}>
            <InputNumber min={1} precision={0} style={{ width: '100%' }} placeholder="例如：5" />
          </Form.Item>
          <Form.Item label="显示顺序（可选，默认追加到末尾）" name="order">
            <InputNumber min={1} precision={0} style={{ width: '100%' }} placeholder="例如：10" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 基本信息编辑（当前页） */}
      <Modal
        title="编辑试卷基本信息"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={submitEdit}
        okText="保存"
        confirmLoading={editLoading}
        destroyOnHidden
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="title" label="试卷标题" rules={[{ required: true, message: '请输入试卷标题' }]}>
            <Input placeholder="请输入试卷标题" maxLength={100} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="试卷描述" rows={4} />
          </Form.Item>
          <Form.Item name="difficulty" label="难度" rules={[{ required: true, message: '请选择难度' }]}>
            <Select
              options={[
                { value: 'easy', label: '简单' },
                { value: 'medium', label: '中等' },
                { value: 'hard', label: '困难' },
              ]}
            />
          </Form.Item>
          <Space size={16} wrap>
            <Form.Item name="total_score" label="总分" rules={[{ required: true, message: '请输入总分' }]}>
              <InputNumber min={0} precision={0} addonAfter="分" style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="duration" label="时长" rules={[{ required: true, message: '请输入时长' }]}>
              <InputNumber min={0} precision={0} addonAfter="分钟" style={{ width: 200 }} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </Space>
  )
}

export default PaperDetailPage
