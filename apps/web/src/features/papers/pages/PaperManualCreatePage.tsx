import { api } from '@/shared/api/core/httpClient'
import { papersApi } from '@/shared/api/endpoints/papers'
import { createTablePaginationConfig, resolvePaginationChange } from '@/shared/constants/pagination'

import dayjs from '@/shared/utils/dayjs'
import { PlusOutlined } from '@ant-design/icons'
import {
  Affix,
  App,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '@/shared/contexts/LanguageContext'

type BankQuestion = {
  id: number
  title?: string
  question_type: 'single_choice' | 'multiple_choice' | 'true_false' | string
  difficulty?: 'easy' | 'medium' | 'hard' | string
  content?: string
}

type SelectedItem = { id: number; score: number; order: number }

const diffKey: Record<string, string> = { easy: 'papers.diff_easy', medium: 'papers.diff_medium', hard: 'papers.diff_hard' }
const typeKey: Record<string, string> = {
  single_choice: 'papers.qtype_single',
  multiple_choice: 'papers.qtype_multiple',
  true_false: 'papers.qtype_tf',
}

const { Title, Text } = Typography

export default function PaperManualCreatePage() {
  const { t } = useLanguage()
  const { message, modal } = App.useApp()
  const nav = useNavigate()

  // 题库筛选 + 分页
  const [loading, setLoading] = useState(false)
  const [bank, setBank] = useState<BankQuestion[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [difficulty, setDifficulty] = useState<'all' | 'easy' | 'medium' | 'hard'>('all')
  const [qtype, setQtype] = useState<'all' | 'single_choice' | 'multiple_choice' | 'true_false'>('all')

  // 右侧：已选题
  const [selected, setSelected] = useState<SelectedItem[]>([])

  // 试卷 meta
  const [form] = Form.useForm()
  useEffect(() => {
    form.setFieldsValue({
      title: t('papers.manual_create2'),
      description: '',
      duration: 60,
      difficulty: 'medium',
    })
  }, [form])

  const fetchBank = async () => {
    try {
      setLoading(true)
      const { items, total } = await papersApi.bankList({
        page,
        limit: pageSize,
        search: search || undefined,
        difficulty: difficulty === 'all' ? undefined : difficulty,
        type: qtype === 'all' ? undefined : qtype,
      })
      setBank(items as any)
      setTotal(total)
    } catch (e: any) {
      message.error(e?.message || t('papers.load_bank_failed'))
      setBank([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBank()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, search, difficulty, qtype])

  // 表格列
  const columns: ColumnsType<BankQuestion> = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    {
      title: t('papers.col_qtype'),
      dataIndex: 'question_type',
      width: 100,
      render: (v: string) => <Tag color="blue">{typeKey[v] ? t(typeKey[v]) : v}</Tag>,
    },
    {
      title: t('papers.col_difficulty'),
      dataIndex: 'difficulty',
      width: 90,
      render: d => (
        <Tag color={d === 'easy' ? 'success' : d === 'hard' ? 'error' : 'warning'}>{diffKey[d] ? t(diffKey[d]) : d || '—'}</Tag>
      ),
    },
    {
      title: t('questions.field_content'),
      dataIndex: 'content',
      ellipsis: { showTitle: false },
      render: (v, r) => (
        <Text ellipsis={{ tooltip: v || r.title || '' }} style={{ maxWidth: 560 }}>
          {v || r.title || '—'}
        </Text>
      ),
    },
    {
      title: t('papers.col_actions'),
      key: 'op',
      width: 120,
      render: (_, r) => {
        const exists = selected.some(s => s.id === r.id)
        return (
          <Button
            type={exists ? 'default' : 'link'}
            onClick={() => {
              if (exists) {
                setSelected(prev => prev.filter(i => i.id !== r.id).map((it, i) => ({ ...it, order: i + 1 })))
              } else {
                setSelected(prev => [...prev, { id: r.id, score: 5, order: prev.length + 1 }])
              }
            }}
          >
            {exists ? t('papers.op_remove') : t('papers.op_add')}
          </Button>
        )
      },
    },
  ]

  // 手工录入题目 modal
  const [customOpen, setCustomOpen] = useState(false)
  const [customForm] = Form.useForm()
  const [customList, setCustomList] = useState<
    Array<{
      type: 'single_choice' | 'multiple_choice' | 'true_false'
      content: string
      options: string[]
      answer: string // 单/判：'A'；多选：'A,B'
      score: number
    }>
  >([])

  const resetCustom = () => {
    customForm.resetFields()
    customForm.setFieldsValue({
      type: 'single_choice',
      options: ['A', 'B', 'C', 'D'],
      score: 5,
    })
  }

  useEffect(() => resetCustom(), []) // 初始化

  const onAddCustom = async () => {
    const v = await customForm.validateFields()
    const opts: string[] = (v.options || []).map((s: string) => s?.trim()).filter(Boolean)
    const ans: string = (v.answer || '').toString().toUpperCase()
    setCustomList(prev => [
      ...prev,
      { type: v.type, content: v.content, options: opts, answer: ans, score: Number(v.score || 5) },
    ])
    setCustomOpen(false)
    resetCustom()
    message.success(t('papers.custom_added'))
  }

  const totalScore = useMemo(() => {
    const a = selected.reduce((s, it) => s + (Number(it.score) || 0), 0)
    const b = customList.reduce((s, it) => s + (Number(it.score) || 0), 0)
    return a + b
  }, [selected, customList])

  const handleBankPaginationChange = (nextPage: number, nextPageSize?: number) => {
    const next = resolvePaginationChange(nextPage, nextPageSize, pageSize)
    setPage(next.page)
    setPageSize(next.pageSize)
  }

  // 提交创建试卷（并可选创建任务）
  const onCreatePaper = async () => {
    try {
      const meta = await form.validateFields()
      if (selected.length === 0 && customList.length === 0) {
        message.warning(t('papers.need_one_question'))
        return
      }

      // 先用题库选择项创建试卷
      const payload = {
        title: meta.title,
        description: meta.description || '',
        difficulty: meta.difficulty || 'medium',
        duration: Number(meta.duration || 60),
        total_score: totalScore,
        questions: selected.map(it => ({ question_id: it.id, score: Number(it.score || 5), order: it.order })),
      }
      const r: any = await papersApi.createWithQuestions(payload as any)
      const paperId: number = Number(r?.data?.paperId ?? r?.paperId)

      // 再把“手工录入题目”以快照形式挂到该试卷
      for (let i = 0; i < customList.length; i++) {
        const c = customList[i]
        await papersApi.addCustomQuestion(paperId, {
          question_type: c.type,
          content: c.content,
          options: c.options,
          answer: c.answer,
          score: Number(c.score || 5),
          order: selected.length + i + 1,
        })
      }

      // 询问是否一键创建任务并关联此试卷
      Modal.confirm({
        title: t('papers.create_success_ask'),
        okText: t('papers.create_task'),
        cancelText: t('papers.later'),
        onOk: async () => {
          const start = dayjs()
          const end = start.add(7, 'day')
          await api.post('/tasks', {
            title: t('papers.exam_suffix').replace('{title}', meta.title),
            description: meta.description || '',
            status: 'not_started',
            start_time: start.format('YYYY-MM-DD HH:mm:ss'),
            end_time: end.format('YYYY-MM-DD HH:mm:ss'),
            type: 'exam',
            paper_id: paperId, // 🔗 直接关联试卷
          })
          message.success(t('papers.task_created'))
          nav('/admin/tasks/create') // 你的任务管理路由
        },
        onCancel: () => {
          nav(`/admin/paper-detail/${paperId}`)
        },
      })
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || t('papers.create_failed'))
    }
  }

  return (
    <div style={{ minWidth: 1200, margin: '0 auto' }}>
    
      <Affix offsetTop={0}>
        <Card styles={{ body: { padding: 12 } }} style={{ borderRadius: 12 }}>
          <Row align="middle" justify="space-between">
            <Col>
              <Space direction="vertical" size={0}>
                <Title level={4} style={{ margin: 0 }}>
                  {t('papers.manual_create2')}
                </Title>
                <Text type="secondary">{t('papers.manual_subtitle')}</Text>
              </Space>
            </Col>
            <Col>
              <Space>
                <Button type="primary" onClick={onCreatePaper}>
                  {t('papers.create_paper')}
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>
      </Affix>

      <Divider />

      <Row gutter={16} align="top">
        {/* 左侧：题库 + 筛选 + 分页 */}
        <Col xs={24} lg={16}>
          <Card title={t('papers.bank_card')} style={{ borderRadius: 12 }}>
            <Space wrap style={{ marginBottom: 12 }}>
              <Input
                allowClear
                placeholder={t('papers.search_q_ph')}
                value={search}
                onChange={e => {
                  setPage(1)
                  setSearch(e.target.value)
                }}
                style={{ width: 260 }}
              />
              <Select
                value={difficulty}
                onChange={v => {
                  setPage(1)
                  setDifficulty(v)
                }}
                style={{ width: 160 }}
                options={[
                  { value: 'all', label: t('papers.diff_all') },
                  { value: 'easy', label: t('papers.diff_easy') },
                  { value: 'medium', label: t('papers.diff_medium') },
                  { value: 'hard', label: t('papers.diff_hard') },
                ]}
              />
              <Select
                value={qtype}
                onChange={v => {
                  setPage(1)
                  setQtype(v)
                }}
                style={{ width: 160 }}
                options={[
                  { value: 'all', label: t('papers.qtype_all') },
                  { value: 'single_choice', label: t('papers.qtype_single') },
                  { value: 'multiple_choice', label: t('papers.qtype_multiple') },
                  { value: 'true_false', label: t('papers.qtype_tf') },
                ]}
              />
            </Space>

            <Table<BankQuestion>
              rowKey="id"
              loading={loading}
              columns={columns}
              dataSource={bank}
              pagination={createTablePaginationConfig({
                current: page,
                pageSize,
                total,
                unit: t('papers.unit_question'),
                onChange: handleBankPaginationChange,
              })}
            />
          </Card>
        </Col>

        {/* 右侧：试卷信息 + 已选题列表 + 手工录入 */}
        <Col xs={24} lg={8}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card title={t('papers.paper_info')} style={{ borderRadius: 12 }}>
              <Form form={form} layout="vertical">
                <Form.Item name="title" label={t('papers.field_title')} rules={[{ required: true, message: t('papers.title_required') }]}>
                  <Input placeholder={t('papers.title_ph')} />
                </Form.Item>
                <Form.Item name="description" label={t('papers.field_desc')}>
                  <Input.TextArea rows={3} placeholder={t('papers.desc_ph')} />
                </Form.Item>
                <Form.Item name="difficulty" label={t('papers.col_difficulty')} initialValue="medium">
                  <Select
                    options={[
                      { value: 'easy', label: t('papers.diff_easy') },
                      { value: 'medium', label: t('papers.diff_medium') },
                      { value: 'hard', label: t('papers.diff_hard') },
                    ]}
                  />
                </Form.Item>
                <Form.Item name="duration" label={t('papers.field_duration')} initialValue={60}>
                  <InputNumber min={5} max={300} style={{ width: 160 }} />
                </Form.Item>
                <Divider style={{ margin: '12px 0' }} />
                <Space>
                  <Text>{t('papers.current_total')}</Text>
                  <Title level={4} style={{ margin: 0 }}>
                    {t('papers.score_unit').replace('{v}', String(totalScore))}
                  </Title>
                </Space>
              </Form>
            </Card>

            <Card
              title={
                <Space>
                  {t('papers.selected_count')} <Tag color="blue">{selected.length + customList.length}</Tag>
                </Space>
              }
              extra={
                <Button icon={<PlusOutlined />} onClick={() => setCustomOpen(true)}>
                  {t('papers.manual_entry')}
                </Button>
              }
              style={{ borderRadius: 12 }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                {selected.map((it, idx) => (
                  <Row
                    key={it.id}
                    align="middle"
                    gutter={8}
                    style={{ borderBottom: '1px dashed #efefef', paddingBottom: 8 }}
                  >
                    <Col flex="40px">
                      <Tag>{idx + 1}</Tag>
                    </Col>
                    <Col flex="auto">{t('papers.bank_q').replace('{id}', String(it.id))}</Col>
                    <Col>
                      <Space>
                        <Text type="secondary">{t('questions.field_score')}</Text>
                        <InputNumber
                          min={1}
                          max={100}
                          value={it.score}
                          onChange={v =>
                            setSelected(prev => prev.map(x => (x.id === it.id ? { ...x, score: Number(v || 5) } : x)))
                          }
                          style={{ width: 90 }}
                        />
                        <Button
                          type="link"
                          danger
                          onClick={() => setSelected(prev => prev.filter(x => x.id !== it.id))}
                        >
                          {t('papers.op_remove')}
                        </Button>
                      </Space>
                    </Col>
                  </Row>
                ))}

                {customList.map((c, i) => (
                  <Row
                    key={`c-${i}`}
                    align="middle"
                    gutter={8}
                    style={{ borderBottom: '1px dashed #efefef', paddingBottom: 8 }}
                  >
                    <Col flex="40px">
                      <Tag color="purple">{selected.length + i + 1}</Tag>
                    </Col>
                    <Col flex="auto">
                      <Space wrap>
                        <Tag color="processing">{typeKey[c.type] ? t(typeKey[c.type]) : c.type}</Tag>
                        <Text ellipsis={{ tooltip: c.content }} style={{ maxWidth: 220 }}>
                          {c.content}
                        </Text>
                      </Space>
                    </Col>
                    <Col>
                      <Space>
                        <Text type="secondary">{t('questions.field_score')}</Text>
                        <InputNumber
                          min={1}
                          max={100}
                          value={c.score}
                          onChange={v =>
                            setCustomList(prev =>
                              prev.map((x, idx) => (idx === i ? { ...x, score: Number(v || 5) } : x))
                            )
                          }
                          style={{ width: 90 }}
                        />
                        <Button
                          type="link"
                          danger
                          onClick={() => setCustomList(prev => prev.filter((_, idx) => idx !== i))}
                        >
                          {t('papers.op_remove')}
                        </Button>
                      </Space>
                    </Col>
                  </Row>
                ))}

                {selected.length + customList.length === 0 && <Text type="secondary">{t('papers.no_questions')}</Text>}
              </Space>
            </Card>
          </Space>
        </Col>
      </Row>

      {/* 手工录入题目 Modal */}
      <Modal
        open={customOpen}
        maskClosable={false}
        title={t('papers.manual_entry')}
        onCancel={() => setCustomOpen(false)}
        onOk={onAddCustom}
        okText={t('papers.add_to_paper')}
      >
        <Form form={customForm} layout="vertical">
          <Form.Item name="type" label={t('papers.col_qtype')} initialValue="single_choice" rules={[{ required: true }]}>
            <Radio.Group
              options={[
                { value: 'single_choice', label: t('papers.qtype_single') },
                { value: 'multiple_choice', label: t('papers.qtype_multiple') },
                { value: 'true_false', label: t('papers.qtype_tf') },
              ]}
            />
          </Form.Item>
          <Form.Item name="content" label={t('questions.field_content')} rules={[{ required: true, message: t('questions.field_content_required') }]}>
            <Input.TextArea rows={3} placeholder={t('papers.content_ph2')} />
          </Form.Item>

          {/* 选项 */}
          <Form.Item noStyle shouldUpdate>
            {({ getFieldValue }) => {
              const t = getFieldValue('type')
              if (t === 'true_false') {
                return (
                  <>
                    <Form.Item label={t('questions.correct_answer')} name="answer" rules={[{ required: true, message: t('papers.select_answer') }]}>
                      <Radio.Group
                        options={[
                          { value: 'A', label: t('papers.opt_a_true') },
                          { value: 'B', label: t('papers.opt_b_false') },
                        ]}
                      />
                    </Form.Item>
                    <Form.Item name="options" initialValue={[t('questions.tf_true'), t('questions.tf_false')]} hidden>
                      <Input />
                    </Form.Item>
                  </>
                )
              }
              return (
                <>
                  <Form.Item
                    label={t('papers.options_lines')}
                    name="options"
                    rules={[
                      { required: true, message: t('papers.options_required') },
                      {
                        validator: (_, val: string[]) => {
                          const arr = (val || []).filter(Boolean)
                          if (arr.length < 2) return Promise.reject(new Error(t('papers.min_2_options')))
                          return Promise.resolve()
                        },
                      },
                    ]}
                  >
                    <Select
                      mode="tags"
                      tokenSeparators={[',', '\n']}
                      open={false}
                      placeholder={t('papers.options_ph')}
                    />
                  </Form.Item>
                  <Form.Item
                    label={t('questions.correct_answer')}
                    name="answer"
                    rules={[{ required: true, message: t('papers.answer_letter_required') }]}
                  >
                    <Input placeholder={t('papers.answer_ph')} />
                  </Form.Item>
                </>
              )
            }}
          </Form.Item>

          <Form.Item name="score" label={t('questions.field_score')} initialValue={5}>
            <InputNumber min={1} max={100} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
