import LoadingSpinner from '@shared/components/LoadingSpinner'
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
import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { questionsApi } from '../api'
const { Title, Paragraph, Text } = Typography
const { TextArea } = Input
const { Option } = Select

// ======= 通用 ApiResult 守卫，避免在 {} 上取 .data =======
type ApiSuccess<T = any> = { success: true; data: T; message?: string }
type ApiFailure = { success: false; error?: string; message?: string }
type ApiResult<T = any> = ApiSuccess<T> | ApiFailure
const isSuccess = <T,>(r: any): r is ApiSuccess<T> => r && typeof r === 'object' && r.success === true
const getMsg = (r: any, fallback = '请求失败') =>
  r && typeof r === 'object' ? r.message ?? r.error ?? fallback : fallback
// =======================================================

interface Option {
  content: string
  is_correct: boolean
}

const QuestionCreatePage: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(false)
  const [content, setContent] = useState('')
  const [type, setType] = useState<'single_choice' | 'multiple_choice' | 'true_false' | 'short_answer'>('single_choice')
  const [options, setOptions] = useState<Option[]>([
    { content: '', is_correct: false },
    { content: '', is_correct: false },
    { content: '', is_correct: false },
    { content: '', is_correct: false },
  ])
  const [answer, setAnswer] = useState('') // true_false: 'true'/'false'; short_answer: 文本
  const [explanation, setExplanation] = useState('')
  const [knowledgePoints, setKnowledgePoints] = useState<string[]>([])
  const [knowledgePointInput, setKnowledgePointInput] = useState('')
  const [isViewMode, setIsViewMode] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)

  // 根据路由判断当前模式
  useEffect(() => {
    if (id) {
      const path = window.location.pathname
      if (path.includes('question-detail')) setIsViewMode(true)
      else if (path.includes('question-edit')) setIsEditMode(true)

      // 获取题目详情
      fetchQuestionDetail(id)
    }
  }, [id])

  // 安全解析 options：可能是数组或 JSON 字符串
  const parseOptions = (raw: unknown): Option[] => {
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

  // 把正确答案映射到 options.is_correct（当后端用“索引数组/字母串”返回时）
  const applyCorrectToOptions = (opts: Option[], correct: unknown): Option[] => {
    if (!Array.isArray(opts) || opts.length === 0) return opts
    // 支持 [0,2] / "A,C" / "1,3" / "B" 等
    let indices: number[] = []
    if (Array.isArray(correct)) {
      indices = (correct as any[]).map(n => Number(n)).filter(n => Number.isInteger(n) && n >= 0 && n < opts.length)
    } else if (typeof correct === 'string') {
      const parts = correct
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
      // 如果是字母 A/B/C... -> 转为索引
      const tryLetters = parts.every(p => /^[A-Za-z]$/.test(p))
      if (tryLetters) {
        indices = parts
          .map(p => p.toUpperCase().charCodeAt(0) - 65)
          .filter(n => Number.isInteger(n) && n >= 0 && n < opts.length)
      } else {
        // 尝试按数字索引
        indices = parts.map(p => Number(p)).filter(n => Number.isInteger(n) && n >= 0 && n < opts.length)
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
      // 兼容 d.question 或直接返回题目对象
      const q = d && typeof d === 'object' && (d as any).question ? (d as any).question : d

      if (!q || typeof q !== 'object') return

      setContent(q.content || '')
      setType(q.question_type || 'single_choice')
      setExplanation(q.explanation || '')
      setKnowledgePoints(Array.isArray(q.knowledge_points) ? q.knowledge_points : [])

      // 处理选项
      let opts = parseOptions(q.options)
      // 某些后端 correct_answer 不是和 options 同步的，这里做一次同步
      if (opts.length) {
        const ca = q.correct_answer
        if (ca != null) {
          opts = applyCorrectToOptions(opts, typeof ca === 'string' ? ca : Array.isArray(ca) ? ca : undefined)
        }
        setOptions(opts)
      } else {
        // 没有选项也不报错
        setOptions([])
      }

      // 处理答案
      if (q.question_type === 'true_false') {
        // 可能是 'true'/'false' 或 [0]/[1]
        if (typeof q.correct_answer === 'string') {
          const v = q.correct_answer.toLowerCase()
          setAnswer(v === 'true' ? 'true' : 'false')
        } else if (Array.isArray(q.correct_answer)) {
          setAnswer(q.correct_answer[0] === 0 ? 'true' : 'false')
        } else {
          setAnswer('')
        }
      } else if (q.question_type === 'short_answer') {
        setAnswer(q.answer || '')
      } else {
        // 选择题不直接写 answer，保持空
        setAnswer('')
      }
    } catch (error: any) {
      console.error('获取题目详情错误:', error)
      message.error(error?.message || '获取题目详情失败')
    } finally {
      setInitialLoading(false)
    }
  }

  const handleOptionChange = (index: number, field: keyof Option, value: string | boolean) => {
    const newOptions = [...options]
    newOptions[index] = { ...newOptions[index], [field]: value }

    // 单选题确保只有一个正确
    if (type === 'single_choice' && field === 'is_correct' && value === true) {
      newOptions.forEach((option, i) => {
        if (i !== index) newOptions[i] = { ...option, is_correct: false }
      })
    }

    setOptions(newOptions)
  }

  const addOption = () => {
    setOptions([...options, { content: '', is_correct: false }])
  }

  const removeOption = (index: number) => {
    if (options.length <= 2) {
      message.error('至少需要两个选项')
      return
    }
    const newOptions = [...options]
    newOptions.splice(index, 1)
    setOptions(newOptions)
  }

  const addKnowledgePoint = () => {
    if (!knowledgePointInput.trim()) return
    if (knowledgePoints.includes(knowledgePointInput.trim())) {
      message.error('知识点已存在')
      return
    }
    setKnowledgePoints([...knowledgePoints, knowledgePointInput.trim()])
    setKnowledgePointInput('')
  }

  const removeKnowledgePoint = (index: number) => {
    const newPoints = [...knowledgePoints]
    newPoints.splice(index, 1)
    setKnowledgePoints(newPoints)
  }

  // 表单提交处理
  const handleSubmit = async () => {
    if (!content.trim()) return message.error('请输入题目内容')

    // 选择题验证
    if (type === 'single_choice' || type === 'multiple_choice') {
      const hasEmptyOption = options.some(option => !option.content.trim())
      if (hasEmptyOption) return message.error('选项内容不能为空')

      const hasCorrectOption = options.some(option => option.is_correct)
      if (!hasCorrectOption) return message.error('请至少选择一个正确选项')
    }

    // 判断题验证
    if (type === 'true_false' && !answer) return message.error('请选择正确答案')

    // 简答题验证
    if (type === 'short_answer' && !answer.trim()) return message.error('请输入参考答案')

    try {
      setLoading(true)

      // 准备提交数据（这里保持与你后端的字段一致）
      const questionData: any = {
        content,
        question_type: type,
        knowledge_points: knowledgePoints,
        explanation,
        exam_id: 1, // 示例：默认考试 ID
        score: 10, // 示例：默认分值
      }

      if (type === 'single_choice' || type === 'multiple_choice') {
        // 后端若接受数组就直接传；若要求字符串可改：JSON.stringify(options)
        questionData.options = options
        // 正确答案用“索引数组”，与详情读取逻辑匹配
        const correctIdx = options
          .map((opt, idx) => (opt.is_correct ? idx : null))
          .filter((v): v is number => v !== null)
        questionData.correct_answer = correctIdx
      } else if (type === 'true_false') {
        questionData.options = [{ content: '正确' }, { content: '错误' }]
        questionData.correct_answer = [answer === 'true' ? 0 : 1]
      } else if (type === 'short_answer') {
        questionData.options = []
        questionData.correct_answer = answer
        questionData.answer = answer
      }

      if (isEditMode && id) {
        const res: ApiResult<any> = await questionsApi.update(id, questionData)
        if (!isSuccess(res)) return message.error(getMsg(res, '题目更新失败'))
        message.success('题目更新成功')
      } else {
        const res: ApiResult<any> = await questionsApi.create(questionData)
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

  // 获取页面标题/描述
  const getPageTitle = () => (isViewMode ? '查看题目' : isEditMode ? '编辑题目' : '创建新题目')
  const getPageDescription = () =>
    isViewMode ? '查看题目详细信息' : isEditMode ? '修改现有题目信息' : '添加新的考试题目到题库'

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
              {getPageTitle()}
            </Title>
            <Paragraph type="secondary" style={{ margin: '8px 0 0 0' }}>
              {getPageDescription()}
            </Paragraph>
          </Col>
          <Col>
            <Button onClick={() => navigate('/admin/questions')} icon={<ArrowLeft style={{ width: 16, height: 16 }} />}>
              返回题目列表
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 创建表单 */}
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
