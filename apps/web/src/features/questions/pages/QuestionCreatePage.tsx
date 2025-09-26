import { questionsApi } from '@/shared/api/http'
import AppBreadcrumb from '@/shared/components/AppBreadcrumb'
import LoadingSpinner from '@/shared/components/LoadingSpinner'
import {
  Button,
  Card,
  Checkbox,
  Col,
  Divider,
  Form,
  Input,
  message,
  Radio,
  Row,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import React from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
const { Title, Paragraph, Text } = Typography
const { TextArea } = Input
const { Option } = Select

// ======= 通用 ApiResult 守卫 =======
type ApiSuccess<T = any> = { success: true; data: T; message?: string }
type ApiFailure = { success: false; error?: string; message?: string }
type ApiResult<T = any> = ApiSuccess<T> | ApiFailure
const isSuccess = <T,>(r: any): r is ApiSuccess<T> => r && typeof r === 'object' && r.success === true
const getMsg = (r: any, fallback = '请求失败') =>
  r && typeof r === 'object' ? r.message ?? r.error ?? fallback : fallback
// ===================================

interface OptionType {
  content: string
  is_correct: boolean
}

// ======= 小工具：解析数组 / CSV / JSON =======
const ensureArrayFromMaybeCsv = (input: any): string[] => {
  if (Array.isArray(input)) return input.map(String).filter(Boolean)
  if (typeof input === 'string') {
    return input
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
  }
  return []
}
const parseMaybeJsonArray = (raw: unknown): any[] | null => {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (s.startsWith('[') && s.endsWith(']')) {
      try {
        const arr = JSON.parse(s)
        return Array.isArray(arr) ? arr : null
      } catch {
        return null
      }
    }
  }
  return null
}
const parseTags = (raw: unknown): string[] => {
  const arr = parseMaybeJsonArray(raw)
  if (arr) return arr.map(String).filter(Boolean)
  return ensureArrayFromMaybeCsv(raw)
}

