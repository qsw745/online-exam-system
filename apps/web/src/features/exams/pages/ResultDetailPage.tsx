import { useParams, useNavigate } from 'react-router-dom'
import { Spin, Empty, Alert, Button, Space } from 'antd'
import { useResultDetail } from '../hooks/useResultDetail'
import ResultDetailView from '../components/ResultDetailView'
import { translate } from '@/shared/utils/i18n'

export default function ResultDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { loading, data, error, refetch } = useResultDetail(id)

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <Spin size="large" aria-label={translate('visible.045f900a1b')} />
      </div>
    )
  }

  if (error) {
    return <Alert type="error" showIcon message="成绩暂时无法显示" description={error}
      action={<Space wrap>
        <Button onClick={() => void refetch()}>{translate('app.retry')}</Button>
        <Button onClick={() => navigate('/results')}>{translate('papers.back_to_list')}</Button>
      </Space>} />
  }

  if (!data) {
    return <Empty description={translate('auto.602c040cc7')} />
  }

  return (
    <ResultDetailView
      key={data.id}
      data={data}
      onBack={() => navigate('/results')}
      onOpenReview={caseId => navigate(`/proctoring/reviews/${caseId}`)}
    />
  )
}
