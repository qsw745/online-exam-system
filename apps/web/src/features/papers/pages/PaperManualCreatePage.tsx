import React, { useEffect, useMemo, useState } from 'react'
import {
  App,
  Affix,
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
import { PlusOutlined } from '@ant-design/icons'
import { papersApi } from '@/shared/api/endpoints/papers'
import { api } from '@/shared/api/core/httpClient'
import dayjs from '@/shared/utils/dayjs'
import { useNavigate } from 'react-router-dom'

type BankQuestion = {
  id: number
  title?: string
  question_type: 'single_choice' | 'multiple_choice' | 'true_false' | string
  difficulty?: 'easy' | 'medium' | 'hard' | string
  content?: string
}

type SelectedItem = { id: number; score: number; order: number }

const diffText: Record<string, string> = { easy: '简单', medium: '中等', hard: '困难' }
const typeText: Record<string, string> = {
  single_choice: '单选',
  multiple_choice: '多选',
  true_false: '判断',
}

const { Title, Text } = Typography

export default function PaperManualCreatePage() {
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
      title: '手动组卷',
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
      message.error(e?.message || '加载题库失败')
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
      title: '题型',
      dataIndex: 'question_type',
      width: 100,
      render: t => <Tag color="blue">{typeText[t] || t}</Tag>,
    },
    {
      title: '难度',
      dataIndex: 'difficulty',
      width: 90,
      render: d => (
        <Tag color={d === 'easy' ? 'success' : d === 'hard' ? 'error' : 'warning'}>{diffText[d] || d || '—'}</Tag>
      ),
    },
    {
      title: '题干',
      dataIndex: 'content',
      ellipsis: { showTitle: false },
      render: (v, r) => (
        <Text ellipsis={{ tooltip: v || r.title || '' }} style={{ maxWidth: 560 }}>
          {v || r.title || '—'}
        </Text>
      ),
    },
    {
      title: '操作',
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
            {exists ? '移除' : '加入'}
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
      options: ['选项A', '选项B', '选项C', '选项D'],
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
    message.success('已加入手工题（暂存）')
  }

  const totalScore = useMemo(() => {
    const a = selected.reduce((s, it) => s + (Number(it.score) || 0), 0)
    const b = customList.reduce((s, it) => s + (Number(it.score) || 0), 0)
    return a + b
  }, [selected, customList])

  // 提交创建试卷（并可选创建任务）
  const onCreatePaper = async () => {
    try {
      const meta = await form.validateFields()
      if (selected.length === 0 && customList.length === 0) {
        message.warning('请至少选择或录入 1 道题')
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
        title: '试卷创建成功，是否立即创建考试任务？',
        okText: '创建任务',
        cancelText: '稍后',
        onOk: async () => {
          const start = dayjs()
          const end = start.add(7, 'day')
          await api.post('/tasks', {
            title: `${meta.title} 考试`,
            description: meta.description || '',
            status: 'not_started',
            start_time: start.format('YYYY-MM-DD HH:mm:ss'),
            end_time: end.format('YYYY-MM-DD HH:mm:ss'),
            type: 'exam',
            paper_id: paperId, // 🔗 直接关联试卷
          })
          message.success('任务已创建并关联试卷')
          nav('/admin/tasks/create') // 你的任务管理路由
        },
        onCancel: () => {
          nav(`/admin/paper-detail/${paperId}`)
        },
      })
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || '创建失败')
    }
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 16 }}>
      <Affix offsetTop={0}>
        <Card styles={{ body: { padding: 12 } }} style={{ borderRadius: 12 }}>
          <Row align="middle" justify="space-between">
            <Col>
              <Space direction="vertical" size={0}>
                <Title level={4} style={{ margin: 0 }}>
                  手动组卷
                </Title>
                <Text type="secondary">从题库选择 + 手工录入，自由组卷</Text>
              </Space>
            </Col>
            <Col>
              <Space>
                <Button type="primary" onClick={onCreatePaper}>
                  创建试卷
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
          <Card title="题库（支持分页）" style={{ borderRadius: 12 }}>
            <Space wrap style={{ marginBottom: 12 }}>
              <Input
                allowClear
                placeholder="搜索题干/标题"
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
                  { value: 'all', label: '所有难度' },
                  { value: 'easy', label: '简单' },
                  { value: 'medium', label: '中等' },
                  { value: 'hard', label: '困难' },
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
                  { value: 'all', label: '所有题型' },
                  { value: 'single_choice', label: '单选' },
                  { value: 'multiple_choice', label: '多选' },
                  { value: 'true_false', label: '判断' },
                ]}
              />
            </Space>

            <Table<BankQuestion>
              rowKey="id"
              loading={loading}
              columns={columns}
              dataSource={bank}
              pagination={{
                current: page,
                pageSize,
                total,
                showSizeChanger: true,
                showQuickJumper: true,
                onChange: (p, ps) => {
                  setPage(p)
                  if (ps && ps !== pageSize) setPageSize(ps)
                },
              }}
            />
          </Card>
        </Col>

        {/* 右侧：试卷信息 + 已选题列表 + 手工录入 */}
        <Col xs={24} lg={8}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card title="试卷信息" style={{ borderRadius: 12 }}>
              <Form form={form} layout="vertical">
                <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入试卷标题' }]}>
                  <Input placeholder="试卷标题" />
                </Form.Item>
                <Form.Item name="description" label="说明">
                  <Input.TextArea rows={3} placeholder="试卷说明（可选）" />
                </Form.Item>
                <Form.Item name="difficulty" label="难度" initialValue="medium">
                  <Select
                    options={[
                      { value: 'easy', label: '简单' },
                      { value: 'medium', label: '中等' },
                      { value: 'hard', label: '困难' },
                    ]}
                  />
                </Form.Item>
                <Form.Item name="duration" label="时长（分钟）" initialValue={60}>
                  <InputNumber min={5} max={300} style={{ width: 160 }} />
                </Form.Item>
                <Divider style={{ margin: '12px 0' }} />
                <Space>
                  <Text>当前总分：</Text>
                  <Title level={4} style={{ margin: 0 }}>
                    {totalScore} 分
                  </Title>
                </Space>
              </Form>
            </Card>

            <Card
              title={
                <Space>
                  已选题 <Tag color="blue">{selected.length + customList.length}</Tag>
                </Space>
              }
              extra={
                <Button icon={<PlusOutlined />} onClick={() => setCustomOpen(true)}>
                  手工录入题目
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
                    <Col flex="auto">题库题（ID: {it.id}）</Col>
                    <Col>
                      <Space>
                        <Text type="secondary">分值</Text>
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
                          移除
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
                        <Tag color="processing">{typeText[c.type] || c.type}</Tag>
                        <Text ellipsis={{ tooltip: c.content }} style={{ maxWidth: 220 }}>
                          {c.content}
                        </Text>
                      </Space>
                    </Col>
                    <Col>
                      <Space>
                        <Text type="secondary">分值</Text>
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
                          移除
                        </Button>
                      </Space>
                    </Col>
                  </Row>
                ))}

                {selected.length + customList.length === 0 && <Text type="secondary">还没有题目</Text>}
              </Space>
            </Card>
          </Space>
        </Col>
      </Row>

      {/* 手工录入题目 Modal */}
      <Modal
        open={customOpen}
        title="手工录入题目"
        onCancel={() => setCustomOpen(false)}
        onOk={onAddCustom}
        okText="加入试卷"
      >
        <Form form={customForm} layout="vertical">
          <Form.Item name="type" label="题型" initialValue="single_choice" rules={[{ required: true }]}>
            <Radio.Group
              options={[
                { value: 'single_choice', label: '单选' },
                { value: 'multiple_choice', label: '多选' },
                { value: 'true_false', label: '判断' },
              ]}
            />
          </Form.Item>
          <Form.Item name="content" label="题干" rules={[{ required: true, message: '请输入题干' }]}>
            <Input.TextArea rows={3} placeholder="请输入题干（支持少量 HTML）" />
          </Form.Item>

          {/* 选项 */}
          <Form.Item noStyle shouldUpdate>
            {({ getFieldValue }) => {
              const t = getFieldValue('type')
              if (t === 'true_false') {
                return (
                  <>
                    <Form.Item label="正确答案" name="answer" rules={[{ required: true, message: '请选择答案' }]}>
                      <Radio.Group
                        options={[
                          { value: 'A', label: 'A. 正确' },
                          { value: 'B', label: 'B. 错误' },
                        ]}
                      />
                    </Form.Item>
                    <Form.Item name="options" initialValue={['正确', '错误']} hidden>
                      <Input />
                    </Form.Item>
                  </>
                )
              }
              return (
                <>
                  <Form.Item
                    label="选项（每行一个）"
                    name="options"
                    rules={[
                      { required: true, message: '请输入选项' },
                      {
                        validator: (_, val: string[]) => {
                          const arr = (val || []).filter(Boolean)
                          if (arr.length < 2) return Promise.reject(new Error('至少 2 个选项'))
                          return Promise.resolve()
                        },
                      },
                    ]}
                  >
                    <Select
                      mode="tags"
                      tokenSeparators={[',', '\n']}
                      open={false}
                      placeholder="输入后回车添加；默认会显示 A/B/C/D"
                    />
                  </Form.Item>
                  <Form.Item
                    label="正确答案"
                    name="answer"
                    rules={[{ required: true, message: '请输入答案字母，如 A 或 A,B' }]}
                  >
                    <Input placeholder="单选/判断：A；多选：A,B" />
                  </Form.Item>
                </>
              )
            }}
          </Form.Item>

          <Form.Item name="score" label="分值" initialValue={5}>
            <InputNumber min={1} max={100} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
