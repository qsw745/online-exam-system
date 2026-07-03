import { useParams, useNavigate } from 'react-router-dom'
import { Spin, Empty } from 'antd'
import { useResultDetail } from '../hooks/useResultDetail'
import ResultDetailView from '../components/ResultDetailView'
import { translate } from '@/shared/utils/i18n'

export default function ResultDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { loading, data } = useResultDetail(id)

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <Spin size="large" tip={translate('visible.045f900a1b')} />
      </div>
    )
  }

  if (!data) {
    return <Empty description={translate('auto.602c040cc7')} />
  }

  return <ResultDetailView data={data} onBack={() => navigate('/exam/results')} />
}
