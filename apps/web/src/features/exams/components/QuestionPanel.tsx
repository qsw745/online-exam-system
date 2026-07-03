// apps/web/src/features/exams/components/QuestionPanel.tsx
import { Flag } from 'lucide-react'
import type { Question } from '@/shared/api/http'
import { sanitizeHtml } from '@/shared/utils/sanitizeHtml'
import { translate } from '@/shared/utils/i18n'

export function QuestionPanel(props: {
  question: Question
  index: number
  total: number
  flagged: boolean
  onToggleFlag: () => void
  value: number[] | undefined
  onChange: (next: number[]) => void
}) {
  const { question, index, total, flagged, onToggleFlag, value = [], onChange } = props

  // ✅ 统一题型判断
  const qType = ((question as any).type ?? (question as any).question_type ?? '') as string
  const isSingle = qType === 'single' || qType === 'single_choice'
  const isTf = qType === 'true_false' || qType === 'tf' || qType === 'judge'

  const toggle = (optIndex: number) => {
    if (isSingle || isTf) {
      onChange([optIndex])
      return
    }
    // 多选
    if (value.includes(optIndex)) onChange(value.filter(i => i !== optIndex))
    else onChange([...value, optIndex])
  }

  const tfOptions: string[] = ['正确', '错误']

  // ✅ 字段兼容：content / options
  const contentHtml: string = (question as any).content ?? (question as any).stem ?? (question as any).title ?? ''
  const safeContentHtml = sanitizeHtml(contentHtml)
  const optionList: Array<any> = isTf ? tfOptions : (question as any).options ?? (question as any).choices ?? []

  const qid = String((question as any).id ?? index)

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium">
          {translate('papers.col_question')}{index + 1} / {total}
        </h2>
        <button
          onClick={onToggleFlag}
          className={`flex items-center space-x-2 px-3 py-1 rounded-md ${
            flagged ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'
          }`}
        >
          <Flag className="w-4 h-4" />
          <span>{translate('exam.flag')}</span>
        </button>
      </div>

      <div className="prose max-w-none mb-6">
        <div dangerouslySetInnerHTML={{ __html: safeContentHtml }} />
      </div>

      <div className="space-y-4">
        {(optionList as any[]).map((opt: any, i: number) => {
          const label = typeof opt === 'string' ? opt : opt?.content || ''
          const checked = value.includes(i)
          return (
            <label
              key={i}
              className="flex items-center space-x-3 p-4 rounded-lg border cursor-pointer hover:bg-gray-50"
            >
              <input
                type={isSingle || isTf ? 'radio' : 'checkbox'}
                name={`q-${qid}`}
                checked={checked}
                onChange={() => toggle(i)}
                className="w-4 h-4 text-primary"
              />
              <span className="flex-1">{label}</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
