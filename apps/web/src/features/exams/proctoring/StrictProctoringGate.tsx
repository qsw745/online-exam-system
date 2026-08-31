import { Alert, Button, Card, Checkbox, Divider, Modal, Space, Spin, Tag, Typography } from 'antd'
import { Camera, Mic, ScanFace, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useLanguage } from '@/shared/contexts/LanguageContext'
import type { ExamProctoringPolicy, StrictProctoringPhase } from './useStrictProctoring'

const { Paragraph, Text, Title } = Typography

export function StrictProctoringGate(props: {
  policy?: ExamProctoringPolicy
  phase: StrictProctoringPhase
  busy: boolean
  error: string | null
  onBegin: (consent: { accepted: boolean; biometricConsent: boolean; locale?: string }) => Promise<void>
  onOpenSettings: () => Promise<void>
  onExit: () => void
}) {
  const { t, language } = useLanguage()
  const [accepted, setAccepted] = useState(false)
  const [biometricConsent, setBiometricConsent] = useState(false)
  const open = !['not_required', 'active', 'completed'].includes(props.phase)
  const notice = props.policy?.notice
  const format = (template: string, values: Record<string, string | number>) =>
    Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{${key}}`, String(value)), template)

  const retry = () => props.onBegin({ accepted: true, biometricConsent: true, locale: language })
  const begin = () => props.onBegin({ accepted, biometricConsent, locale: language })

  return (
    <Modal open={open} footer={null} closable={false} maskClosable={false} centered width={640}>
      {props.phase === 'notice' ? (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Tag color="red">{t('examPage.strictProctor.tag')}</Tag>
            <Title level={3} style={{ marginTop: 10, marginBottom: 6 }}>{t('examPage.strictProctor.notice_title')}</Title>
            <Paragraph type="secondary">{notice?.purpose || t('examPage.strictProctor.notice_purpose')}</Paragraph>
          </div>
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            <Card size="small"><Space align="start"><Camera size={20} /><Text>{notice?.cameraUsage || t('examPage.strictProctor.camera_usage')}</Text></Space></Card>
            <Card size="small"><Space align="start"><Mic size={20} /><Text>{notice?.microphoneUsage || t('examPage.strictProctor.microphone_usage')}</Text></Space></Card>
            <Card size="small"><Space align="start"><ScanFace size={20} /><Text>{t('examPage.strictProctor.identity_usage')}</Text></Space></Card>
            <Card size="small"><Space align="start"><ShieldCheck size={20} /><Text>{notice?.mediaUpload || t('examPage.strictProctor.media_minimization')}</Text></Space></Card>
          </Space>
          <Alert
            type="info"
            showIcon
            message={t('examPage.strictProctor.data_destination')}
            description={[
              notice?.processingLocation || t('examPage.strictProctor.region_service'),
              format(t('examPage.strictProctor.event_retention'), { days: notice?.eventRetentionDays ?? props.policy?.eventRetentionDays ?? 180 }),
              format(t('examPage.strictProctor.snapshot_retention'), { days: notice?.snapshotRetentionDays ?? props.policy?.snapshotRetentionDays ?? 0 }),
            ].join(' · ')}
          />
          <Divider style={{ margin: '4px 0' }} />
          <Checkbox checked={accepted} onChange={event => setAccepted(event.target.checked)}>
            {t('examPage.strictProctor.consent_monitoring')}
          </Checkbox>
          <Checkbox checked={biometricConsent} onChange={event => setBiometricConsent(event.target.checked)}>
            {t('examPage.strictProctor.consent_biometric')}
          </Checkbox>
          {props.error ? <Alert type="error" showIcon message={props.error} /> : null}
          <Space wrap>
            <Button type="primary" disabled={!accepted || !biometricConsent} loading={props.busy} onClick={() => void begin()}>
              {t('examPage.strictProctor.prepare')}
            </Button>
            <Button onClick={props.onExit}>{t('examPage.strictProctor.exit')}</Button>
          </Space>
        </Space>
      ) : props.phase === 'preparing' ? (
        <Space direction="vertical" align="center" size="large" style={{ width: '100%', padding: 24 }}>
          <Spin size="large" />
          <Title level={4}>{t('examPage.strictProctor.preparing')}</Title>
          <Text type="secondary">{t('examPage.strictProctor.preparing_help')}</Text>
        </Space>
      ) : (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Title level={3}>{
            props.phase === 'permission_denied'
              ? t('examPage.strictProctor.permission_title')
              : props.phase === 'review_required'
                ? t('examPage.strictProctor.review_title')
                : props.phase === 'identity_failed'
                  ? t('examPage.strictProctor.identity_failed_title')
                  : t('examPage.strictProctor.interrupted_title')
          }</Title>
          <Alert
            type={props.phase === 'review_required' ? 'error' : 'warning'}
            showIcon
            message={props.error || t('examPage.strictProctor.interrupted_help')}
          />
          <Text type="secondary">{t('examPage.strictProctor.no_silent_downgrade')}</Text>
          <Space wrap>
            {props.phase === 'permission_denied' ? (
              <Button type="primary" onClick={() => void props.onOpenSettings()}>{t('examPage.strictProctor.open_settings')}</Button>
            ) : null}
            {!['review_required', 'identity_failed'].includes(props.phase) ? (
              <Button type="primary" loading={props.busy} onClick={() => void retry()}>{t('examPage.strictProctor.retry')}</Button>
            ) : null}
            <Button onClick={props.onExit}>{t('examPage.strictProctor.exit')}</Button>
          </Space>
        </Space>
      )}
    </Modal>
  )
}
