import { AlertTriangle, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Result, Space, Typography } from 'antd'
import LoadingSpinner from '@/shared/components/LoadingSpinner'
import { useExamRunner } from '../hooks/useExamRunner'
import { ExamTopBar } from '../components/ExamTopBar'
import { QuestionPanel } from '../components/QuestionPanel'

export default function ExamPage() {
  // 路由参数与 /exam/:id 对齐
  const { id = '' } = useParams<{ id: string }>()
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
  } = useExamRunner(id)

  // 加载中
  if (loading) {
    return <LoadingSpinner center="page" text="加载中…" />
  }

  // 无试卷（UI 优化为 antd Result）
  if (!exam) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Result
          status="404"
          title="试卷不存在"
          subTitle="当前任务未找到试卷或数据无效。"
          icon={<AlertTriangle className="w-12 h-12 text-red-500" />}
          extra={
            <Button type="primary" onClick={() => navigate('/dashboard')}>
              返回首页
            </Button>
          }
        />
      </div>
    )
  }

  // 提交并跳结果
  const doSubmit = async () => {
    const ok = await submit()
    if (ok) navigate(`/results/${id}`)
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
        <Button onClick={prev} disabled={index === 0} icon={<ChevronLeft className="w-5 h-5" />}>
          上一题
        </Button>

        <Space>
          <span className="text-sm text-gray-500">
            已作答 {answeredCount} / {exam.questions.length}
          </span>
          {answeredCount === exam.questions.length && <CheckCircle className="w-5 h-5 text-green-500" />}
        </Space>

        <Button
          onClick={next}
          disabled={index === exam.questions.length - 1}
          icon={<ChevronRight className="w-5 h-5" />}
        >
          下一题
        </Button>
      </div>
    </div>
  )
}
