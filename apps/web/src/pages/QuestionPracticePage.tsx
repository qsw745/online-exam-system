import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { 
  ArrowLeft, 
  CheckCircle, 
  AlertTriangle,
  BookOpen,
  Heart,
  HeartOff,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  SkipForward
} from 'lucide-react'
import { api, wrongQuestions, questions as questionsApi } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { message, Spin, Card, Button, Space, Tag, Radio, Checkbox, Input, Progress, Alert, Typography } from 'antd'
import { useLanguage } from '../contexts/LanguageContext'


const { TextArea } = Input
const { Title, Text } = Typography

interface Question {
  id: string
  content: string
  question_type: string
  options?: Array<{
    content: string
    is_correct: boolean
  }>
  correct_answer?: number[]
  answer?: string
  explanation?: string
  difficulty?: string
  knowledge_points?: string[]
}

export default function QuestionPracticePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
   const {t,language} = useLanguage()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [question, setQuestion] = useState<Question | null>(null)
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([])
  const [textAnswer, setTextAnswer] = useState('')
  const [showExplanation, setShowExplanation] = useState(false)
  const [isAnswered, setIsAnswered] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [isFavorited, setIsFavorited] = useState(false)
  
  // 连续刷题相关状态
  const [questionList, setQuestionList] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [practiceMode, setPracticeMode] = useState<'single' | 'continuous'>('single')
  const [practiceFilters, setPracticeFilters] = useState<{
    type?: string
    difficulty?: string
    search?: string
  }>({})

  // 初始化练习模式
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    const mode = searchParams.get('mode')
    const type = searchParams.get('type')
    const difficulty = searchParams.get('difficulty')
    const search = searchParams.get('search')
    
    if (mode === 'continuous') {
      setPracticeMode('continuous')
      setPracticeFilters({ type: type || undefined, difficulty: difficulty || undefined, search: search || undefined })
      initializeContinuousPractice({ type, difficulty, search })
    } else if (id) {
      setPracticeMode('single')
      loadQuestion(id)
    } else {
      // 如果没有题目ID且不是连续练习模式，默认启动连续练习
      setPracticeMode('continuous')
      setPracticeFilters({ type: type || undefined, difficulty: difficulty || undefined, search: search || undefined })
      initializeContinuousPractice({ type, difficulty, search })
    }
  }, [location.search, id])

  // 初始化连续练习模式
  const initializeContinuousPractice = async (filters: { type?: string | null, difficulty?: string | null, search?: string | null }) => {
    try {
      setLoading(true)
      
      // 获取用户已练习过的题目ID列表
      let practicedQuestionIds: number[] = []
      try {
        const practicedResponse = await wrongQuestions.getPracticedQuestions()
        practicedQuestionIds = practicedResponse.data || []
      } catch (error) {
        console.log('获取已练习题目列表失败，将显示所有题目:', error)
      }
      
      const params: any = {
        limit: 100, // 增加获取数量以确保有足够的未练习题目
        page: 1
      }
      
      if (filters.type) params.type = filters.type
      if (filters.difficulty) params.difficulty = filters.difficulty
      if (filters.search) params.search = filters.search
      
      const response = await questionsApi.list(params)
      const allQuestions = response.data?.questions || []
      
      if (allQuestions.length === 0) {
        // message.error('没有找到符合条件的题目')
        navigate('/questions/all')
        return
      }
      
      // 过滤掉已练习过的题目
      const unpracticedQuestions = allQuestions.filter((q: any) => 
        !practicedQuestionIds.includes(parseInt(q.id))
      )
      
      // 如果没有未练习的题目，提示用户
      if (unpracticedQuestions.length === 0) {
        message.info('您已完成所有符合条件的题目练习！将显示所有题目供复习。')
        // 如果没有未练习的题目，使用所有题目
        const shuffledQuestions = [...allQuestions].sort(() => Math.random() - 0.5)
        const questionIds = shuffledQuestions.map((q: any) => q.id.toString())
        setQuestionList(questionIds)
      } else {
        // 随机打乱未练习的题目顺序
        const shuffledQuestions = [...unpracticedQuestions].sort(() => Math.random() - 0.5)
        const questionIds = shuffledQuestions.map((q: any) => q.id.toString())
        setQuestionList(questionIds)
        
        // message.success(`找到 ${unpracticedQuestions.length} 道未练习的题目`)
      }
      
      // 如果有指定的题目ID，找到它在列表中的位置
      if (id) {
        const questionIds = unpracticedQuestions.length > 0 
          ? unpracticedQuestions.map((q: any) => q.id.toString())
          : allQuestions.map((q: any) => q.id.toString())
        const index = questionIds.indexOf(id)
        if (index !== -1) {
          setCurrentIndex(index)
          loadQuestion(id)
        } else {
          // 如果指定的题目不在筛选结果中，从第一题开始
          setCurrentIndex(0)
          loadQuestion(questionIds[0])
        }
      } else {
        // 没有指定题目，从第一题开始
        const questionIds = unpracticedQuestions.length > 0 
          ? unpracticedQuestions.map((q: any) => q.id.toString())
          : allQuestions.map((q: any) => q.id.toString())
        setCurrentIndex(0)
        loadQuestion(questionIds[0])
      }
    } catch (error: any) {
      console.error('初始化连续练习失败:', error)
      message.error('初始化练习失败')
      navigate('/questions/all')
    }
  }

  // 加载题目数据
  const loadQuestion = async (questionId: string) => {
    try {
      // 检查题目ID是否有效
      if (!questionId || questionId === 'undefined' || questionId === 'null') {
        throw new Error('无效的题目ID')
      }
      
      setLoading(true)
      const response = await api.get(`/questions/${questionId}`)
      const questionData = response.data.question
      setQuestion(questionData)
      
      // 重置答题状态
      resetQuestion()
      
      // 检查是否已收藏
      try {
        const favResponse = await api.get('/favorites')
        const favorites = favResponse.data.favorites || []
        setIsFavorited(favorites.some((fav: any) => fav.question_id === questionData.id))
      } catch (error) {
        console.log('获取收藏状态失败:', error)
      }
    } catch (error: any) {
      console.error('加载题目失败:', error)
      
      // 根据错误类型显示不同的提示
      if (error.message === '无效的题目ID' || error.response?.status === 404) {
        message.error('题目不存在或已被删除')
      } else {
        message.error('加载题目失败')
      }
      
      // 在连续练习模式下，尝试跳到下一题或返回题库
      if (practiceMode === 'continuous') {
        if (questionList.length > 1 && currentIndex < questionList.length - 1) {
          // 尝试跳到下一题
          setTimeout(() => goToNextQuestion(), 1000)
        } else {
          // 没有更多题目，返回题库
          navigate('/questions/all')
        }
      } else {
        navigate('/questions/all')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleAnswerChange = (optionIndex: number) => {
    if (isAnswered) return
    
    if (question?.question_type === 'single_choice' || question?.question_type === 'true_false') {
      setSelectedAnswers([optionIndex])
    } else if (question?.question_type === 'multiple_choice') {
      if (selectedAnswers.includes(optionIndex)) {
        setSelectedAnswers(selectedAnswers.filter(i => i !== optionIndex))
      } else {
        setSelectedAnswers([...selectedAnswers, optionIndex])
      }
    }
  }

  const handleSubmitAnswer = () => {
    if (!question) return
    
    let correct = false
    
    if (question.question_type === 'single_choice' || question.question_type === 'multiple_choice') {
      const correctAnswers = question.options?.map((option, index) => 
        option.is_correct ? index : -1
      ).filter(index => index !== -1) || []
      
      correct = selectedAnswers.length === correctAnswers.length && 
                selectedAnswers.every(answer => correctAnswers.includes(answer))
    } else if (question.question_type === 'true_false') {
      // 数据库中存储的是字符串 "true" 或 "false"
      // 前端选择: 0=正确, 1=错误
      const correctAnswerStr = question.correct_answer as unknown as string
      const correctIndex = correctAnswerStr === 'true' ? 0 : 1
      correct = selectedAnswers[0] === correctIndex
    } else if (question.question_type === 'short_answer') {
      // 简答题暂时不自动判断正确性
      correct = true
    }
    
    setIsCorrect(correct)
    setIsAnswered(true)
    setShowExplanation(true)
    
    // 记录答题结果
    recordAnswer(correct)
  }

  const recordAnswer = async (correct: boolean) => {
    try {
      await wrongQuestions.recordPractice({
        question_id: parseInt(question?.id || '0'),
        is_correct: correct,
        answer: question?.question_type === 'short_answer' ? textAnswer : selectedAnswers
      })
    } catch (error) {
      console.error('记录答题结果失败:', error)
    }
  }

  const toggleFavorite = async () => {
    try {
      if (isFavorited) {
        await api.delete(`/questions/${question?.id}/favorite`)
        setIsFavorited(false)
        message.success('已取消收藏')
      } else {
        await api.post(`/questions/${question?.id}/favorite`)
        setIsFavorited(true)
        message.success('已添加到收藏')
      }
    } catch (error) {
      console.error('收藏操作失败:', error)
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

  // 导航到下一题
  const goToNextQuestion = () => {
    if (practiceMode === 'continuous' && questionList.length > 0) {
      const nextIndex = currentIndex + 1
      if (nextIndex < questionList.length) {
        setCurrentIndex(nextIndex)
        const nextQuestionId = questionList[nextIndex]
        
        // 构建URL参数，过滤掉undefined值
        const params = new URLSearchParams()
        params.set('mode', 'continuous')
        if (practiceFilters.type) params.set('type', practiceFilters.type)
        if (practiceFilters.difficulty) params.set('difficulty', practiceFilters.difficulty)
        if (practiceFilters.search) params.set('search', practiceFilters.search)
        
        // 导航到下一题
        
        navigate(`/questions/${nextQuestionId}/practice?${params.toString()}`, { replace: true })
        loadQuestion(nextQuestionId)
      } else {
        message.success('恭喜！您已完成所有题目练习')
        navigate('/questions/all')
      }
    }
  }

  // 导航到上一题
  const goToPreviousQuestion = () => {
    if (practiceMode === 'continuous' && questionList.length > 0) {
      const prevIndex = currentIndex - 1
      if (prevIndex >= 0) {
        setCurrentIndex(prevIndex)
        const prevQuestionId = questionList[prevIndex]
        
        // 构建URL参数，过滤掉undefined值
        const params = new URLSearchParams()
        params.set('mode', 'continuous')
        if (practiceFilters.type) params.set('type', practiceFilters.type)
        if (practiceFilters.difficulty) params.set('difficulty', practiceFilters.difficulty)
        if (practiceFilters.search) params.set('search', practiceFilters.search)
        
        navigate(`/questions/${prevQuestionId}/practice?${params.toString()}`, { replace: true })
        loadQuestion(prevQuestionId)
      }
    }
  }

  // 跳过当前题目
  const skipCurrentQuestion = () => {
    if (practiceMode === 'continuous') {
      goToNextQuestion()
    }
  }

  const getQuestionTypeLabel = (type: string) => {
    const typeMap = {
      'single_choice': '单选题',
      'multiple_choice': '多选题',
      'true_false': '判断题',
      'short_answer': '简答题'
    }
    return typeMap[type as keyof typeof typeMap] || type
  }

  const getDifficultyLabel = (difficulty: string) => {
    const difficultyMap = {
      'easy': '简单',
      'medium': '中等',
      'hard': '困难'
    }
    return difficultyMap[difficulty as keyof typeof difficultyMap] || difficulty
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Spin size="large" tip={t('questions.loading')}>
          <div style={{ minHeight: '200px',minWidth:"200px" }} />
        </Spin>
      </div>
    )
  }

  if (!question) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
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
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
      {/* 顶部导航栏 */}
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Button
              icon={<ArrowLeft style={{ width: 16, height: 16 }} />}
              onClick={() => navigate('/questions/all')}
            >
              返回题库
            </Button>
            
            {/* 连续练习模式的进度显示 */}
            {practiceMode === 'continuous' && questionList.length > 0 && (
              <Tag color="blue" icon={<BookOpen style={{ width: 16, height: 16 }} />}>
                进度: {currentIndex + 1} / {questionList.length}
              </Tag>
            )}
          </Space>
          
          <Space>
            {/* 连续练习模式的导航按钮 */}
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
                
                <Button
                  type="primary"
                  onClick={goToNextQuestion}
                  disabled={currentIndex === questionList.length - 1}
                >
                  下一题
                  <ChevronRight style={{ width: 16, height: 16 }} />
                </Button>
              </Space>
            )}
            
            <Button
              icon={isFavorited ? <Heart style={{ width: 16, height: 16 }} /> : <HeartOff style={{ width: 16, height: 16 }} />}
              onClick={toggleFavorite}
              danger={isFavorited}
              type={isFavorited ? 'primary' : 'default'}
            >
              {isFavorited ? '已收藏' : '收藏'}
            </Button>
            
            <Button
              icon={showExplanation ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
              onClick={() => setShowExplanation(!showExplanation)}
              type="primary"
              ghost
            >
              {showExplanation ? '隐藏解析' : '查看解析'}
            </Button>
          </Space>
        </div>

        {/* 题目信息 */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Space>
              <Tag color="blue">
                {getQuestionTypeLabel(question.question_type)}
              </Tag>
              {question.difficulty && (
                <Tag color={
                  question.difficulty === 'easy' ? 'green' :
                  question.difficulty === 'medium' ? 'orange' : 'red'
                }>
                  {getDifficultyLabel(question.difficulty)}
                </Tag>
              )}
            </Space>
            
            {isAnswered && (
              <Tag 
                color={isCorrect ? 'success' : 'error'}
                icon={<CheckCircle style={{ width: 16, height: 16 }} />}
              >
                {isCorrect ? '回答正确' : '回答错误'}
              </Tag>
            )}
          </div>
          
          <div style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.6 }}>
              {question.content}
            </Text>
          </div>

          {/* 选择题选项 */}
          {(question.question_type === 'single_choice' || question.question_type === 'multiple_choice') && question.options && (
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
                        backgroundColor: showCorrect ? '#f6ffed' : showWrong ? '#fff2f0' : isSelected ? '#f0f5ff' : '#fafafa',
                        borderColor: showCorrect ? '#b7eb8f' : showWrong ? '#ffccc7' : isSelected ? '#91caff' : '#d9d9d9',
                        cursor: isAnswered ? 'default' : 'pointer'
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

          {/* 判断题选项 */}
          {question.question_type === 'true_false' && (
            <div style={{ marginBottom: 24 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {['正确', '错误'].map((option, index) => {
                  const isSelected = selectedAnswers.includes(index)
                  // 数据库中存储的是字符串 "true" 或 "false"
                  // 前端选择: 0=正确, 1=错误
                  const correctAnswerStr = question.correct_answer as unknown as string
                  const correctIndex = correctAnswerStr === 'true' ? 0 : 1
                  const isCorrectOption = correctIndex === index
                  const showCorrect = isAnswered && isCorrectOption
                  const showWrong = isAnswered && isSelected && !isCorrectOption
                  
                  return (
                    <Card
                      key={index}
                      size="small"
                      style={{
                        backgroundColor: showCorrect ? '#f6ffed' : showWrong ? '#fff2f0' : isSelected ? '#f0f5ff' : '#fafafa',
                        borderColor: showCorrect ? '#b7eb8f' : showWrong ? '#ffccc7' : isSelected ? '#91caff' : '#d9d9d9',
                        cursor: isAnswered ? 'default' : 'pointer'
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

          {/* 简答题输入框 */}
          {question.question_type === 'short_answer' && (
            <div style={{ marginBottom: 24 }}>
              <TextArea
                value={textAnswer}
                onChange={(e) => setTextAnswer(e.target.value)}
                placeholder="请输入您的答案..."
                disabled={isAnswered}
                rows={6}
                style={{ width: '100%' }}
              />
            </div>
          )}

          {/* 操作按钮 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              {!isAnswered ? (
                <Button
                  type="primary"
                  size="large"
                  icon={<CheckCircle style={{ width: 16, height: 16 }} />}
                  onClick={handleSubmitAnswer}
                  disabled={(
                    (question.question_type === 'single_choice' || question.question_type === 'multiple_choice' || question.question_type === 'true_false') && selectedAnswers.length === 0
                  ) || (
                    question.question_type === 'short_answer' && textAnswer.trim() === ''
                  )}
                >
                  提交答案
                </Button>
              ) : (
                <Space>
                  {practiceMode === 'single' && (
                    <Button
                      icon={<BookOpen style={{ width: 16, height: 16 }} />}
                      onClick={resetQuestion}
                    >
                      重新练习
                    </Button>
                  )}
                  
                  {practiceMode === 'continuous' && (
                    <>
                      <Button
                        icon={<BookOpen style={{ width: 16, height: 16 }} />}
                        onClick={resetQuestion}
                      >
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

        {/* 题目解析 */}
        {showExplanation && question.explanation && (
          <Card
            title={<Title level={4} style={{ margin: 0, color: '#1890ff' }}>题目解析</Title>}
            style={{ backgroundColor: '#f0f5ff', borderColor: '#91caff' }}
          >
            <Text style={{ color: '#1890ff', lineHeight: 1.6 }}>
              {question.explanation}
            </Text>
          </Card>
        )}

        {/* 知识点 */}
        {question.knowledge_points && question.knowledge_points.length > 0 && (
          <Card title={<Title level={4} style={{ margin: 0 }}>相关知识点</Title>}>
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