const QuestionCreatePage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams<{ id: string }>()

  // ✅ 统一由 pathname 推导模式
  const mode: 'create' | 'view' | 'edit' = React.useMemo(() => {
    if (!id) return 'create'
    const p = location.pathname
    if (/\/(question-edit|questions\/[^/]+\/edit)\b/i.test(p)) return 'edit'
    return 'view'
  }, [id, location.pathname])

  const isViewMode = mode === 'view'
  const isEditMode = mode === 'edit'

  const [loading, setLoading] = React.useState(false)
  const [initialLoading, setInitialLoading] = React.useState(false)
  const [content, setContent] = React.useState('')
  const [type, setType] = React.useState<'single_choice' | 'multiple_choice' | 'true_false' | 'short_answer'>(
    'single_choice'
  )
  const [options, setOptions] = React.useState<OptionType[]>([
    { content: '', is_correct: false },
    { content: '', is_correct: false },
    { content: '', is_correct: false },
    { content: '', is_correct: false },
  ])
  const [answer, setAnswer] = React.useState('') // true_false: 'true'/'false'; short_answer: 文本
  const [explanation, setExplanation] = React.useState('')
  const [knowledgePoints, setKnowledgePoints] = React.useState<string[]>([])
  const [knowledgePointInput, setKnowledgePointInput] = React.useState('')

  // ====== 新增：标签状态 ======
  const [tags, setTags] = React.useState<string[]>([])
  const [allTags, setAllTags] = React.useState<string[]>([])
  const loadAllTags = React.useCallback(async () => {
    try {
      const res: ApiResult<string[]> = await (questionsApi as any).getTags?.()
      if (isSuccess(res) && Array.isArray(res.data)) setAllTags(res.data)
    } catch {
      // 忽略：接口不存在或失败不阻塞页面
    }
  }, [])
  React.useEffect(() => {
    loadAllTags()
  }, [loadAllTags])

  // 安全解析 options：可能是数组或 JSON 字符串
  const parseOptions = (raw: unknown): OptionType[] => {
    try {
      if (!raw) return []
      const v = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (Array.isArray(v)) {
        return v
          .filter(it => it && typeof it === 'object')
          .map(it => ({
            content: String((it as any).content ?? ''),
            is_correct: Boolean((it as any).is_correct),
          }))
      }
      return []
    } catch {
      return []
    }
  }

  // 把正确答案映射到 options.is_correct
  const applyCorrectToOptions = (opts: OptionType[], correct: unknown): OptionType[] => {
    if (!Array.isArray(opts) || opts.length === 0) return opts
    let indices: number[] = []

    const fromArray = (arr: unknown) =>
      Array.isArray(arr)
        ? (arr as any[]).map(n => Number(n)).filter(n => Number.isInteger(n) && n >= 0 && n < opts.length)
        : null

    if (Array.isArray(correct)) {
      indices = fromArray(correct) ?? []
    } else if (typeof correct === 'string') {
      const s = correct.trim()
      if (s.startsWith('[') && s.endsWith(']')) {
        try {
          const arr = JSON.parse(s)
          const parsed = fromArray(arr)
          if (parsed) indices = parsed
        } catch {}
      }
      if (indices.length === 0) {
        const parts = s
          .split(',')
          .map(t => t.trim())
          .filter(Boolean)
        const allLetters = parts.every(p => /^[A-Za-z]$/.test(p))
        if (allLetters) {
          indices = parts
            .map(p => p.toUpperCase().charCodeAt(0) - 65)
            .filter(n => Number.isInteger(n) && n >= 0 && n < opts.length)
        } else {
          indices = parts.map(p => Number(p)).filter(n => Number.isInteger(n) && n >= 0 && n < opts.length)
        }
      }
    }

    return opts.map((o, i) => ({ ...o, is_correct: indices.includes(i) }))
  }

  // 获取题目详情
  const fetchQuestionDetail = async (questionId: string) => {
    try {
      setInitialLoading(true)
      const res: ApiResult<any> = await questionsApi.getById(questionId)
      if (!isSuccess(res)) {
        message.error(getMsg(res, '获取题目详情失败'))
        return
      }
      const d = res.data
      const q = d && typeof d === 'object' && (d as any).question ? (d as any).question : d
      if (!q || typeof q !== 'object') return

      setContent(q.content || '')
      setType(q.question_type || 'single_choice')
      setExplanation(q.explanation || '')
      setKnowledgePoints(Array.isArray(q.knowledge_points) ? q.knowledge_points : [])

      // 标签
      setTags(parseTags((q as any).tags))

      // 选项
      let opts = parseOptions(q.options)
      if (opts.length) {
        const ca = q.correct_answer
        if (ca != null) opts = applyCorrectToOptions(opts, ca)
        setOptions(opts)
      } else {
        setOptions([])
      }

      // 答案
      if (q.question_type === 'true_false') {
        if (typeof q.correct_answer === 'string') {
          setAnswer(q.correct_answer.toLowerCase() === 'true' ? 'true' : 'false')
        } else if (Array.isArray(q.correct_answer)) {
          setAnswer(q.correct_answer[0] === 0 ? 'true' : 'false')
        } else {
          setAnswer('')
        }
      } else if (q.question_type === 'short_answer') {
        setAnswer(q.answer || '')
      } else {
        setAnswer('')
      }
    } catch (error: any) {
      console.error('获取题目详情错误:', error)
      message.error(error?.message || '获取题目详情失败')
    } finally {
      setInitialLoading(false)
    }
  }

  React.useEffect(() => {
    if (id) fetchQuestionDetail(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const handleOptionChange = (index: number, field: keyof OptionType, value: string | boolean) => {
    const newOptions = [...options]
    newOptions[index] = { ...newOptions[index], [field]: value }
    if (type === 'single_choice' && field === 'is_correct' && value === true) {
      newOptions.forEach((option, i) => {
        if (i !== index) newOptions[i] = { ...option, is_correct: false }
      })
    }
    setOptions(newOptions)
  }

  const addOption = () => setOptions([...options, { content: '', is_correct: false }])
  const removeOption = (index: number) => {
    if (options.length <= 2) return message.error('至少需要两个选项')
    const newOptions = [...options]
    newOptions.splice(index, 1)
    setOptions(newOptions)
  }

  const addKnowledgePoint = () => {
    const v = knowledgePointInput.trim()
    if (!v) return
    if (knowledgePoints.includes(v)) return message.error('知识点已存在')
    setKnowledgePoints([...knowledgePoints, v])
    setKnowledgePointInput('')
  }
  const removeKnowledgePoint = (index: number) => {
    const next = [...knowledgePoints]
    next.splice(index, 1)
    setKnowledgePoints(next)
  }

  // 表单提交
  const handleSubmit = async () => {
    if (!content.trim()) return message.error('请输入题目内容')

    if (type === 'single_choice' || type === 'multiple_choice') {
      const hasEmptyOption = options.some(option => !option.content.trim())
      if (hasEmptyOption) return message.error('选项内容不能为空')
      const hasCorrectOption = options.some(option => option.is_correct)
      if (!hasCorrectOption) return message.error('请至少选择一个正确选项')
    }
    if (type === 'true_false' && !answer) return message.error('请选择正确答案')
    if (type === 'short_answer' && !answer.trim()) return message.error('请输入参考答案')

    try {
      setLoading(true)
      const payload: any = {
        content,
        question_type: type,
        knowledge_points: knowledgePoints,
        tags, // ← 带上标签
        explanation,
        exam_id: 1,
        score: 10,
      }

      if (type === 'single_choice' || type === 'multiple_choice') {
        payload.options = options
        payload.correct_answer = options
          .map((opt, idx) => (opt.is_correct ? idx : null))
          .filter((v): v is number => v !== null)
      } else if (type === 'true_false') {
        payload.options = [{ content: '正确' }, { content: '错误' }]
        payload.correct_answer = [answer === 'true' ? 0 : 1]
      } else if (type === 'short_answer') {
        payload.options = []
        payload.correct_answer = answer
        payload.answer = answer
      }

      if (isEditMode && id) {
        const res: ApiResult<any> = await questionsApi.update(id, payload)
        if (!isSuccess(res)) return message.error(getMsg(res, '题目更新失败'))
        message.success('题目更新成功')
      } else {
        const res: ApiResult<any> = await questionsApi.create(payload)
        if (!isSuccess(res)) return message.error(getMsg(res, '题目创建失败'))
        message.success('题目创建成功')
      }

      navigate('/admin/questions')
    } catch (error: any) {
      console.error(isEditMode ? '更新题目错误:' : '创建题目错误:', error)
      message.error(error?.message || (isEditMode ? '更新题目失败' : '创建题目失败'))
    } finally {
      setLoading(false)
    }
  }

  const pageTitle = isViewMode ? '查看题目' : isEditMode ? '编辑题目' : '创建新题目'
  const pageDesc = isViewMode ? '查看题目详细信息' : isEditMode ? '修改现有题目信息' : '添加新的考试题目到题库'

  if (initialLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="flex justify-center items-center min-h-[300px]">
          <LoadingSpinner size="md" />
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <AppBreadcrumb />
      {/* 页面标题 */}
      <Card style={{ marginBottom: '24px' }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2} style={{ margin: 0 }}>
              {pageTitle}
            </Title>
            <Paragraph type="secondary" style={{ margin: '8px 0 0 0' }}>
              {pageDesc}
            </Paragraph>
          </Col>
          <Col>
            <Button onClick={() => navigate('/admin/questions')} icon={<ArrowLeft style={{ width: 16, height: 16 }} />}>
              返回题目列表
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 表单 */}
      <Card>
        <Form layout="vertical" onFinish={isViewMode ? undefined : handleSubmit} disabled={isViewMode}>
          {/* 基本信息 */}
          <Row gutter={[24, 16]}>
            <Col xs={24} md={12}>
              <Form.Item label="题目类型" required>
                <Select value={type} onChange={value => setType(value as any)} disabled={isViewMode}>
                  <Option value="single_choice">单选题</Option>
                  <Option value="multiple_choice">多选题</Option>
                  <Option value="true_false">判断题</Option>
                  <Option value="short_answer">简答题</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {/* 题目内容 */}
          <Form.Item label="题目内容" required>
            <TextArea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="输入题目内容"
              rows={4}
              disabled={isViewMode}
            />
          </Form.Item>

          {/* 选择题选项 */}
          {(type === 'single_choice' || type === 'multiple_choice') && (
            <Form.Item
              label={
                <Row justify="space-between" align="middle" style={{ width: '100%' }}>
                  <Col>
                    <Text strong>选项 *</Text>
                  </Col>
                  <Col>
                    <Button
                      type="dashed"
                      size="small"
                      onClick={addOption}
                      icon={<Plus style={{ width: 14, height: 14 }} />}
                      disabled={isViewMode}
                    >
                      添加选项
                    </Button>
                  </Col>
                </Row>
              }
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                {options.map((option, index) => (
                  <Row key={index} gutter={[8, 0]} align="middle">
                    <Col flex="none">
                      <Checkbox
                        checked={option.is_correct}
                        onChange={e => handleOptionChange(index, 'is_correct', e.target.checked)}
                        disabled={isViewMode}
                      />
                    </Col>
                    <Col flex="auto">
                      <Input
                        value={option.content}
                        onChange={e => handleOptionChange(index, 'content', e.target.value)}
                        placeholder={`选项 ${index + 1}`}
                        disabled={isViewMode}
                      />
                    </Col>
                    <Col flex="none">
                      <Button
                        type="text"
                        danger
                        size="small"
                        onClick={() => removeOption(index)}
                        icon={<Trash2 style={{ width: 16, height: 16 }} />}
                        disabled={isViewMode}
                      />
                    </Col>
                  </Row>
                ))}
              </Space>
            </Form.Item>
          )}

          {/* 判断题答案 */}
          {type === 'true_false' && (
            <Form.Item label="正确答案" required>
              <Radio.Group value={answer} onChange={e => setAnswer(e.target.value)} disabled={isViewMode}>
                <Radio value="true">正确</Radio>
                <Radio value="false">错误</Radio>
              </Radio.Group>
            </Form.Item>
          )}

          {/* 简答题答案 */}
          {type === 'short_answer' && (
            <Form.Item label="参考答案" required>
              <TextArea
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                placeholder="输入参考答案"
                rows={4}
                disabled={isViewMode}
              />
            </Form.Item>
          )}

          {/* 解析 */}
          <Form.Item label="题目解析">
            <TextArea
              value={explanation}
              onChange={e => setExplanation(e.target.value)}
              placeholder="输入题目解析（可选）"
              rows={4}
              disabled={isViewMode}
            />
          </Form.Item>

          {/* 知识点 */}
          <Form.Item label="知识点">
            <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
              <Input
                value={knowledgePointInput}
                onChange={e => setKnowledgePointInput(e.target.value)}
                placeholder="输入知识点"
                onPressEnter={e => {
                  e.preventDefault()
                  addKnowledgePoint()
                }}
                disabled={isViewMode}
              />
              <Button type="primary" onClick={addKnowledgePoint} disabled={isViewMode}>
                添加
              </Button>
            </Space.Compact>

            {knowledgePoints.length > 0 && (
              <Space wrap>
                {knowledgePoints.map((point, index) => (
                  <Tag key={index} closable={!isViewMode} onClose={() => removeKnowledgePoint(index)} color="blue">
                    {point}
                  </Tag>
                ))}
              </Space>
            )}
          </Form.Item>

          {/* ===== 新增：标签 ===== */}
          <Form.Item label="标签（可多选/自定义）">
            {isViewMode ? (
              tags.length ? (
                <Space wrap>
                  {tags.map((t, i) => (
                    <Tag key={i} color="geekblue">
                      {t}
                    </Tag>
                  ))}
                </Space>
              ) : (
                <span style={{ color: '#999' }}>-</span>
              )
            ) : (
              <Select
                mode="tags"
                placeholder="选择或输入标签后回车"
                value={tags}
                onChange={vals => setTags(vals as string[])}
                options={allTags.map(t => ({ label: t, value: t }))}
              />
            )}
          </Form.Item>

          {/* 提交按钮 */}
          <Divider />
          <Row justify="end">
            <Space>
              <Button onClick={() => navigate('/admin/questions')}>返回</Button>
              {!isViewMode && (
                <Button type="primary" htmlType="submit" loading={loading}>
                  {isEditMode ? '更新题目' : '创建题目'}
                </Button>
              )}
            </Space>
          </Row>
        </Form>
      </Card>
    </div>
  )
}

export default QuestionCreatePage
