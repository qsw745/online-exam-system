import { message } from 'antd'
import { AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, Clock, Flag, Send } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import LoadingSpinner from '../components/LoadingSpinner'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { exams } from '../lib/api'
type OptionItem = string | { content: string }

interface Question {
  id: string
  content: string
  options: OptionItem[]

  correct_answer: number
  explanation: string
  type: 'single' | 'multiple' | 'true_false' | 'short_answer'
  difficulty: 'easy' | 'medium' | 'hard'
  knowledge_points: string[]
}

interface ExamPaper {
  id: string
  title: string
  description: string
  duration: number
  total_score: number
  questions: Question[]
}
type ApiFailure = { success: false; error: string }
function isFailure(r: any): r is ApiFailure {
  return r && r.success === false
}
export default function ExamPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useLanguage()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [exam, setExam] = useState<ExamPaper | null>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number[]>>({})
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(new Set())

  // 加载试卷数据
  useEffect(() => {
    const loadExam = async () => {
      try {
        const res = await exams.getById(taskId!)
        if (isFailure(res)) {
          throw new Error(res.error || '加载试卷失败')
        }
        const data = res.data as any
        setExam(data)
        // 如果你期望 data.exam.duration：
        if (data?.exam?.duration) {
          setTimeLeft(data.exam.duration * 60)
        } else {
          console.error('考试数据无效或缺少 duration 字段:', data)
          message.error('考试数据无效')
          navigate('/dashboard')
          return
        }
      } catch (error: any) {
        console.error('加载试卷失败:', error)
        message.error(t('exam.load_error'))
        navigate('/dashboard')
      } finally {
        setLoading(false)
      }
    }

    loadExam()
  }, [taskId, navigate])

  // 倒计时
  useEffect(() => {
    if (!timeLeft || loading) return

    const timer = setInterval(() => {
      setTimeLeft(time => {
        if (time <= 1) {
          clearInterval(timer)
          handleSubmit()
          return 0
        }
        return time - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [timeLeft, loading])

  const handleAnswerChange = (questionId: string, selectedOptions: number[]) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: selectedOptions,
    }))
  }

  const toggleFlagQuestion = (index: number) => {
    setFlaggedQuestions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }

  const handleSubmit = async () => {
    if (!exam || submitting) return

    setSubmitting(true)
    try {
      await exams.submit(taskId!, {
        answers,
        time_spent: exam.duration * 60 - timeLeft,
      })

      navigate(`/results/${taskId}`)
    } catch (error: any) {
      console.error('提交答案失败:', error)
      message.error(t('exam.submit_error'))
    } finally {
      setSubmitting(false)
    }
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    )
  }

  if (!exam) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">{t('exam.not_exist')}</h2>
        <p className="text-gray-600 mb-4">{t('exam.not_exist_desc')}</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
        >
          {t('app.home')}
        </button>
      </div>
    )
  }

  const currentQuestion = exam?.questions?.[currentQuestionIndex]

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 顶部导航栏 */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">{exam.title}</h1>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-primary">
            <Clock className="w-5 h-5" />
            <span className="font-medium">{formatTime(timeLeft)}</span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center space-x-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
            <span>{submitting ? t('exam.submitting') : t('exam.submit')}</span>
          </button>
        </div>
      </div>

      {/* 题目内容 */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">
            {t('exam.question')} {currentQuestionIndex + 1} {t('exam.of')} {exam.questions.length}
          </h2>
          <button
            onClick={() => toggleFlagQuestion(currentQuestionIndex)}
            className={`flex items-center space-x-2 px-3 py-1 rounded-md ${
              flaggedQuestions.has(currentQuestionIndex) ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'
            }`}
          >
            <Flag className="w-4 h-4" />
            <span>{t('exam.flag')}</span>
          </button>
        </div>

        <div className="prose max-w-none mb-6">
          <div dangerouslySetInnerHTML={{ __html: currentQuestion?.content || '' }} />
        </div>

        <div className="space-y-4">
          {currentQuestion?.type === 'true_false'
            ? // 判断题特殊处理
              ['正确', '错误'].map((option, index) => (
                <label
                  key={index}
                  className="flex items-center space-x-3 p-4 rounded-lg border cursor-pointer hover:bg-gray-50"
                >
                  <input
                    type="radio"
                    name={`question-${currentQuestion?.id}`}
                    checked={answers[currentQuestion?.id]?.includes(index) || false}
                    onChange={() => {
                      handleAnswerChange(currentQuestion.id, [index])
                    }}
                    className="w-4 h-4 text-primary"
                  />
                  <span className="flex-1">{option}</span>
                </label>
              ))
            : // 选择题处理
              currentQuestion?.options?.map((option, index) => (
                <label
                  key={index}
                  className="flex items-center space-x-3 p-4 rounded-lg border cursor-pointer hover:bg-gray-50"
                >
                  <input
                    type={currentQuestion?.type === 'single' ? 'radio' : 'checkbox'}
                    name={`question-${currentQuestion?.id}`}
                    checked={answers[currentQuestion?.id]?.includes(index) || false}
                    onChange={() => {
                      if (currentQuestion?.type === 'single') {
                        handleAnswerChange(currentQuestion.id, [index])
                      } else {
                        const currentAnswers = answers[currentQuestion?.id] || []
                        if (currentAnswers.includes(index)) {
                          handleAnswerChange(
                            currentQuestion.id,
                            currentAnswers.filter(i => i !== index)
                          )
                        } else {
                          handleAnswerChange(currentQuestion.id, [...currentAnswers, index])
                        }
                      }
                    }}
                    className="w-4 h-4 text-primary"
                  />
                  <span className="flex-1">
                    {typeof option === 'string' ? option : (option && option.content) || ''}
                  </span>
                </label>
              ))}
        </div>
      </div>

      {/* 底部导航 */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
          disabled={currentQuestionIndex === 0}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-5 h-5" />
          <span>{t('exam.previous')}</span>
        </button>

        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">
            {t('exam.answered')} {Object.keys(answers).length} / {exam.questions.length}
          </span>
          {Object.keys(answers).length === exam.questions.length && <CheckCircle className="w-5 h-5 text-green-500" />}
        </div>

        <button
          onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
          disabled={currentQuestionIndex === (exam?.questions?.length || 0) - 1}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>{t('exam.next')}</span>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
