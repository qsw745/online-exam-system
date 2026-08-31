import { Alert, Card, Space, Tag, Typography } from 'antd'
import { RadioTower } from 'lucide-react'
import { useLanguage } from '@/shared/contexts/LanguageContext'
import type { NativeProctoringStatus } from '@/platform/proctoring'
import type { StrictProctoringPhase } from './useStrictProctoring'

const { Text } = Typography

const colorFor = (value?: string) => {
  if (value === 'available' || value === 'foreground' || value === 'normal') return 'success'
  if (value === 'interrupted' || value === 'denied' || value === 'unavailable' || value === 'background' || value === 'dark') return 'error'
  return 'default'
}

export function StrictProctoringStatusCard(props: {
  phase: StrictProctoringPhase
  status: NativeProctoringStatus | null
  error: string | null
}) {
  const { t } = useLanguage()
  const format = (template: string, values: Record<string, string | number>) =>
    Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{${key}}`, String(value)), template)
  const statusLabel = (value?: string) => t(`examPage.strictProctor.status.${value || 'init'}`)
  return (
    <Card
      title={<Space><RadioTower size={18} color="#ef4444" /><Text strong>{t('examPage.strictProctor.monitoring')}</Text></Space>}
      style={{ borderRadius: 12, marginBottom: 16 }}
    >
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <Alert
          type={props.phase === 'active' ? 'success' : 'warning'}
          showIcon
          message={props.phase === 'active' ? t('examPage.strictProctor.active') : t('examPage.strictProctor.paused')}
          description={t('examPage.strictProctor.visible_indicator')}
        />
        <Space wrap size={[6, 6]}>
          <Tag color={colorFor(props.status?.camera)}>{format(t('examPage.proctor.camera'), { status: statusLabel(props.status?.camera) })}</Tag>
          <Tag color={colorFor(props.status?.microphone)}>{format(t('examPage.proctor.mic'), { status: statusLabel(props.status?.microphone) })}</Tag>
          <Tag color={colorFor(props.status?.app)}>{format(t('examPage.strictProctor.app_state'), { status: statusLabel(props.status?.app || 'foreground') })}</Tag>
          <Tag color={props.status?.faceCount === 1 ? 'success' : 'warning'}>{format(t('examPage.strictProctor.face_count'), { count: props.status?.faceCount ?? 0 })}</Tag>
        </Space>
        {props.error ? <Text type="danger">{props.error}</Text> : null}
        <Text type="secondary">{t('examPage.strictProctor.no_audio_content')}</Text>
      </Space>
    </Card>
  )
}
