import { App, Card, Checkbox, Modal } from 'antd'
import { useMemo, useState } from 'react'
import MailTable from '@/features/mail/components/MailTable'
import MailViewerDrawer from '@/features/mail/components/MailViewerDrawer'
import { useMailList } from '@/features/mail/hooks/useMailList'
import type { MailMessage } from '@/shared/api/endpoints/mail'
import { mailApi } from '@/shared/api/endpoints/mail'

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
      <Card title="发件箱">
        <MailTable
          mailbox="sent"
          data={data}
          loading={loading}
          onView={record => setCurrent(record)}
          onDelete={record => {
            Modal.confirm({
              title: '删除邮件',
              content: '删除后不可恢复，确认删除该邮件吗？',
              onOk: async () => {
                try {
                  await mailApi.deleteSent(record.id)
                  setData(prev => prev.filter(item => item.id !== record.id))
                  message.success('已删除')
                } catch (error: any) {
                  message.error(error?.message || '删除失败')
                }
              },
            })
          }}
          onRecall={record => {
            const available = (record.recipients || []).filter(rec => rec.status !== 'recalled')
            if (!available.length) {
              message.warning('没有可撤回的收件人')
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
        title="撤回邮件"
        open={recallModal.open}
        okText="确认撤回"
        onCancel={() => setRecallModal({ open: false, record: null })}
        onOk={async () => {
          if (!recallModal.record || !selectedRecipientIds.length) {
            message.warning('请选择需要撤回的收件人')
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
            message.success('已撤回')
            setRecallModal({ open: false, record: null })
          } catch (error: any) {
            message.error(error?.message || '撤回失败')
          }
        }}
      >
        <p>请选择要撤回通知的收件人：</p>
        {recallOptions.length ? (
          <Checkbox.Group
            options={recallOptions}
            value={selectedRecipientIds}
            onChange={list => setSelectedRecipientIds(list as number[])}
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          />
        ) : (
          <p style={{ color: '#999' }}>所有收件人均已撤回，无可选项。</p>
        )}
      </Modal>
    </>
  )
}
