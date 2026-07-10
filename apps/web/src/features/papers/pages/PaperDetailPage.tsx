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
  Tooltip,
  message as antdMessage,
} from 'antd'
import { ArrowUpOutlined, ArrowDownOutlined, PlusOutlined, DeleteOutlined, EditOutlined, PrinterOutlined, LockOutlined } from '@ant-design/icons'
import { printHtml, escapeHtml, parseOptionContents, optionLetter } from '@/shared/utils/print'
import { useNavigate, useParams } from 'react-router-dom'
import { useLanguage } from '@/shared/contexts/LanguageContext'
import { formatDateTime } from '@/shared/utils/datetime'
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
  submission_count?: number
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

const diffKey: Record<string, string> = { easy: 'papers.diff_easy', medium: 'papers.diff_medium', hard: 'papers.diff_hard' }
const typeKey: Record<string, string> = {
  single_choice: 'papers.qtype_single',
  multiple_choice: 'papers.qtype_multiple',
  true_false: 'papers.qtype_tf',
  fill_blank: 'papers.qtype_fill',
  essay: 'papers.qtype_essay',
}

const fmt = (dt?: string) => formatDateTime(dt) || '—'

const PaperDetailPage: React.FC = () => {
  const { t } = useLanguage()
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

  // 已有考生交卷 → 题目结构锁定（后端同样拦截，这里提前禁用入口）
  const locked = Number(paper?.submission_count || 0) > 0

  // 打印试卷：withAnswers 时附标准答案（教师存档用），否则为学生作答版
  const handlePrint = (withAnswers: boolean) => {
    if (!paper) return
    const typeLabel = (qt?: string) => (typeKey[qt || ''] ? t(typeKey[qt || '']) : qt || '')
    const body = [
      `<h1>${escapeHtml(paper.title)}</h1>`,
      `<div class="meta">`,
      `<span>${escapeHtml(t('papers.col_total_score'))}：${escapeHtml(paper.total_score ?? '')}</span>`,
      `<span>${escapeHtml(t('papers.col_duration'))}：${escapeHtml(paper.duration ?? '')} ${escapeHtml(t('papers.minutes_unit'))}</span>`,
      `<span>${escapeHtml(t('papers.col_question_count'))}：${rows.length}</span>`,
      `</div>`,
      ...rows.map((r: any, idx) => {
        const opts = parseOptionContents(r.question_options)
        const optHtml = opts.length
          ? `<ul class="q-opts">${opts.map((o, i) => `<li>${optionLetter(i)}. ${escapeHtml(o)}</li>`).join('')}</ul>`
          : ''
        const ansHtml = withAnswers
          ? `<div class="q-ans">${escapeHtml(t('papers.print_answer_label'))}：${escapeHtml(
              parseOptionContents(r.question_answer).join('、') || r.question_answer || ''
            )}</div>`
          : ''
        return `<div class="q"><div class="q-head">${idx + 1}. ${escapeHtml(
          r.question_content || r.question_title || ''
        )}<span class="q-type">（${escapeHtml(typeLabel(r.question_type))} · ${escapeHtml(String(r.score))}${escapeHtml(t('papers.print_score_unit'))}）</span></div>${optHtml}${ansHtml}</div>`
      }),
      `<div class="footer">${escapeHtml(formatDateTime(new Date()))}</div>`,
    ].join('')
    printHtml(paper.title, body)
  }

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
      else message.error(e?.message || t('papers.load_detail_failed'))
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
      if (!ok) throw new Error(res?.message || t('papers.update_failed_short'))
      message.success(t('papers.update_success'))
      setEditOpen(false)
      await fetchAll()
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.message || t('papers.update_paper_failed'))
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
      antdMessage.success(t('papers.q_removed'))
      await fetchAll()
    } catch (e: any) {
      antdMessage.error(e?.message || t('papers.remove_failed'))
    }
  }

  const saveOrder = async () => {
    try {
      setSavingOrder(true)
      const orders = rows.map(r => ({ questionId: r.question_id, order: r.order }))
      await papersApi.updateOrder(id!, orders)
      antdMessage.success(t('papers.order_saved'))
      await fetchAll()
    } catch (e: any) {
      antdMessage.error(e?.message || t('papers.save_order_failed'))
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
      antdMessage.success(t('papers.add_success'))
      setAddOpen(false)
      form.resetFields()
      await fetchAll()
    } catch (e: any) {
      if (e?.errorFields) return
      antdMessage.error(e?.message || t('papers.add_failed'))
    }
  }

  const columns = useMemo(
    () => [
      { title: t('papers.col_order'), dataIndex: 'order', width: 80 },
      {
        title: t('papers.col_question'),
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
        title: t('papers.col_type_diff'),
        dataIndex: 'question_type',
        width: 180,
        render: (_: any, r: Row) => (
          <Space size={4} wrap>
            <Tag>{typeKey[r.question_type || ''] ? t(typeKey[r.question_type || '']) : r.question_type || '—'}</Tag>
            <Tag color="blue">{diffKey[r.question_difficulty || ''] ? t(diffKey[r.question_difficulty || '']) : r.question_difficulty || '—'}</Tag>
          </Space>
        ),
      },
      { title: t('questions.field_score'), dataIndex: 'score', width: 100, align: 'right' as const },
      {
        title: t('papers.col_actions'),
        key: 'actions',
        fixed: 'right' as const,
        width: 220,
        render: (_: any, r: Row, idx: number) => (
          <Space wrap>
            <Button
              size="small"
              icon={<ArrowUpOutlined />}
              onClick={() => move(r.question_id, 'up')}
              disabled={locked || idx === 0}
            >
              {t('papers.move_up')}
            </Button>
            <Button
              size="small"
              icon={<ArrowDownOutlined />}
              onClick={() => move(r.question_id, 'down')}
              disabled={locked || idx === rows.length - 1}
            >
              {t('papers.move_down')}
            </Button>
            <Popconfirm
              title={t('papers.confirm_delete_q')}
              okText={t('app.delete')}
              okButtonProps={{ danger: true }}
              onConfirm={() => remove(r.question_id)}
              disabled={locked}
            >
              <Button size="small" danger icon={<DeleteOutlined />} disabled={locked}>
                {t('app.delete')}
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [move, remove, rows.length, t, locked]
  )

  if (loading) return <LoadingSpinner center="page" text={t('papers.loading_detail')} />

  if (notFound || !paper) {
    return (
      <Result
        status="404"
        title={t('papers.not_found')}
        subTitle={t('papers.not_found_desc')}
        extra={<Button onClick={() => nav(-1)}>{t('app.back')}</Button>}
      />
    )
  }

  const totalScore = rows.reduce((s, r) => s + (r.score || 0), 0)

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Breadcrumb
        items={[
          { title: t('papers.bc_bank') },
          { title: <a onClick={() => nav('/admin/papers')}>{t('papers.title')}</a> },
          { title: t('papers.bc_detail') },
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
            <Button onClick={() => nav('/admin/papers')}>{t('papers.back_to_list')}</Button>
            <Button icon={<PrinterOutlined />} onClick={() => handlePrint(false)}>
              {t('papers.print')}
            </Button>
            <Button icon={<PrinterOutlined />} onClick={() => handlePrint(true)}>
              {t('papers.print_with_answers')}
            </Button>
            {/* 在当前页编辑，不跳转 */}
            <Button type="primary" icon={<EditOutlined />} onClick={openEditModal}>
              {t('papers.edit_basic')}
            </Button>
          </Space>
        }
      >
        <Descriptions column={2} bordered styles={{ label: { width: 120 } }}>
          <Descriptions.Item label={t('papers.paper_title')} span={2}>
            {paper.title}
          </Descriptions.Item>
          <Descriptions.Item label={t('papers.col_difficulty')}>
            {diffKey[paper.difficulty || ''] ? t(diffKey[paper.difficulty || '']) : paper.difficulty || '—'}
          </Descriptions.Item>
          <Descriptions.Item label={t('papers.col_total_score')}>{paper.total_score ?? totalScore ?? '—'}</Descriptions.Item>
          <Descriptions.Item label={t('papers.field_duration')}>{paper.duration ?? '—'}</Descriptions.Item>
          <Descriptions.Item label={t('papers.col_created_at')}>{fmt(paper.created_at ?? (paper as any).createdAt)}</Descriptions.Item>
          <Descriptions.Item label={t('papers.col_updated_at')} span={2}>
            {fmt(paper.updated_at ?? (paper as any).updatedAt)}
          </Descriptions.Item>
          <Descriptions.Item label={t('papers.desc2')} span={2}>
            {paper.description || '—'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        title={t('papers.q_list_title').replace('{n}', String(rows.length)).replace('{score}', String(totalScore))}
        extra={
          <Space wrap>
            {locked && (
              <Tooltip title={t('papers.locked_tip').replace('{n}', String(paper.submission_count))}>
                <Tag color="warning" icon={<LockOutlined />} style={{ margin: 0 }}>
                  {t('papers.locked')}
                </Tag>
              </Tooltip>
            )}
            <Button onClick={() => setAddOpen(true)} type="primary" icon={<PlusOutlined />} disabled={locked}>
              {t('papers.add_question')}
            </Button>
            <Button onClick={saveOrder} loading={savingOrder} disabled={locked}>
              {t('papers.save_order')}
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
        maskClosable={false}
        title={t('papers.add_q_modal')}
        open={addOpen}
        destroyOnHidden
        onCancel={() => {
          setAddOpen(false)
          form.resetFields()
        }}
        onOk={onAdd}
        okText={t('papers.add_question')}
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            label={t('papers.qid_label')}
            name="questionId"
            rules={[{ required: true, message: t('papers.qid_required') }]}
          >
            <InputNumber min={1} precision={0} style={{ width: '100%' }} placeholder={t('papers.qid_ph')} />
          </Form.Item>
          <Form.Item label={t('questions.field_score')} name="score" rules={[{ required: true, message: t('papers.score_required') }]}>
            <InputNumber min={1} precision={0} style={{ width: '100%' }} placeholder={t('papers.score_ph')} />
          </Form.Item>
          <Form.Item label={t('papers.order_label')} name="order">
            <InputNumber min={1} precision={0} style={{ width: '100%' }} placeholder={t('papers.order_ph')} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 基本信息编辑（当前页） */}
      <Modal
        title={t('papers.edit_paper_modal')}
        maskClosable={false}
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={submitEdit}
        okText={t('app.save')}
        confirmLoading={editLoading}
        destroyOnHidden
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="title" label={t('papers.paper_title')} rules={[{ required: true, message: t('papers.title_required') }]}>
            <Input placeholder={t('papers.title_required')} maxLength={100} />
          </Form.Item>
          <Form.Item name="description" label={t('papers.desc2')}>
            <Input.TextArea placeholder={t('papers.desc_ph2')} rows={4} />
          </Form.Item>
          <Form.Item name="difficulty" label={t('papers.col_difficulty')} rules={[{ required: true, message: t('papers.select_difficulty') }]}>
            <Select
              options={[
                { value: 'easy', label: t('papers.diff_easy') },
                { value: 'medium', label: t('papers.diff_medium') },
                { value: 'hard', label: t('papers.diff_hard') },
              ]}
            />
          </Form.Item>
          <Space size={16} wrap>
            <Form.Item name="total_score" label={t('papers.col_total_score')} rules={[{ required: true, message: t('papers.total_required') }]}>
              <InputNumber min={0} precision={0} addonAfter={t('papers.addon_score')} style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="duration" label={t('papers.col_duration')} rules={[{ required: true, message: t('papers.duration_required') }]}>
              <InputNumber min={0} precision={0} addonAfter={t('papers.addon_min')} style={{ width: 200 }} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </Space>
  )
}

export default PaperDetailPage
