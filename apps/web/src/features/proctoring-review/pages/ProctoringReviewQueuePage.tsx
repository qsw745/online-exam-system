import { Alert, Button, Card, Col, Empty, Pagination, Row, Select, Space, Table, Tag, Typography, message } from 'antd'
import { useMemo, useState } from 'react'
import type { ColumnsType } from 'antd/es/table'
import { proctoringReviewApi, type ReviewCaseListItem } from '@/shared/api/endpoints/proctoringReview'
import { useIsMobile } from '@/shared/hooks/useMobile'
import { translate } from '@/shared/utils/i18n'
import ProctoringReviewDecisionModal from '../components/ProctoringReviewDecisionModal'
import ProctoringReviewDetailDrawer from '../components/ProctoringReviewDetailDrawer'
import { conflictMessageKey, statusPresentation, type StaffReviewAction } from '../domain/reviewPresentation'
import { useProctoringReviewQueue, type ReviewQueueFilters } from '../hooks/useProctoringReviewQueue'

const { Title, Text } = Typography

export default function ProctoringReviewQueuePage() {
  const mobile = useIsMobile()
  const [filters, setFilters] = useState<ReviewQueueFilters>({})
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [action, setAction] = useState<StaffReviewAction | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [messageApi, contextHolder] = message.useMessage()
  const queue = useProctoringReviewQueue(filters, page, limit)

  const counts = useMemo(() => ({
    pending: queue.items.filter(item => item.status === 'pending_review').length,
    information: queue.items.filter(item => item.status === 'information_requested').length,
    appeals: queue.items.filter(item => item.status === 'appeal_pending').length,
    decided: queue.items.filter(item => item.status === 'decided' || item.status === 'appeal_resolved').length,
  }), [queue.items])

  const openDetail = async (item: ReviewCaseListItem) => {
    setDrawerOpen(true)
    try {
      await queue.loadDetail(item.caseId)
    } catch (error: any) {
      messageApi.error(error?.message || translate('proctoringReview.error.generic'))
    }
  }

  const submitDecision = async (payload: Record<string, unknown>) => {
    if (!queue.detail) return
    setSubmitting(true)
    try {
      await proctoringReviewApi.decideCase(queue.detail.caseId, payload)
      setAction(null)
      await Promise.all([queue.load(), queue.loadDetail(queue.detail.caseId)])
      messageApi.success(translate('proctoringReview.success.decision'))
    } catch (error: any) {
      setAction(null)
      if (error?.code === 'PROCTORING_REVIEW_VERSION_CONFLICT') {
        await queue.loadDetail(queue.detail.caseId)
      }
      messageApi.warning(translate(conflictMessageKey(error?.code), error?.message))
    } finally {
      setSubmitting(false)
    }
  }

  const exportCsv = async () => {
    if (!queue.detail) return
    try {
      const blob = await proctoringReviewApi.exportCaseCsv(queue.detail.caseId)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `wenheng-review-case-${queue.detail.caseId}.csv`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error: any) {
      messageApi.error(error?.message || translate('proctoringReview.error.generic'))
    }
  }

  const columns: ColumnsType<ReviewCaseListItem> = [
    { title: translate('proctoringReview.field.exam'), dataIndex: 'examTitle', ellipsis: true },
    { title: translate('proctoringReview.field.candidate'), render: (_, item) => item.candidateDisplayName || item.candidatePublicId },
    {
      title: translate('proctoringReview.field.status'),
      dataIndex: 'status',
      render: value => {
        const view = statusPresentation(String(value))
        return <Tag color={view.tone}>{translate(view.labelKey)}</Tag>
      },
    },
    { title: translate('proctoringReview.field.reason'), dataIndex: 'triggerReasonCode', ellipsis: true },
    { title: translate('proctoringReview.field.openedAt'), dataIndex: 'openedAt', width: 190 },
    { title: '', width: 90, render: (_, item) => <Button type="link" onClick={() => void openDetail(item)}>{translate('proctoringReview.view')}</Button> },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%', paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
      {contextHolder}
      <div>
        <Title level={2} style={{ marginBottom: 4 }}>{translate('proctoringReview.title')}</Title>
        <Text type="secondary">{translate('proctoringReview.subtitle')}</Text>
      </div>
      <Row gutter={[12, 12]}>
        {[
          [translate('proctoringReview.count.pending'), counts.pending],
          [translate('proctoringReview.count.information'), counts.information],
          [translate('proctoringReview.count.appeals'), counts.appeals],
          [translate('proctoringReview.count.decided'), counts.decided],
        ].map(([label, value]) => <Col xs={12} md={6} key={String(label)}><Card size="small"><Text type="secondary">{label}</Text><Title level={3} style={{ margin: 0 }}>{value}</Title></Card></Col>)}
      </Row>
      <Card size="small">
        <Space wrap style={{ width: '100%' }}>
          <Select
            allowClear
            style={{ minWidth: 180 }}
            placeholder={translate('proctoringReview.filter.status')}
            value={filters.status}
            onChange={status => { setFilters(current => ({ ...current, status })); setPage(1) }}
            options={['pending_review', 'information_requested', 'decided', 'appeal_pending', 'appeal_resolved'].map(value => ({ value, label: translate(`proctoringReview.status.${value}`) }))}
          />
          <Select
            allowClear
            style={{ minWidth: 180 }}
            placeholder={translate('proctoringReview.filter.outcome')}
            value={filters.outcome}
            onChange={outcome => { setFilters(current => ({ ...current, outcome })); setPage(1) }}
            options={['pending', 'cleared', 'violation_confirmed'].map(value => ({ value, label: translate(`proctoringReview.outcome.${value}`) }))}
          />
          <Button onClick={() => void queue.load()}>{translate('app.refresh')}</Button>
        </Space>
      </Card>
      {queue.error && <Alert type="error" showIcon message={queue.error} />}
      {mobile ? (
        <Space direction="vertical" style={{ width: '100%' }}>
          {queue.items.length === 0 && !queue.loading ? <Empty /> : queue.items.map(item => {
            const view = statusPresentation(item.status)
            return <Card key={item.caseId} loading={queue.loading} onClick={() => void openDetail(item)} styles={{ body: { padding: 16 } }}><Space direction="vertical" size={6} style={{ width: '100%' }}><Space style={{ justifyContent: 'space-between', width: '100%' }}><Text strong>{item.examTitle}</Text><Tag color={view.tone}>{translate(view.labelKey)}</Tag></Space><Text>{item.candidateDisplayName || item.candidatePublicId}</Text><Text type="secondary">{item.triggerReasonCode}</Text><Text type="secondary">{item.openedAt}</Text></Space></Card>
          })}
        </Space>
      ) : <Table rowKey="caseId" columns={columns} dataSource={queue.items} loading={queue.loading} pagination={false} scroll={{ x: 860 }} />}
      <Pagination current={page} pageSize={limit} total={queue.total} showSizeChanger onChange={(nextPage, nextLimit) => { setPage(nextPage); setLimit(nextLimit) }} />
      <ProctoringReviewDetailDrawer open={drawerOpen} mobile={mobile} loading={queue.detailLoading} detail={queue.detail} onClose={() => { setDrawerOpen(false); queue.setDetail(null) }} onAction={setAction} onExport={() => void exportCsv()} />
      <ProctoringReviewDecisionModal open={Boolean(action)} action={action} expectedVersion={queue.detail?.version || 0} loading={submitting} onCancel={() => setAction(null)} onSubmit={submitDecision} />
    </Space>
  )
}
