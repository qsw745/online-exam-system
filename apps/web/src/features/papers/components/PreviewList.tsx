// features/smart-paper/components/PreviewList.tsx
import { Card } from 'antd'
import type { Question } from '../../../shared/api/endpoints/smartPaper'

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
            <span className="text-gray-500">考试时长:</span>
            <span className="ml-2 font-medium">{duration}分钟</span>
          </div>
          <div>
            <span className="text-gray-500">题目总数:</span>
            <span className="ml-2 font-medium">{questions.length}题</span>
          </div>
          <div>
            <span className="text-gray-500">总分:</span>
            <span className="ml-2 font-medium">{totalScore}分</span>
          </div>
          <div>
            <span className="text-gray-500">平均分值:</span>
            <span className="ml-2 font-medium">{(totalScore / Math.max(1, questions.length)).toFixed(1)}分/题</span>
          </div>
        </div>
      </Card>

      <Card title="题目列表" extra={`共 ${questions.length} 道题目`} className="mb-6">
        <div className="space-y-4">
          {questions.map((q, i) => (
            <div key={q.id} className="p-4 rounded-lg border border-gray-200">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium">第{i + 1}题</span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">{q.question_type}</span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">{q.difficulty}</span>
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">{q.score}分</span>
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
