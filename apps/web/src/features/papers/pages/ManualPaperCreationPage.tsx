import { api } from '@shared/api/http'
import LoadingSpinner from '@shared/components/LoadingSpinner'
import { Button, Card, Form, Input, message, Select } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const { TextArea } = Input

// ===== 统一 ApiResult 类型与守卫 =====
type ApiSuccess<T = any> = { success: true; data: T; message?: string }
type ApiFailure = { success: false; error?: string; message?: string }
type ApiResult<T = any> = ApiSuccess<T> | ApiFailure
const isSuccess = <T,>(r: any): r is ApiSuccess<T> => r && typeof r === 'object' && r.success === true
const getMsg = (r: any, fallback = '请求失败') =>
  r && typeof r === 'object' ? r.message ?? r.error ?? fallback : fallback
// ===================================

interface Question {
  id: string
  content: string
  type: string
  difficulty: string
  score: number
  knowledge_points: string[]
}

export default function ManualPaperCreationPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [questions, setQuestions] = useState<Question[]>([])
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([])
  const [paperTitle, setPaperTitle] = useState('')
  const [paperDescription, setPaperDescription] = useState('')
  const [duration, setDuration] = useState(60)
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedType, setSelectedType] = useState('all')
  const [selectedDifficulty, setSelectedDifficulty] = useState('all')

  useEffect(() => {
    loadQuestions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKeyword, selectedType, selectedDifficulty])

  const normalizeQuestions = (arr: any[]): Question[] =>
    (arr || []).map((q: any) => ({
      id: String(q.id ?? q.question_id ?? ''),
      content: q.content ?? q.title ?? '',
      type: q.type ?? q.question_type ?? 'unknown',
      difficulty: q.difficulty ?? 'medium',
      score: Number(q.score ?? 0),
      knowledge_points: Array.isArray(q.knowledge_points) ? q.knowledge_points : [],
    }))

  const loadQuestions = async () => {
    try {
      setLoading(true)
      const params: any = {
        keyword: searchKeyword || undefined,
        type: selectedType === 'all' ? undefined : selectedType,
        difficulty: selectedDifficulty === 'all' ? undefined : selectedDifficulty,
      }

      // 兼容：可能返回 ApiResult，也可能是 axios 风格 { data: ... }
      const resp: any = await api.get('/questions', { params })

      if (isSuccess<any>(resp)) {
        const d = resp.data
        if (Array.isArray(d)) {
          setQuestions(normalizeQuestions(d))
        } else if (Array.isArray(d?.items)) {
          setQuestions(normalizeQuestions(d.items))
        } else if (Array.isArray(d?.questions)) {
          setQuestions(normalizeQuestions(d.questions))
        } else {
          setQuestions(normalizeQuestions(d ?? []))
        }
        return
      }

      // axios 风格
      const ax = resp?.data
      if (Array.isArray(ax)) {
        setQuestions(normalizeQuestions(ax))
      } else if (Array.isArray(ax?.items)) {
        setQuestions(normalizeQuestions(ax.items))
      } else if (Array.isArray(ax?.questions)) {
        setQuestions(normalizeQuestions(ax.questions))
      } else if (Array.isArray(ax?.data?.items)) {
        setQuestions(normalizeQuestions(ax.data.items))
      } else if (Array.isArray(ax?.data?.questions)) {
        setQuestions(normalizeQuestions(ax.data.questions))
      } else {
        setQuestions([])
      }
    } catch (error: any) {
      console.error('加载题目失败:', error)
      message.error(error?.response?.data?.message || '加载题目失败，请重试')
      setQuestions([])
    } finally {
      setLoading(false)
    }
  }

  const handleQuestionSelect = (questionId: string) => {
    setSelectedQuestions(prev =>
      prev.includes(questionId) ? prev.filter(id => id !== questionId) : [...prev, questionId]
    )
  }

  const calculateTotalScore = () => {
    return questions.filter(q => selectedQuestions.includes(q.id)).reduce((total, q) => total + q.score, 0)
  }

  const handleCreatePaper = async () => {
    if (!paperTitle.trim()) {
      message.error('请输入试卷标题')
      return
    }

    if (selectedQuestions.length === 0) {
      message.error('请至少选择一道题目')
      return
    }

    try {
      setLoading(true)
      // 为与智能组卷保持一致，使用同一创建接口（后端通常支持携带题目明细或题目ID列表）
      const payload = {
        title: paperTitle.trim(),
        description: paperDescription.trim(),
        duration: Number(duration) || 60,
        difficulty,
        total_score: calculateTotalScore(),
        // 手动组卷用题目 ID 列表
        question_ids: selectedQuestions,
      }

      const resp: ApiResult<any> = await api.post('/papers/create-with-questions', payload)
      if (!isSuccess(resp)) {
        message.error(getMsg(resp, '创建试卷失败'))
        return
      }

      message.success('试卷创建成功')
      navigate('/admin/papers')
    } catch (error: any) {
      console.error('创建试卷失败:', error)
      message.error(error?.response?.data?.message || error?.message || '创建试卷失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' }}>手动组卷</h1>
        <p style={{ color: '#666', margin: 0 }}>从题库中选择题目创建试卷</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* 左侧题目列表 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Card title="题目列表" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* 搜索和筛选 */}
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <Input
                  placeholder="搜索题目..."
                  value={searchKeyword}
                  onChange={e => setSearchKeyword(e.target.value)}
                  style={{ flex: 1, minWidth: '200px' }}
                />
                <Select
                  value={selectedType}
                  onChange={setSelectedType}
                  placeholder="题目类型"
                  style={{ width: 180 }}
                  options={[
                    { label: '全部类型', value: 'all' },
                    { label: '单选题', value: 'single' },
                    { label: '多选题', value: 'multiple' },
                    { label: '判断题', value: 'judge' },
                  ]}
                />
                <Select
                  value={selectedDifficulty}
                  onChange={setSelectedDifficulty}
                  placeholder="难度"
                  style={{ width: 180 }}
                  options={[
                    { label: '全部难度', value: 'all' },
                    { label: '简单', value: 'easy' },
                    { label: '中等', value: 'medium' },
                    { label: '困难', value: 'hard' },
                  ]}
                />
              </div>

              {/* 题目列表 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {questions.map(question => (
                  <div
                    key={question.id}
                    style={{
                      padding: '16px',
                      border: selectedQuestions.includes(question.id) ? '1px solid #1890ff' : '1px solid #d9d9d9',
                      borderRadius: '6px',
                      backgroundColor: selectedQuestions.includes(question.id) ? '#f0f8ff' : 'white',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontWeight: 500, marginBottom: '8px' }}>{question.content}</h3>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            fontSize: '14px',
                            color: '#666',
                          }}
                        >
                          <span>类型: {question.type}</span>
                          <span>难度: {question.difficulty}</span>
                          <span>分值: {question.score}分</span>
                        </div>
                        {question.knowledge_points.length > 0 && (
                          <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {question.knowledge_points.map((point, index) => (
                              <span
                                key={index}
                                style={{
                                  padding: '2px 8px',
                                  fontSize: '12px',
                                  borderRadius: '12px',
                                  backgroundColor: '#f5f5f5',
                                  color: '#666',
                                }}
                              >
                                {point}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button
                        type={selectedQuestions.includes(question.id) ? 'primary' : 'default'}
                        danger={selectedQuestions.includes(question.id)}
                        size="small"
                        onClick={() => handleQuestionSelect(question.id)}
                      >
                        {selectedQuestions.includes(question.id) ? '移除' : '添加'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* 右侧试卷信息 */}
        <Card title="试卷信息">
          <Form layout="vertical">
            <Form.Item label="试卷标题" required>
              <Input value={paperTitle} onChange={e => setPaperTitle(e.target.value)} placeholder="输入试卷标题" />
            </Form.Item>

            <Form.Item label="试卷说明">
              <TextArea
                value={paperDescription}
                onChange={e => setPaperDescription(e.target.value)}
                placeholder="输入试卷说明"
                rows={4}
              />
            </Form.Item>

            <Form.Item label="考试时长（分钟）" required>
              <Input type="number" min={1} value={duration} onChange={e => setDuration(Number(e.target.value) || 1)} />
            </Form.Item>

            <Form.Item label="试卷难度" required>
              <Select
                value={difficulty}
                onChange={v => setDifficulty(v as 'easy' | 'medium' | 'hard')}
                placeholder="选择难度"
                style={{ width: '100%' }}
                options={[
                  { label: '简单', value: 'easy' },
                  { label: '中等', value: 'medium' },
                  { label: '困难', value: 'hard' },
                ]}
              />
            </Form.Item>

            <div style={{ paddingTop: '16px', borderTop: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '14px' }}>
                <span>已选题目数</span>
                <span style={{ fontWeight: 500 }}>{selectedQuestions.length}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '14px',
                  marginTop: '8px',
                }}
              >
                <span>总分</span>
                <span style={{ fontWeight: 500 }}>{calculateTotalScore()}分</span>
              </div>
            </div>

            <Button type="primary" block style={{ marginTop: '24px' }} onClick={handleCreatePaper} loading={loading}>
              创建试卷
            </Button>
          </Form>
        </Card>
      </div>
    </div>
  )
}
