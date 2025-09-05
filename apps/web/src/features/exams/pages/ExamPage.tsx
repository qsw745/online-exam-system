// src/features/exams/pages/ExamPage.tsx
import { AlertTriangle, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import LoadingSpinner from '@shared/components/LoadingSpinner'
import { useExamRunner } from '../hooks/useExamRunner'
import { ExamTopBar } from '../components/ExamTopBar'
import { QuestionPanel } from '../components/QuestionPanel'

export default function ExamPage() {
  const { taskId = '' } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const {
    loading,
    submitting,
    exam,
    index,
    current,
    answers,
    flagged,
    timeLeft,
    answeredCount,
    setAnswer,
    toggleFlag,
    next,
    prev,
    submit,
  } = useExamRunner(taskId)

  // 加载中
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    )
  }

  // 无试卷
  if (!exam) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">试卷不存在</h2>
        <p className="text-gray-600 mb-4">当前任务未找到试卷或数据无效。</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
        >
          返回首页
        </button>
      </div>
    )
  }

  // 提交并跳结果
  const doSubmit = async () => {
    const ok = await submit()
    if (ok) navigate(`/results/${taskId}`)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <ExamTopBar
        title={exam.title}
        timeLeft={timeLeft}
        onSubmit={doSubmit}
        submitting={submitting}
        submitText="提交"
      />

      {current && (
        <QuestionPanel
          question={current}
          index={index}
          total={exam.questions.length}
          flagged={flagged.has(index)}
          onToggleFlag={() => toggleFlag(index)}
          value={answers[current.id]}
          onChange={nextAns => setAnswer(current.id, nextAns)}
        />
      )}

      {/* 底部导航 */}
      <div className="flex items-center justify-between">
        <button
          onClick={prev}
          disabled={index === 0}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-5 h-5" />
          <span>上一题</span>
        </button>

        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">
            已作答 {answeredCount} / {exam.questions.length}
          </span>
          {answeredCount === exam.questions.length && <CheckCircle className="w-5 h-5 text-green-500" />}
        </div>

        <button
          onClick={next}
          disabled={index === exam.questions.length - 1}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>下一题</span>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
