import { Alert, Button, Descriptions, Divider, Drawer, Empty, List, Space, Spin, Tag, Typography } from 'antd'
import type { ReviewCaseDetail } from '@/shared/api/endpoints/proctoringReview'
import { actionsForCase, publicReasonKey, statusPresentation, type StaffReviewAction } from '../domain/reviewPresentation'
import { translate } from '@/shared/utils/i18n'

const { Text, Paragraph } = Typography

export function ProctoringReviewDetailDrawer(props: {
  open: boolean
  mobile: boolean
  loading: boolean
  detail: ReviewCaseDetail | null
  onClose: () => void
  onAction: (action: StaffReviewAction) => void
  onExport: () => void
}) {
  const detail = props.detail
  const presentation = statusPresentation(detail?.status || '')
  const actions = detail ? actionsForCase(detail) : []
  return (
    <Drawer
      open={props.open}
      width={props.mobile ? '100%' : 720}
      title={translate('proctoringReview.detail.title')}
      onClose={props.onClose}
      extra={<Button onClick={props.onExport} disabled={!detail}>{translate('proctoringReview.export')}</Button>}
    >
      <Spin spinning={props.loading}>
        {!detail ? <Empty /> : (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Alert type="info" showIcon message={translate('proctoringReview.gradeIsolation')} />
            <Descriptions bordered size="small" column={props.mobile ? 1 : 2} title={translate('proctoringReview.section.summary')}>
              <Descriptions.Item label={translate('proctoringReview.field.exam')}>{detail.examTitle}</Descriptions.Item>
              <Descriptions.Item label={translate('proctoringReview.field.candidate')}>{detail.candidateDisplayName || detail.candidatePublicId}</Descriptions.Item>
              <Descriptions.Item label={translate('proctoringReview.field.status')}><Tag color={presentation.tone}>{translate(presentation.labelKey)}</Tag></Descriptions.Item>
              <Descriptions.Item label={translate('proctoringReview.field.reason')}>{translate(publicReasonKey(detail.triggerReasonCode))}</Descriptions.Item>
              <Descriptions.Item label={translate('proctoringReview.field.version')}>{detail.version}</Descriptions.Item>
              <Descriptions.Item label={translate('proctoringReview.field.openedAt')}>{detail.openedAt}</Descriptions.Item>
            </Descriptions>
            <Divider orientation="left">{translate('proctoringReview.section.identity')}</Divider>
            <Paragraph>{translate('proctoringReview.identityStatus')}: {detail.session.identityStatus}</Paragraph>
            <List
              header={translate('proctoringReview.section.events')}
              dataSource={detail.events}
              locale={{ emptyText: translate('proctoringReview.empty.events') }}
              renderItem={event => <List.Item><List.Item.Meta title={`${event.type} · ${event.severity}`} description={`${event.occurredAt} · ${JSON.stringify(event.state)}`} /></List.Item>}
            />
            <List
              header={translate('proctoringReview.section.timeline')}
              dataSource={[
                ...detail.decisions.map(item => ({ time: item.createdAt, title: item.action, body: item.comment })),
                ...detail.messages.map(item => ({ time: item.createdAt, title: item.messageType, body: item.body })),
              ].sort((a, b) => a.time.localeCompare(b.time))}
              locale={{ emptyText: translate('proctoringReview.empty.timeline') }}
              renderItem={item => <List.Item><List.Item.Meta title={`${item.title} · ${item.time}`} description={item.body} /></List.Item>}
            />
            {detail.appeal && (
              <Alert
                type={detail.appeal.status === 'pending' ? 'warning' : 'info'}
                message={`${translate('proctoringReview.section.appeal')} · ${translate(publicReasonKey(detail.appeal.reasonCode))}`}
                description={detail.appeal.statement}
              />
            )}
            {actions.length > 0 && (
              <Space wrap>
                {actions.map(action => <Button key={action} type={action === 'confirm_violation' ? 'primary' : 'default'} danger={action === 'confirm_violation' || action === 'resolve_appeal_rejected'} onClick={() => props.onAction(action)}>{translate(`proctoringReview.action.${action}`)}</Button>)}
              </Space>
            )}
            {actions.length === 0 && <Text type="secondary">{translate('proctoringReview.noActions')}</Text>}
          </Space>
        )}
      </Spin>
    </Drawer>
  )
}

export default ProctoringReviewDetailDrawer
