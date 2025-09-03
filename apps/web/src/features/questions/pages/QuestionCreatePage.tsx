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
import LoadingSpinner from '../../components/LoadingSpinner'
import { questions as questionsApi } from '../../lib/api'

const { Title, Paragraph, Text } = Typography
const { TextArea } = Input
const { Option } = Select

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
  const [type, setType] = useState('single_choice')
  const [options, setOptions] = useState<Option[]>([
    { content: '', is_correct: false },
    { content: '', is_correct: false },
    { content: '', is_correct: false },
    { content: '', is_correct: false },
  ])
  const [answer, setAnswer] = useState('')
  const [explanation, setExplanation] = useState('')
  const [knowledgePoints, setKnowledgePoints] = useState<string[]>([])
  const [knowledgePointInput, setKnowledgePointInput] = useState('')
  const [isViewMode, setIsViewMode] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)

  // 根据路由判断当前模式
  useEffect(() => {
    if (id) {
      const path = window.location.pathname
      if (path.includes('question-detail')) {
        setIsViewMode(true)
      } else if (path.includes('question-edit')) {
        setIsEditMode(true)
      }

      // 获取题目详情
      fetchQuestionDetail(id)
    }
  }, [id])

  // 获取题目详情
  const fetchQuestionDetail = async (questionId: string) => {
    try {
      setInitialLoading(true)
      const response = await questionsApi.getById(questionId)
      const question = response.data.question

      if (question) {
        setContent(question.content || '')
        setType(question.question_type || 'single_choice')
        setExplanation(question.explanation || '')
        setKnowledgePoints(question.knowledge_points || [])

        // 处理选项和答案
        if (question.options && Array.isArray(question.options)) {
          setOptions(question.options)
        }

        if (question.question_type === 'true_false') {
          // 判断题答案处理
          if (question.correct_answer && Array.isArray(question.correct_answer)) {
            setAnswer(question.correct_answer[0] === 0 ? 'true' : 'false')
          }
        } else if (question.question_type === 'short_answer') {
          // 简答题答案处理
          setAnswer(question.answer || '')
        }
      }
    } catch (error: any) {
      console.error('获取题目详情错误:', error)
      message.error(error.message || '获取题目详情失败')
    } finally {
      setInitialLoading(false)
    }
  }

  const handleOptionChange = (index: number, field: keyof Option, value: string | boolean) => {
    const newOptions = [...options]
    newOptions[index] = { ...newOptions[index], [field]: value }

    // 如果是单选题，确保只有一个选项被标记为正确
    if (type === 'single_choice' && field === 'is_correct' && value === true) {
      newOptions.forEach((option, i) => {
        if (i !== index) {
          newOptions[i] = { ...option, is_correct: false }
        }
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
    if (!content.trim()) {
      message.error('请输入题目内容')
      return
    }

    // 选择题验证
    if (type === 'single_choice' || type === 'multiple_choice') {
      // 检查是否有空选项
      const hasEmptyOption = options.some(option => !option.content.trim())
      if (hasEmptyOption) {
        message.error('选项内容不能为空')
        return
      }

      // 检查是否有正确选项
      const hasCorrectOption = options.some(option => option.is_correct)
      if (!hasCorrectOption) {
        message.error('请至少选择一个正确选项')
        return
      }
    }

    // 判断题验证
    if (type === 'true_false' && !answer) {
      message.error('请选择正确答案')
      return
    }

    // 简答题验证
    if (type === 'short_answer' && !answer.trim()) {
      message.error('请输入参考答案')
      return
    }

    try {
      setLoading(true)

      // 准备提交数据
      const questionData: any = {
        content,
        question_type: type, // 映射为后端字段名
        knowledge_points: knowledgePoints,
        explanation,
        exam_id: 1, // 默认使用ID为1的考试
        score: 10, // 默认分值
      }

      // 根据题目类型设置答案
      if (type === 'single_choice' || type === 'multiple_choice') {
        questionData.options = JSON.stringify(options)
        questionData.correct_answer = JSON.stringify(
          options.map((option, index) => (option.is_correct ? index : null)).filter(index => index !== null)
        )
      } else if (type === 'true_false') {
        questionData.options = JSON.stringify([{ content: '正确' }, { content: '错误' }])
        questionData.correct_answer = JSON.stringify([answer === 'true' ? 0 : 1])
      } else if (type === 'short_answer') {
        questionData.options = JSON.stringify([])
        questionData.correct_answer = JSON.stringify(answer)
      }

      if (isEditMode && id) {
        // 提交更新请求
        await questionsApi.update(id, questionData)
        message.success('题目更新成功')
      } else {
        // 提交创建请求
        await questionsApi.create(questionData)
        message.success('题目创建成功')
      }

      navigate('/admin/questions')
    } catch (error: any) {
      console.error(isEditMode ? '更新题目错误:' : '创建题目错误:', error)
      message.error(error.message || (isEditMode ? '更新题目失败' : '创建题目失败'))
    } finally {
      setLoading(false)
    }
  }

  // 获取页面标题
  const getPageTitle = () => {
    if (isViewMode) return '查看题目'
    if (isEditMode) return '编辑题目'
    return '创建新题目'
  }

  // 获取页面描述
  const getPageDescription = () => {
    if (isViewMode) return '查看题目详细信息'
    if (isEditMode) return '修改现有题目信息'
    return '添加新的考试题目到题库'
  }

  if (initialLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="flex justify-center items-center min-h-[300px]">
          <LoadingSpinner size={40} />
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
                <Select value={type} onChange={value => setType(value)} disabled={isViewMode}>
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
