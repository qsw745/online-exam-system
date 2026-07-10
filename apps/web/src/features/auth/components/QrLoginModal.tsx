import { useCallback, useEffect, useRef, useState } from 'react'
import { App, Button, Modal, Space, Spin, Tag, Typography } from 'antd'
import { QRCodeSVG } from 'qrcode.react'
import { RefreshCw } from 'lucide-react'
import { auth as authApi } from '@/shared/api/endpoints/auth'
import { isSuccess } from '@/shared/api/core/types'
import { useAuth } from '@/shared/contexts/AuthContext'
import { withAppBasePath } from '@/shared/router/basePath'
import { translate } from '@/shared/utils/i18n'

const { Text, Paragraph } = Typography

type Props = {
  open: boolean
  keep7Days?: boolean
  onClose: () => void
}

type Phase = 'loading' | 'waiting' | 'scanned' | 'expired' | 'error'

const POLL_INTERVAL_MS = 1500

export default function QrLoginModal({ open, keep7Days, onClose }: Props) {
  const { message } = App.useApp()
  const { signInWithSession } = useAuth()
  const [phase, setPhase] = useState<Phase>('loading')
  const [qrUrl, setQrUrl] = useState('')
  const pollRef = useRef<number | null>(null)
  const pollTokenRef = useRef('')
  const ticketRef = useRef('')

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const poll = useCallback(async () => {
    const ticketId = ticketRef.current
    const pollToken = pollTokenRef.current
    if (!ticketId || !pollToken) return
    const res = await authApi.qrPoll(ticketId, pollToken)
    if (!isSuccess(res)) return
    const { status, token, user } = res.data
    if (status === 'confirmed' && token && user) {
      stopPolling()
      await signInWithSession(token, user, keep7Days)
      message.success(translate('auto.04de61deee'))
      onClose()
    } else if (status === 'expired' || status === 'invalid') {
      stopPolling()
      setPhase('expired')
    } else if (status === 'scanned') {
      setPhase('scanned')
    }
  }, [keep7Days, message, onClose, signInWithSession, stopPolling])

  const start = useCallback(async () => {
    stopPolling()
    setPhase('loading')
    const res = await authApi.qrCreate({ keep7Days })
    if (!isSuccess(res)) {
      setPhase('error')
      return
    }
    ticketRef.current = res.data.ticketId
    pollTokenRef.current = res.data.pollToken
    // 二维码指向本前端的手机页；手机需能访问该地址（生产为域名，局域网需用本机 IP 访问）
    setQrUrl(`${window.location.origin}${withAppBasePath(`/m/face-auth?ticket=${res.data.ticketId}`)}`)
    setPhase('waiting')
    pollRef.current = window.setInterval(poll, POLL_INTERVAL_MS)
  }, [keep7Days, poll, stopPolling])

  useEffect(() => {
    if (open) start()
    return () => stopPolling()
    // 仅在打开时初始化一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <Modal title={translate('auto.76b247a097')} open={open} onCancel={onClose} footer={null} destroyOnHidden width={400}>
      <Space direction="vertical" align="center" size="middle" style={{ width: '100%' }}>
        <Paragraph type="secondary" style={{ marginBottom: 0, textAlign: 'center' }}>
          {translate('auto.41b60b3f58')}</Paragraph>

        <div
          style={{
            width: 220,
            height: 220,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--ant-color-border, #eee)',
            borderRadius: 12,
            position: 'relative',
          }}
        >
          {phase === 'loading' && <Spin />}
          {(phase === 'waiting' || phase === 'scanned') && qrUrl && (
            <QRCodeSVG value={qrUrl} size={196} includeMargin />
          )}
          {(phase === 'expired' || phase === 'error') && (
            <Button type="primary" icon={<RefreshCw size={16} />} onClick={start}>
              {phase === 'expired' ? translate('visible.61ca7c2fab') : translate('visible.628ff25b2e')}
            </Button>
          )}
        </div>

        {phase === 'waiting' && <Tag color="processing">{translate('auto.865809d354')}</Tag>}
        {phase === 'scanned' && <Tag color="gold">{translate('auto.29dd7fcee2')}</Tag>}
        <Text type="secondary" style={{ fontSize: 12 }}>
          {translate('visible.a4aed56b5d')}
        </Text>
        {(phase === 'waiting' || phase === 'scanned') && qrUrl && (
          <a href={qrUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12 }}>
            {translate('auto.fb2d6fc5dd')}</a>
        )}
      </Space>
    </Modal>
  )
}
