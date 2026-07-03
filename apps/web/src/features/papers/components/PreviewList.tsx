// features/smart-paper/components/PreviewList.tsx
import { Card } from 'antd'
import type { Question } from '../../../shared/api/endpoints/smartPaper'
import { translate } from '@/shared/utils/i18n'

export default function PreviewList({
  title,
  desc,
  duration,
  totalScore,
  questions,
}: {
  title: string
  desc?: string
  duration: number
  totalScore: number
  questions: Question[]
}) {
  return (
    <>
      <Card title={title} className="mb-6">
        {desc ? <div className="mb-4 text-gray-600">{desc}</div> : null}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">{translate('auto.cc38576092')}</span>
            <span className="ml-2 font-medium">{duration}{translate('papers.addon_min')}</span>
          </div>
          <div>
            <span className="text-gray-500">{translate('auto.892076f815')}</span>
            <span className="ml-2 font-medium">{questions.length}{translate('papers.unit_question')}</span>
          </div>
          <div>
            <span className="text-gray-500">{translate('auto.47ff1a82f0')}</span>
            <span className="ml-2 font-medium">{totalScore}{translate('papers.addon_score')}</span>
          </div>
          <div>
            <span className="text-gray-500">{translate('auto.7841ca3dfc')}</span>
            <span className="ml-2 font-medium">{(totalScore / Math.max(1, questions.length)).toFixed(1)}{translate('auto.db13d7ca15')}</span>
          </div>
        </div>
      </Card>

      <Card title={translate('questions.title')} extra={`共 ${questions.length} 道题目`} className="mb-6">
        <div className="space-y-4">
          {questions.map((q, i) => (
            <div key={q.id} className="p-4 rounded-lg border border-gray-200">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium">{translate('exam.question')}{i + 1}{translate('papers.unit_question')}</span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">{q.question_type}</span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">{q.difficulty}</span>
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">{q.score}{translate('papers.addon_score')}</span>
                </div>
                <div className="text-gray-900">{q.content}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}
