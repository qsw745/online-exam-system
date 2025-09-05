// src/features/exams/components/ExamTopBar.tsx
import { Clock, Send } from 'lucide-react'

export function ExamTopBar(props: {
  title: string
  timeLeft: number
  onSubmit: () => void | Promise<void>
  submitting?: boolean
  submitText?: string
}) {
  const { title, timeLeft, onSubmit, submitting, submitText = '提交' } = props
  const m = Math.floor(timeLeft / 60)
  const s = timeLeft % 60
  return (
    <div className="flex items-center justify-between mb-8">
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 text-primary">
          <Clock className="w-5 h-5" />
          <span className="font-medium">
            {m}:{s.toString().padStart(2, '0')}
          </span>
        </div>
        <button
          onClick={() => void onSubmit()}
          disabled={submitting}
          className="flex items-center space-x-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-5 h-5" />
          <span>{submitting ? '提交中...' : submitText}</span>
        </button>
      </div>
    </div>
  )
}
