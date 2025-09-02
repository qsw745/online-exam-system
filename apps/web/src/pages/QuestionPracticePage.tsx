import { Button, Card, Checkbox, Input, message, Radio, Space, Spin, Tag, Typography } from 'antd'
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Heart,
  HeartOff,
  SkipForward,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import {
  favorites as favoritesApi,
  isSuccess,
  questions as questionsApi,
  wrongQuestions,
  type ApiResult,
} from '../lib/api'

const { TextArea } = Input
const { Title, Text } = Typography

interface Question {
  id: string
  content: string
  question_type: string
  options?: Array<{ content: string; is_correct: boolean }>
  correct_answer?: number[] | string
  answer?: string
  explanation?: string
  difficulty?: string
  knowledge_points?: string[]
}

export default function QuestionPracticePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useLanguage()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [question, setQuestion] = useState<Question | null>(null)
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([])
  const [textAnswer, setTextAnswer] = useState('')
  const [showExplanation, setShowExplanation] = useState(false)
  const [isAnswered, setIsAnswered] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [isFavorited, setIsFavorited] = useState(false)

  // 连续刷题
  const [questionList, setQuestionList] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [practiceMode, setPracticeMode] = useState<'single' | 'continuous'>('single')
  const [practiceFilters, setPracticeFilters] = useState<{ type?: string; difficulty?: string; search?: string }>({})
  const [filterKey, setFilterKey] = useState('')

  // 去重 / 竞态控制
  const fetchingRef = useRef<string | null>(null)
  const latestReqRef = useRef(0)

  // A. query 改变 => 初始化连续模式题单（只导航，不直接拉题）
  useEffect(() => {
    const sp = new URLSearchParams(location.search)
    const mode = sp.get('mode') || 'continuous'
    const fKey = `${mode}|${sp.get('type') || ''}|${sp.get('difficulty') || ''}|${sp.get('search') || ''}`

    if (mode === 'continuous' && fKey !== filterKey) {
      setPracticeMode('continuous')
      setPracticeFilters({
        type: sp.get('type') || undefined,
        difficulty: sp.get('difficulty') || undefined,
        search: sp.get('search') || undefined,
      })
      setFilterKey(fKey)
      initializeContinuousPractice({
        type: sp.get('type'),
        difficulty: sp.get('difficulty'),
        search: sp.get('search'),
      })
    } else if (mode !== 'continuous') {
      setPracticeMode('single')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search])

  // B. id 改变 => 真正加载题目（带去重）
  useEffect(() => {
    if (!id) return
    if (fetchingRef.current === id) return
    fetchingRef.current = id
    ;(async () => {
      try {
        await loadQuestion(id)
        const idx = questionList.indexOf(id)
        if (idx >= 0) setCurrentIndex(idx)
      } finally {
        fetchingRef.current = null
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // 仅构建题单并导航到第一题
  const initializeContinuousPractice = async (filters: {
    type?: string | null
    difficulty?: string | null
    search?: string | null
  }) => {
    try {
      setLoading(true)

      // 已练习题目ID
      let practicedIds: number[] = []
      try {
        const practicedResponse = await wrongQuestions.getPracticedQuestions()
        if (isSuccess<any>(practicedResponse)) {
          const d = practicedResponse.data as any
          practicedIds = Array.isArray(d) ? d : d?.ids ?? []
        }
      } catch {
        /* ignore */
      }

      const params: any = { limit: 100, page: 1 }
      if (filters.type) params.type = filters.type
      if (filters.difficulty) params.difficulty = filters.difficulty
      if (filters.search) params.search = filters.search

      const response = await questionsApi.list(params)
      if (!isSuccess(response)) {
        message.error('获取题目失败')
        navigate('/questions/all')
        return
      }
      const d = response.data as any
      const all = Array.isArray(d) ? d : d?.questions ?? []

      const unpracticed = all.filter((q: any) => !practicedIds.includes(parseInt(q.id)))
      const pool = (unpracticed.length ? unpracticed : all).map((q: any) => q.id.toString())
      const shuffled = [...pool].sort(() => Math.random() - 0.5)
      setQuestionList(shuffled)

      const firstId = id && shuffled.includes(id) ? id : shuffled[0]
      if (!firstId) {
        message.info('没有符合条件的题目')
        navigate('/questions/all')
        return
      }

      const qs = new URLSearchParams()
      qs.set('mode', 'continuous')
      if (filters.type) qs.set('type', String(filters.type))
      if (filters.difficulty) qs.set('difficulty', String(filters.difficulty))
      if (filters.search) qs.set('search', String(filters.search))
      navigate(`/questions/${firstId}/practice?${qs.toString()}`, { replace: true })
    } catch (error) {
      console.error('初始化连续练习失败:', error)
      message.error('初始化练习失败')
      navigate('/questions/all')
    } finally {
      setLoading(false)
    }
  }

  // 拉题（带竞态保护）
  const loadQuestion = async (questionId: string) => {
    const reqNo = ++latestReqRef.current
    try {
      if (!questionId || questionId === 'undefined' || questionId === 'null') {
        throw new Error('无效的题目ID')
      }
      setLoading(true)

      const response: ApiResult<any> = await questionsApi.getById(questionId)
      if (!isSuccess(response)) throw new Error((response as any).error || '加载题目失败')
      if (reqNo !== latestReqRef.current) return

      const r = response.data as any
      const questionData: Question = r && r.question ? r.question : r
      setQuestion(questionData)

      resetQuestion()

      // 收藏状态（统一走 /favorites）
      try {
        const favResponse = await favoritesApi.list()
        const list: any[] = favResponse.data?.favorites ?? []
        setIsFavorited(list.some((f: any) => String(f.question_id) === String(questionData.id)))
      } catch {
        /* ignore */
      }
    } catch (error: any) {
      console.error('加载题目失败:', error)
      message.error(error?.response?.status === 404 ? '题目不存在或已被删除' : '加载题目失败')
      if (practiceMode === 'continuous') {
        if (questionList.length > 1 && currentIndex < questionList.length - 1) {
          goToNextQuestion()
        } else {
          navigate('/questions/all')
        }
      } else {
        navigate('/questions/all')
      }
    } finally {
      if (reqNo === latestReqRef.current) setLoading(false)
    }
  }

  const handleAnswerChange = (optionIndex: number) => {
    if (isAnswered) return
    if (question?.question_type === 'single_choice' || question?.question_type === 'true_false') {
      setSelectedAnswers([optionIndex])
    } else if (question?.question_type === 'multiple_choice') {
      setSelectedAnswers(prev =>
        prev.includes(optionIndex) ? prev.filter(i => i !== optionIndex) : [...prev, optionIndex]
      )
    }
  }

  const handleSubmitAnswer = () => {
    if (!question) return

    let correct = false
    if (question.question_type === 'single_choice' || question.question_type === 'multiple_choice') {
      const correctAnswers =
        question.options?.map((opt, idx) => (opt.is_correct ? idx : -1)).filter(idx => idx !== -1) || []
      correct =
        selectedAnswers.length === correctAnswers.length && selectedAnswers.every(a => correctAnswers.includes(a))
    } else if (question.question_type === 'true_false') {
      const correctAnswerStr = question.correct_answer as string
      const correctIndex = correctAnswerStr === 'true' ? 0 : 1
      correct = selectedAnswers[0] === correctIndex
    } else if (question.question_type === 'short_answer') {
      correct = true
    }

    setIsCorrect(correct)
    setIsAnswered(true)
    setShowExplanation(true)
    recordAnswer(correct)
  }

  const recordAnswer = async (correct: boolean) => {
    try {
      await wrongQuestions.recordPractice({
        question_id: parseInt(question?.id || '0', 10),
        is_correct: correct,
        answer: question?.question_type === 'short_answer' ? textAnswer : selectedAnswers,
      })
    } catch {
      /* ignore */
    }
  }

  // 统一走 favoritesApi
  const toggleFavorite = async () => {
    if (!question) return
    try {
      if (isFavorited) {
        const r = await favoritesApi.remove(question.id)
        if (!isSuccess(r)) throw new Error(r.error)
        setIsFavorited(false)
        message.success('已取消收藏')
      } else {
        const r = await favoritesApi.add(question.id)
        if (!isSuccess(r)) throw new Error(r.error)
        setIsFavorited(true)
        message.success('已添加到收藏')
      }
    } catch (e) {
      console.error(e)
      message.error('操作失败')
    }
  }

  const resetQuestion = () => {
    setSelectedAnswers([])
    setTextAnswer('')
    setIsAnswered(false)
    setIsCorrect(false)
    setShowExplanation(false)
  }

  // 只导航，让 useEffect([id]) 去加载
  const goToNextQuestion = () => {
    if (practiceMode === 'continuous' && questionList.length > 0) {
      const nextIndex = currentIndex + 1
      if (nextIndex < questionList.length) {
        setCurrentIndex(nextIndex)
        const nextId = questionList[nextIndex]
        const params = new URLSearchParams()
        params.set('mode', 'continuous')
        if (practiceFilters.type) params.set('type', practiceFilters.type)
        if (practiceFilters.difficulty) params.set('difficulty', practiceFilters.difficulty)
        if (practiceFilters.search) params.set('search', practiceFilters.search)
        navigate(`/questions/${nextId}/practice?${params.toString()}`, { replace: true })
      } else {
        message.success('恭喜！您已完成所有题目练习')
        navigate('/questions/all')
      }
    }
  }

  const goToPreviousQuestion = () => {
    if (practiceMode === 'continuous' && questionList.length > 0) {
      const prevIndex = currentIndex - 1
      if (prevIndex >= 0) {
        setCurrentIndex(prevIndex)
        const prevId = questionList[prevIndex]
        const params = new URLSearchParams()
        params.set('mode', 'continuous')
        if (practiceFilters.type) params.set('type', practiceFilters.type)
        if (practiceFilters.difficulty) params.set('difficulty', practiceFilters.difficulty)
        if (practiceFilters.search) params.set('search', practiceFilters.search)
        navigate(`/questions/${prevId}/practice?${params.toString()}`, { replace: true })
      }
    }
  }

  const skipCurrentQuestion = () => {
    if (practiceMode === 'continuous') goToNextQuestion()
  }

  const getQuestionTypeLabel = (type: string) =>
    (({ single_choice: '单选题', multiple_choice: '多选题', true_false: '判断题', short_answer: '简答题' } as any)[
      type
    ] || type)

  const getDifficultyLabel = (difficulty: string) =>
    (({ easy: '简单', medium: '中等', hard: '困难' } as any)[difficulty] || difficulty)

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Spin size="large" tip={t('questions.loading')}>
          <div style={{ minHeight: '200px', minWidth: '200px' }} />
        </Spin>
      </div>
    )
  }

  if (!question) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: 20,
        }}
      >
        <Space direction="vertical" align="center" size="large">
          <AlertTriangle style={{ width: 64, height: 64, color: '#ff4d4f' }} />
          <Title level={2}>题目不存在</Title>
          <Text type="secondary">请检查题目ID是否正确</Text>
          <Button type="primary" onClick={() => navigate('/questions/all')}>
            返回题库
          </Button>
        </Space>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Button icon={<ArrowLeft style={{ width: 16, height: 16 }} />} onClick={() => navigate('/questions/all')}>
              返回题库
            </Button>
            {practiceMode === 'continuous' && questionList.length > 0 && (
              <Tag color="blue">
                进度: {currentIndex + 1} / {questionList.length}
              </Tag>
            )}
          </Space>

          <Space>
            {practiceMode === 'continuous' && (
              <Space>
                <Button
                  icon={<ChevronLeft style={{ width: 16, height: 16 }} />}
                  onClick={goToPreviousQuestion}
                  disabled={currentIndex === 0}
                >
                  上一题
                </Button>
                <Button
                  icon={<SkipForward style={{ width: 16, height: 16 }} />}
                  onClick={skipCurrentQuestion}
                  style={{ color: '#fa8c16', borderColor: '#fa8c16' }}
                >
                  跳过
                </Button>
                <Button type="primary" onClick={goToNextQuestion} disabled={currentIndex === questionList.length - 1}>
                  下一题 <ChevronRight style={{ width: 16, height: 16 }} />
                </Button>
              </Space>
            )}

            <Button
              icon={
                isFavorited ? (
                  <Heart style={{ width: 16, height: 16 }} />
                ) : (
                  <HeartOff style={{ width: 16, height: 16 }} />
                )
              }
              onClick={toggleFavorite}
              danger={isFavorited}
              type={isFavorited ? 'primary' : 'default'}
            >
              {isFavorited ? '已收藏' : '收藏'}
            </Button>

            <Button
              icon={
                showExplanation ? (
                  <EyeOff style={{ width: 16, height: 16 }} />
                ) : (
                  <Eye style={{ width: 16, height: 16 }} />
                )
              }
              onClick={() => setShowExplanation(!showExplanation)}
              type="primary"
              ghost
            >
              {showExplanation ? '隐藏解析' : '查看解析'}
            </Button>
          </Space>
        </div>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Space>
              <Tag color="blue">{getQuestionTypeLabel(question.question_type)}</Tag>
              {question.difficulty && (
                <Tag
                  color={question.difficulty === 'easy' ? 'green' : question.difficulty === 'medium' ? 'orange' : 'red'}
                >
                  {getDifficultyLabel(question.difficulty)}
                </Tag>
              )}
            </Space>
            {isAnswered && (
              <Tag color={isCorrect ? 'success' : 'error'} icon={<CheckCircle style={{ width: 16, height: 16 }} />}>
                {isCorrect ? '回答正确' : '回答错误'}
              </Tag>
            )}
          </div>

          <div style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.6 }}>{question.content}</Text>
          </div>

          {(question.question_type === 'single_choice' || question.question_type === 'multiple_choice') &&
            question.options && (
              <div style={{ marginBottom: 24 }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  {question.options.map((option, index) => {
                    const isSelected = selectedAnswers.includes(index)
                    const isCorrectOption = option.is_correct
                    const showCorrect = isAnswered && isCorrectOption
                    const showWrong = isAnswered && isSelected && !isCorrectOption
                    const OptionComponent = question.question_type === 'single_choice' ? Radio : Checkbox
                    return (
                      <Card
                        key={index}
                        size="small"
                        style={{
                          backgroundColor: showCorrect
                            ? '#f6ffed'
                            : showWrong
                            ? '#fff2f0'
                            : isSelected
                            ? '#f0f5ff'
                            : '#fafafa',
                          borderColor: showCorrect
                            ? '#b7eb8f'
                            : showWrong
                            ? '#ffccc7'
                            : isSelected
                            ? '#91caff'
                            : '#d9d9d9',
                          cursor: isAnswered ? 'default' : 'pointer',
                        }}
                        onClick={() => !isAnswered && handleAnswerChange(index)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                            <OptionComponent
                              checked={isSelected}
                              onChange={() => handleAnswerChange(index)}
                              disabled={isAnswered}
                              style={{ marginRight: 12 }}
                            />
                            <Text>{option.content}</Text>
                          </div>
                          {showCorrect && <CheckCircle style={{ width: 20, height: 20, color: '#52c41a' }} />}
                          {showWrong && <AlertTriangle style={{ width: 20, height: 20, color: '#ff4d4f' }} />}
                        </div>
                      </Card>
                    )
                  })}
                </Space>
              </div>
            )}

          {question.question_type === 'true_false' && (
            <div style={{ marginBottom: 24 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {['正确', '错误'].map((option, index) => {
                  const isSelected = selectedAnswers.includes(index)
                  const correctAnswerStr = question.correct_answer as string
                  const correctIndex = correctAnswerStr === 'true' ? 0 : 1
                  const isCorrectOption = correctIndex === index
                  const showCorrect = isAnswered && isCorrectOption
                  const showWrong = isAnswered && isSelected && !isCorrectOption
                  return (
                    <Card
                      key={index}
                      size="small"
                      style={{
                        backgroundColor: showCorrect
                          ? '#f6ffed'
                          : showWrong
                          ? '#fff2f0'
                          : isSelected
                          ? '#f0f5ff'
                          : '#fafafa',
                        borderColor: showCorrect
                          ? '#b7eb8f'
                          : showWrong
                          ? '#ffccc7'
                          : isSelected
                          ? '#91caff'
                          : '#d9d9d9',
                        cursor: isAnswered ? 'default' : 'pointer',
                      }}
                      onClick={() => !isAnswered && handleAnswerChange(index)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                          <Radio
                            checked={isSelected}
                            onChange={() => handleAnswerChange(index)}
                            disabled={isAnswered}
                            style={{ marginRight: 12 }}
                          />
                          <Text>{option}</Text>
                        </div>
                        {showCorrect && <CheckCircle style={{ width: 20, height: 20, color: '#52c41a' }} />}
                        {showWrong && <AlertTriangle style={{ width: 20, height: 20, color: '#ff4d4f' }} />}
                      </div>
                    </Card>
                  )
                })}
              </Space>
            </div>
          )}

          {question.question_type === 'short_answer' && (
            <div style={{ marginBottom: 24 }}>
              <TextArea
                value={textAnswer}
                onChange={e => setTextAnswer(e.target.value)}
                placeholder="请输入您的答案..."
                disabled={isAnswered}
                rows={6}
                style={{ width: '100%' }}
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              {!isAnswered ? (
                <Button
                  type="primary"
                  size="large"
                  icon={<CheckCircle style={{ width: 16, height: 16 }} />}
                  onClick={handleSubmitAnswer}
                  disabled={
                    ((question.question_type === 'single_choice' ||
                      question.question_type === 'multiple_choice' ||
                      question.question_type === 'true_false') &&
                      selectedAnswers.length === 0) ||
                    (question.question_type === 'short_answer' && textAnswer.trim() === '')
                  }
                >
                  提交答案
                </Button>
              ) : (
                <Space>
                  {practiceMode === 'single' && (
                    <Button icon={<BookOpen style={{ width: 16, height: 16 }} />} onClick={resetQuestion}>
                      重新练习
                    </Button>
                  )}
                  {practiceMode === 'continuous' && (
                    <>
                      <Button icon={<BookOpen style={{ width: 16, height: 16 }} />} onClick={resetQuestion}>
                        重新练习
                      </Button>
                      <Button
                        type="primary"
                        size="large"
                        onClick={goToNextQuestion}
                        disabled={currentIndex === questionList.length - 1}
                      >
                        {currentIndex === questionList.length - 1 ? '已完成所有题目' : '下一题'}
                        {currentIndex < questionList.length - 1 && <ChevronRight style={{ width: 16, height: 16 }} />}
                      </Button>
                    </>
                  )}
                </Space>
              )}
            </Space>
          </div>
        </Card>

        {showExplanation && question.explanation && (
          <Card
            title={
              <Title level={4} style={{ margin: 0, color: '#1890ff' }}>
                题目解析
              </Title>
            }
            style={{ backgroundColor: '#f0f5ff', borderColor: '#91caff' }}
          >
            <Text style={{ color: '#1890ff', lineHeight: 1.6 }}>{question.explanation}</Text>
          </Card>
        )}

        {question.knowledge_points && question.knowledge_points.length > 0 && (
          <Card
            title={
              <Title level={4} style={{ margin: 0 }}>
                相关知识点
              </Title>
            }
          >
            <Space wrap>
              {question.knowledge_points.map((point, index) => (
                <Tag key={index} color="default">
                  {point}
                </Tag>
              ))}
            </Space>
          </Card>
        )}
      </Space>
    </div>
  )
}
