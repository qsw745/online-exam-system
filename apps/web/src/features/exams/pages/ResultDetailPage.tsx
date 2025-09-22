import { useParams, useNavigate } from 'react-router-dom'
import { Spin, Empty } from 'antd'
import { useResultDetail } from '../hooks/useResultDetail'
import ResultDetailView from '../components/ResultDetailView'

export default function ResultDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { loading, data } = useResultDetail(id)

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <Spin size="large" tip="加载详情..." />
      </div>
    )
  }

  if (!data) {
    return <Empty description="未找到该考试结果" />
  }

  return <ResultDetailView data={data} onBack={() => navigate('/exam/results')} />
}
