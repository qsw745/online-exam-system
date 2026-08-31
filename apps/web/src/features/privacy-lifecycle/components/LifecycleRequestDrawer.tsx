import { Button, Card, Descriptions, Drawer, Empty, Progress, Skeleton, Space, Tag, Typography } from 'antd'

import type { LifecycleAdminRequest, LifecycleAdminStep } from '@/shared/api/endpoints/privacyLifecycle'
import { translate } from '@/shared/utils/i18n'
import { lifecycleStatusPresentation, stepStatusPresentation } from '../domain/lifecyclePresentation'

const { Text, Title } = Typography

const formatDate = (value: string | null) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}

export default function LifecycleRequestDrawer({
  open,
  mobile,
  loading,
  detail,
  retryingStepId,
  onClose,
  onOpenHold,
  onRetry,
}: {
  open: boolean
  mobile: boolean
  loading: boolean
  detail: LifecycleAdminRequest | null
  retryingStepId?: string | null
  onClose: () => void
  onOpenHold: () => void
  onRetry: (step: LifecycleAdminStep) => Promise<void>
}) {
  const status = detail ? lifecycleStatusPresentation(detail.status) : null

  return (
    <Drawer
      open={open}
      width={mobile ? '100%' : 720}
      title={translate('privacyLifecycle.detail.title', '生命周期请求详情')}
      onClose={onClose}
      destroyOnHidden
    >
      {loading ? <Skeleton active paragraph={{ rows: 8 }} /> : !detail ? <Empty /> : (
        <Space direction="vertical" size={18} style={{ width: '100%' }}>
          <Descriptions size="small" column={mobile ? 1 : 2} bordered>
            <Descriptions.Item label={translate('privacyLifecycle.field.requestId', '请求编号')} span={mobile ? 1 : 2}>
              <Text copyable>{detail.requestId}</Text>
            </Descriptions.Item>
            <Descriptions.Item label={translate('privacyLifecycle.field.mode', '模式')}>
              {translate(`privacyLifecycle.mode.${detail.mode}`)}
            </Descriptions.Item>
            <Descriptions.Item label={translate('privacyLifecycle.field.status', '状态')}>
              <Tag color={status?.tone}>{translate(status?.labelKey ?? 'privacyLifecycle.status.unknown')}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label={translate('privacyLifecycle.field.requestedAt', '申请时间')}>
              {formatDate(detail.requestedAt)}
            </Descriptions.Item>
            <Descriptions.Item label={translate('privacyLifecycle.field.scheduledFor', '计划执行')}>
              {formatDate(detail.scheduledFor)}
            </Descriptions.Item>
            <Descriptions.Item label={translate('privacyLifecycle.field.startedAt', '开始时间')}>
              {formatDate(detail.startedAt)}
            </Descriptions.Item>
            <Descriptions.Item label={translate('privacyLifecycle.field.completedAt', '完成时间')}>
              {formatDate(detail.completedAt)}
            </Descriptions.Item>
            {detail.restrictedRetentionUntil ? (
              <Descriptions.Item label={translate('privacyLifecycle.field.restrictedUntil', '受限保留至')} span={mobile ? 1 : 2}>
                {formatDate(detail.restrictedRetentionUntil)}
              </Descriptions.Item>
            ) : null}
          </Descriptions>

          <Button
            danger
            onClick={onOpenHold}
            disabled={!status?.known || status.terminal}
          >
            {translate('privacyLifecycle.hold.title', '创建合法冻结')}
          </Button>

          <div>
            <Title level={4}>{translate('privacyLifecycle.detail.steps', '步骤明细')}</Title>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {detail.steps.map(step => {
                const stepView = stepStatusPresentation(step.status)
                const percent = step.plannedCount > 0
                  ? Math.min(100, Math.round((step.processedCount / step.plannedCount) * 100))
                  : step.status === 'COMPLETED' ? 100 : 0
                return (
                  <Card key={step.stepId} size="small">
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                      <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
                        <Text strong>{step.stepCode}</Text>
                        <Space wrap size={4}>
                          <Tag>{translate(`privacyLifecycle.action.${step.action}`)}</Tag>
                          <Tag color={stepView.tone}>{translate(stepView.labelKey)}</Tag>
                        </Space>
                      </Space>
                      <Progress percent={percent} size="small" status={step.status === 'ATTENTION_REQUIRED' ? 'exception' : 'normal'} />
                      <Text type="secondary">
                        {translate('privacyLifecycle.detail.counts', '计划 {planned} / 已处理 {processed} / 尝试 {attempts}')
                          .replace('{planned}', String(step.plannedCount))
                          .replace('{processed}', String(step.processedCount))
                          .replace('{attempts}', String(step.attemptCount))}
                      </Text>
                      {step.lastErrorCode ? <Text code>{step.lastErrorCode}</Text> : null}
                      {stepView.canRetry ? (
                        <Button
                          danger
                          loading={retryingStepId === step.stepId}
                          onClick={() => void onRetry(step)}
                        >
                          {translate('privacyLifecycle.retry', '人工重试')}
                        </Button>
                      ) : null}
                    </Space>
                  </Card>
                )
              })}
            </Space>
          </div>
        </Space>
      )}
    </Drawer>
  )
}
