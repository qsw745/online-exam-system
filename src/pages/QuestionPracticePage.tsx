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
import LoadingSpinner from '../components/LoadingSpinner'
import toast from 'react-hot-toast'

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
        toast.error('没有找到符合条件的题目')
        navigate('/questions/all')
        return
      }
      
      // 过滤掉已练习过的题目
      const unpracticedQuestions = allQuestions.filter((q: any) => 
        !practicedQuestionIds.includes(parseInt(q.id))
      )
      
      // 如果没有未练习的题目，提示用户
      if (unpracticedQuestions.length === 0) {
        toast.info('您已完成所有符合条件的题目练习！将显示所有题目供复习。')
        // 如果没有未练习的题目，使用所有题目
        const shuffledQuestions = [...allQuestions].sort(() => Math.random() - 0.5)
        const questionIds = shuffledQuestions.map((q: any) => q.id.toString())
        setQuestionList(questionIds)
      } else {
        // 随机打乱未练习的题目顺序
        const shuffledQuestions = [...unpracticedQuestions].sort(() => Math.random() - 0.5)
        const questionIds = shuffledQuestions.map((q: any) => q.id.toString())
        setQuestionList(questionIds)
        
        toast.success(`找到 ${unpracticedQuestions.length} 道未练习的题目`)
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
      toast.error('初始化练习失败')
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
        toast.error('题目不存在或已被删除')
      } else {
        toast.error('加载题目失败')
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
        toast.success('已取消收藏')
      } else {
        await api.post(`/questions/${question?.id}/favorite`)
        setIsFavorited(true)
        toast.success('已添加到收藏')
      }
    } catch (error) {
      console.error('收藏操作失败:', error)
      toast.error('操作失败')
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
        toast.success('恭喜！您已完成所有题目练习')
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
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner text="加载题目中..." />
      </div>
    )
  }

  if (!question) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">题目不存在</h2>
        <p className="text-gray-600 mb-4">请检查题目ID是否正确</p>
        <button
          onClick={() => navigate('/questions/all')}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          返回题库
        </button>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* 顶部导航栏 */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/questions/all')}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>返回题库</span>
          </button>
          
          {/* 连续练习模式的进度显示 */}
          {practiceMode === 'continuous' && questionList.length > 0 && (
            <div className="flex items-center space-x-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg">
              <BookOpen className="w-5 h-5" />
              <span>进度: {currentIndex + 1} / {questionList.length}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          {/* 连续练习模式的导航按钮 */}
          {practiceMode === 'continuous' && (
            <div className="flex items-center space-x-2">
              <button
                onClick={goToPreviousQuestion}
                disabled={currentIndex === 0}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                  currentIndex === 0
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <ChevronLeft className="w-5 h-5" />
                <span>上一题</span>
              </button>
              
              <button
                onClick={skipCurrentQuestion}
                className="flex items-center space-x-2 px-3 py-2 bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-200 transition-colors"
              >
                <SkipForward className="w-5 h-5" />
                <span>跳过</span>
              </button>
              
              <button
                onClick={goToNextQuestion}
                disabled={currentIndex === questionList.length - 1}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                  currentIndex === questionList.length - 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                }`}
              >
                <span>下一题</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
          
          <button
            onClick={toggleFavorite}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              isFavorited 
                ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {isFavorited ? <Heart className="w-5 h-5 fill-current" /> : <HeartOff className="w-5 h-5" />}
            <span>{isFavorited ? '已收藏' : '收藏'}</span>
          </button>
          
          <button
            onClick={() => setShowExplanation(!showExplanation)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
          >
            {showExplanation ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            <span>{showExplanation ? '隐藏解析' : '查看解析'}</span>
          </button>
        </div>
      </div>

      {/* 题目信息 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              {getQuestionTypeLabel(question.question_type)}
            </span>
            {question.difficulty && (
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                question.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                question.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {getDifficultyLabel(question.difficulty)}
              </span>
            )}
          </div>
          
          {isAnswered && (
            <div className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
              isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              <CheckCircle className="w-5 h-5" />
              <span>{isCorrect ? '回答正确' : '回答错误'}</span>
            </div>
          )}
        </div>
        
        <div className="prose max-w-none mb-6">
          <div className="text-lg font-medium text-gray-900 leading-relaxed">
            {question.content}
          </div>
        </div>

        {/* 选择题选项 */}
        {(question.question_type === 'single_choice' || question.question_type === 'multiple_choice') && question.options && (
          <div className="space-y-3 mb-6">
            {question.options.map((option, index) => {
              const isSelected = selectedAnswers.includes(index)
              const isCorrectOption = option.is_correct
              const showCorrect = isAnswered && isCorrectOption
              const showWrong = isAnswered && isSelected && !isCorrectOption
              
              return (
                <label
                  key={index}
                  className={`flex items-center space-x-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                    showCorrect ? 'bg-green-50 border-green-200' :
                    showWrong ? 'bg-red-50 border-red-200' :
                    isSelected ? 'bg-blue-50 border-blue-200' :
                    'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  } ${isAnswered ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <input
                    type={question.question_type === 'single_choice' ? 'radio' : 'checkbox'}
                    checked={isSelected}
                    onChange={() => handleAnswerChange(index)}
                    disabled={isAnswered}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="flex-1">{option.content}</span>
                  {showCorrect && <CheckCircle className="w-5 h-5 text-green-600" />}
                  {showWrong && <AlertTriangle className="w-5 h-5 text-red-600" />}
                </label>
              )
            })}
          </div>
        )}

        {/* 判断题选项 */}
        {question.question_type === 'true_false' && (
          <div className="space-y-3 mb-6">
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
                <label
                  key={index}
                  className={`flex items-center space-x-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                    showCorrect ? 'bg-green-50 border-green-200' :
                    showWrong ? 'bg-red-50 border-red-200' :
                    isSelected ? 'bg-blue-50 border-blue-200' :
                    'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  } ${isAnswered ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <input
                    type="radio"
                    checked={isSelected}
                    onChange={() => handleAnswerChange(index)}
                    disabled={isAnswered}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="flex-1">{option}</span>
                  {showCorrect && <CheckCircle className="w-5 h-5 text-green-600" />}
                  {showWrong && <AlertTriangle className="w-5 h-5 text-red-600" />}
                </label>
              )
            })}
          </div>
        )}

        {/* 简答题输入框 */}
        {question.question_type === 'short_answer' && (
          <div className="mb-6">
            <textarea
              value={textAnswer}
              onChange={(e) => setTextAnswer(e.target.value)}
              placeholder="请输入您的答案..."
              disabled={isAnswered}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[120px] disabled:bg-gray-50"
            />
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {!isAnswered ? (
              <button
                onClick={handleSubmitAnswer}
                disabled={(
                  (question.question_type === 'single_choice' || question.question_type === 'multiple_choice' || question.question_type === 'true_false') && selectedAnswers.length === 0
                ) || (
                  question.question_type === 'short_answer' && textAnswer.trim() === ''
                )}
                className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <CheckCircle className="w-5 h-5" />
                <span>提交答案</span>
              </button>
            ) : (
              <div className="flex items-center space-x-4">
                {practiceMode === 'single' && (
                  <button
                    onClick={resetQuestion}
                    className="flex items-center space-x-2 px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    <BookOpen className="w-5 h-5" />
                    <span>重新练习</span>
                  </button>
                )}
                
                {practiceMode === 'continuous' && (
                  <>
                    <button
                      onClick={resetQuestion}
                      className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      <BookOpen className="w-5 h-5" />
                      <span>重新练习</span>
                    </button>
                    
                    <button
                      onClick={goToNextQuestion}
                      disabled={currentIndex === questionList.length - 1}
                      className={`flex items-center space-x-2 px-6 py-2 rounded-lg transition-colors ${
                        currentIndex === questionList.length - 1
                          ? 'bg-gray-400 text-white cursor-not-allowed'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      <span>{currentIndex === questionList.length - 1 ? '已完成所有题目' : '下一题'}</span>
                      {currentIndex < questionList.length - 1 && <ChevronRight className="w-5 h-5" />}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 题目解析 */}
      {showExplanation && question.explanation && (
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
          <h3 className="text-lg font-medium text-blue-900 mb-3">题目解析</h3>
          <div className="text-blue-800 leading-relaxed">
            {question.explanation}
          </div>
        </div>
      )}

      {/* 知识点 */}
      {question.knowledge_points && question.knowledge_points.length > 0 && (
        <div className="mt-6 bg-gray-50 rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3">相关知识点</h3>
          <div className="flex flex-wrap gap-2">
            {question.knowledge_points.map((point, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-white text-gray-700 rounded-full text-sm border border-gray-300"
              >
                {point}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}