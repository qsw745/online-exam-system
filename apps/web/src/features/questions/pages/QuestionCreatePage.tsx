import { questionsApi } from '@/shared/api/http'

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
import { useLanguage } from '@/shared/contexts/LanguageContext'
import { translate } from '@/shared/utils/i18n'
const { Title, Paragraph, Text } = Typography
const { TextArea } = Input
const { Option } = Select

// ======= 通用 ApiResult 守卫 =======
type ApiSuccess<T = any> = { success: true; data: T; message?: string }
type ApiFailure = { success: false; error?: string; message?: string }
type ApiResult<T = any> = ApiSuccess<T> | ApiFailure
const isSuccess = <T,>(r: any): r is ApiSuccess<T> => r && typeof r === 'object' && r.success === true
const getMsg = (r: any, fallback = translate('questions.req_failed')) =>
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
  const { t } = useLanguage()
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
        message.error(getMsg(res, t('questions.load_detail_failed')))
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
      message.error(error?.message || t('questions.load_detail_failed'))
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
    if (options.length <= 2) return message.error(t('questions.min_two_options'))
    const newOptions = [...options]
    newOptions.splice(index, 1)
    setOptions(newOptions)
  }

  const addKnowledgePoint = () => {
    const v = knowledgePointInput.trim()
    if (!v) return
    if (knowledgePoints.includes(v)) return message.error(t('questions.kp_exists'))
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
    if (!content.trim()) return message.error(t('questions.content_required'))

    if (type === 'single_choice' || type === 'multiple_choice') {
      const hasEmptyOption = options.some(option => !option.content.trim())
      if (hasEmptyOption) return message.error(t('questions.option_empty'))
      const hasCorrectOption = options.some(option => option.is_correct)
      if (!hasCorrectOption) return message.error(t('questions.need_correct_option'))
    }
    if (type === 'true_false' && !answer) return message.error(t('questions.select_correct_answer'))
    if (type === 'short_answer' && !answer.trim()) return message.error(t('questions.need_ref_answer'))

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
        payload.options = [{ content: t('questions.tf_true') }, { content: t('questions.tf_false') }]
        payload.correct_answer = [answer === 'true' ? 0 : 1]
      } else if (type === 'short_answer') {
        payload.options = []
        payload.correct_answer = answer
        payload.answer = answer
      }

      if (isEditMode && id) {
        const res: ApiResult<any> = await questionsApi.update(id, payload)
        if (!isSuccess(res)) return message.error(getMsg(res, t('questions.update_failed')))
        message.success(t('questions.update_success'))
      } else {
        const res: ApiResult<any> = await questionsApi.create(payload)
        if (!isSuccess(res)) return message.error(getMsg(res, t('questions.create_failed')))
        message.success(t('questions.create_success'))
      }

      navigate('/admin/questions')
    } catch (error: any) {
      console.error(isEditMode ? '更新题目错误:' : '创建题目错误:', error)
      message.error(error?.message || (isEditMode ? t('questions.update_failed') : t('questions.create_failed')))
    } finally {
      setLoading(false)
    }
  }

  const pageTitle = isViewMode ? t('questions.page_view') : isEditMode ? t('questions.page_edit') : t('questions.page_create')
  const pageDesc = isViewMode ? t('questions.desc_view') : isEditMode ? t('questions.desc_edit') : t('questions.desc_create')

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
              {t('questions.back_to_list')}
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
              <Form.Item label={t('questions.col_type')} required>
                <Select value={type} onChange={value => setType(value as any)} disabled={isViewMode}>
                  <Option value="single_choice">{t('questions.type_single')}</Option>
                  <Option value="multiple_choice">{t('questions.type_multiple')}</Option>
                  <Option value="true_false">{t('questions.type_true_false')}</Option>
                  <Option value="short_answer">{t('questions.type_short')}</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {/* 题目内容 */}
          <Form.Item label={t('questions.col_content')} required>
            <TextArea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={t('questions.content_ph')}
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
                    <Text strong>{t('questions.options_label')} *</Text>
                  </Col>
                  <Col>
                    <Button
                      type="dashed"
                      size="small"
                      onClick={addOption}
                      icon={<Plus style={{ width: 14, height: 14 }} />}
                      disabled={isViewMode}
                    >
                      {t('questions.add_option')}
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
                        placeholder={t('questions.option_n_ph').replace('{n}', String(index + 1))}
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
            <Form.Item label={t('questions.correct_answer')} required>
              <Radio.Group value={answer} onChange={e => setAnswer(e.target.value)} disabled={isViewMode}>
                <Radio value="true">{t('questions.tf_true')}</Radio>
                <Radio value="false">{t('questions.tf_false')}</Radio>
              </Radio.Group>
            </Form.Item>
          )}

          {/* 简答题答案 */}
          {type === 'short_answer' && (
            <Form.Item label={t('questions.ref_answer')} required>
              <TextArea
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                placeholder={t('questions.ref_answer_ph')}
                rows={4}
                disabled={isViewMode}
              />
            </Form.Item>
          )}

          {/* 解析 */}
          <Form.Item label={t('questions.explanation')}>
            <TextArea
              value={explanation}
              onChange={e => setExplanation(e.target.value)}
              placeholder={t('questions.explanation_ph')}
              rows={4}
              disabled={isViewMode}
            />
          </Form.Item>

          {/* 知识点 */}
          <Form.Item label={t('questions.col_knowledge')}>
            <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
              <Input
                value={knowledgePointInput}
                onChange={e => setKnowledgePointInput(e.target.value)}
                placeholder={t('questions.kp_ph')}
                onPressEnter={e => {
                  e.preventDefault()
                  addKnowledgePoint()
                }}
                disabled={isViewMode}
              />
              <Button type="primary" onClick={addKnowledgePoint} disabled={isViewMode}>
                {t('app.add')}
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
          <Form.Item label={t('questions.tags_label')}>
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
                placeholder={t('questions.tags_ph')}
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
              <Button onClick={() => navigate('/admin/questions')}>{t('app.back')}</Button>
              {!isViewMode && (
                <Button type="primary" htmlType="submit" loading={loading}>
                  {isEditMode ? t('questions.update_btn') : t('questions.create_btn')}
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
