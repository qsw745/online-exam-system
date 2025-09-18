import LoadingSpinner from '@/shared/components/LoadingSpinner'
import { Button, Card, Form } from 'antd'
import { useNavigate } from 'react-router-dom'
import { usePaperEditor } from '@/shared/hooks/usePaperEditor'
import PaperMetaForm from '../components/PaperMetaForm'
import PaperQuestionList from '../components/PaperQuestionList'

export default function PaperCreatePage() {
  const nav = useNavigate()
  const h = usePaperEditor()

  if (h.loading) return <LoadingSpinner text="加载试卷信息..." center="page" />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{h.pageTitle}</h1>
        <p className="text-gray-500 mt-1">{h.pageDesc}</p>
      </div>

      <Form layout="vertical" onFinish={h.submit}>
        <Card title="基本信息" style={{ marginBottom: 24 }}>
          <PaperMetaForm
            disabled={h.isView}
            title={h.title}
            description={h.description}
            totalScore={h.totalScore}
            duration={h.duration}
            difficulty={h.difficulty}
            onChange={p => {
              if (p.title !== undefined) h.setTitle(p.title)
              if (p.description !== undefined) h.setDescription(p.description)
              if (p.totalScore !== undefined) h.setTotalScore(p.totalScore)
              if (p.duration !== undefined) h.setDuration(p.duration)
              if (p.difficulty !== undefined) h.setDifficulty(p.difficulty)
            }}
          />
        </Card>

        <PaperQuestionList questions={h.questions} />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16 }}>
          <Button onClick={() => nav('/admin/papers')}>{h.isView ? '返回列表' : '取消'}</Button>
          {!h.isView && (
            <Button type="primary" htmlType="submit" loading={h.submitting}>
              {h.isEdit ? '更新试卷' : '创建试卷'}
            </Button>
          )}
        </div>
      </Form>
    </div>
  )
}
