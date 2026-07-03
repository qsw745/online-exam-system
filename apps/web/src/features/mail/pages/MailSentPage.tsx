import { App, Card, Checkbox, Modal } from 'antd'
import { useMemo, useState } from 'react'
import MailTable from '@/features/mail/components/MailTable'
import MailViewerDrawer from '@/features/mail/components/MailViewerDrawer'
import { useMailList } from '@/features/mail/hooks/useMailList'
import type { MailMessage } from '@/shared/api/endpoints/mail'
import { mailApi } from '@/shared/api/endpoints/mail'
import { translate } from '@/shared/utils/i18n'

export default function MailSentPage() {
  const { message } = App.useApp()
  const { data, loading, setData } = useMailList('sent')
  const [current, setCurrent] = useState<MailMessage | null>(null)
  const [recallModal, setRecallModal] = useState<{ open: boolean; record: MailMessage | null }>({
    open: false,
    record: null,
  })
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<number[]>([])

  const recallOptions = useMemo(() => {
    if (!recallModal.record) return []
    return (recallModal.record.recipients || [])
      .filter(rec => rec.status !== 'recalled')
      .map(rec => ({
        value: rec.id,
        label: rec.name || `用户${rec.id}`,
      }))
  }, [recallModal.record])

  return (
    <>
      <Card title={translate('auto.8ed6c6957d')}>
        <MailTable
          mailbox="sent"
          data={data}
          loading={loading}
          onView={record => setCurrent(record)}
          onDelete={record => {
            Modal.confirm({
              title: translate('auto.4c862066b3'),
              content: translate('auto.5dc9ae51c3'),
              onOk: async () => {
                try {
                  await mailApi.deleteSent(record.id)
                  setData(prev => prev.filter(item => item.id !== record.id))
                  message.success(translate('auto.fb5fe1e266'))
                } catch (error: any) {
                  message.error(error?.message || translate('orgs.message.delete_failed'))
                }
              },
            })
          }}
          onRecall={record => {
            const available = (record.recipients || []).filter(rec => rec.status !== 'recalled')
            if (!available.length) {
              message.warning(translate('auto.66cb06f8bd'))
              return
            }
            setRecallModal({ open: true, record })
            setSelectedRecipientIds(available.map(r => r.id))
          }}
        />
      </Card>
      <MailViewerDrawer
        open={!!current}
        mailbox="sent"
        messageId={current?.id}
        onClose={() => setCurrent(null)}
      />
      <Modal
        title={translate('auto.3ae29a45f6')}
        open={recallModal.open}
        okText={translate('auto.71d7a28f03')}
        onCancel={() => setRecallModal({ open: false, record: null })}
        onOk={async () => {
          if (!recallModal.record || !selectedRecipientIds.length) {
            message.warning(translate('auto.6808ceea7b'))
            return
          }
          try {
            const res = await mailApi.recallSent(recallModal.record.id, selectedRecipientIds)
            setData(prev =>
              prev.map(item => {
                if (item.id !== recallModal.record!.id) return item
                const updatedRecipients = (item.recipients || []).map(r =>
                  selectedRecipientIds.includes(r.id) ? { ...r, status: 'recalled' as const } : r
                )
                const allRecalled =
                  res?.remaining === 0 ||
                  (updatedRecipients.length > 0 && updatedRecipients.every(r => r.status === 'recalled'))
                return {
                  ...item,
                  recipients: updatedRecipients,
                  status: allRecalled ? ('recalled' as MailMessage['status']) : item.status,
                }
              })
            )
            message.success(translate('workflow.msg_withdrawn'))
            setRecallModal({ open: false, record: null })
          } catch (error: any) {
            message.error(error?.message || translate('workflow.msg_withdraw_failed'))
          }
        }}
      >
        <p>{translate('auto.870adc02fc')}</p>
        {recallOptions.length ? (
          <Checkbox.Group
            options={recallOptions}
            value={selectedRecipientIds}
            onChange={list => setSelectedRecipientIds(list as number[])}
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          />
        ) : (
          <p style={{ color: '#999' }}>{translate('auto.d1338d156d')}</p>
        )}
      </Modal>
    </>
  )
}
