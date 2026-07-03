
import LoadingSpinner from '@/shared/components/LoadingSpinner'
import { usePaperEditor } from '@/shared/hooks/usePaperEditor'
import { Button, Card, Form } from 'antd'
import { useNavigate } from 'react-router-dom'
import PaperMetaForm from '../components/PaperMetaForm'
import PaperQuestionList from '../components/PaperQuestionList'
import { translate } from '@/shared/utils/i18n'
export default function PaperCreatePage() {
  const nav = useNavigate()
  const h = usePaperEditor()

  if (h.loading) return <LoadingSpinner text={translate('visible.7bb7104223')} center="page" />

  return (
    <div className="space-y-6">
   
      <div>
        <h1 className="text-2xl font-bold">{h.pageTitle}</h1>
        <p className="text-gray-500 mt-1">{h.pageDesc}</p>
      </div>

      <Form layout="vertical" onFinish={h.submit}>
        <Card title={translate('auto.b122f813d5')} style={{ marginBottom: 24 }}>
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
          <Button onClick={() => nav('/admin/papers')}>{h.isView ? translate('papers.back_to_list') : translate('app.cancel')}</Button>
          {!h.isView && (
            <Button type="primary" htmlType="submit" loading={h.submitting}>
              {h.isEdit ? translate('visible.1e43728e91') : translate('papers.create_paper')}
            </Button>
          )}
        </div>
      </Form>
    </div>
  )
}
