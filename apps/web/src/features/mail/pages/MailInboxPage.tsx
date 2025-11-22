import { App, Card, Modal } from 'antd'
import { useMemo, useState } from 'react'
import MailTable from '@/features/mail/components/MailTable'
import MailViewerDrawer from '@/features/mail/components/MailViewerDrawer'
import { useMailList } from '@/features/mail/hooks/useMailList'
import type { MailMessage } from '@/shared/api/endpoints/mail'
import { mailApi } from '@/shared/api/endpoints/mail'

export default function MailInboxPage() {
  const { message } = App.useApp()
  const { data, loading, reload, setData } = useMailList('inbox')
  const [selected, setSelected] = useState<MailMessage | null>(null)

  const markReadLocally = useMemo(
    () => (id: number) => {
      setData(prev =>
        prev.map(item => (item.id === id ? { ...item, is_read: true } : item))
      )
    },
    [setData]
  )

  return (
    <>
      <Card title="收件箱" extra={null}>
        <MailTable
          mailbox="inbox"
          data={data}
          loading={loading}
          onDelete={record => {
            Modal.confirm({
              title: '删除邮件',
              content: '删除后不可恢复，确认删除该邮件吗？',
              onOk: async () => {
                try {
                  await mailApi.deleteInbox(record.id)
                  setData(prev => prev.filter(item => item.id !== record.id))
                  message.success('已删除')
                } catch (error: any) {
                  message.error(error?.message || '删除失败')
                }
              },
            })
          }}
          onView={record => {
            setSelected(record)
          }}
        />
      </Card>
      <MailViewerDrawer
        open={!!selected}
        mailbox="inbox"
        messageId={selected?.id}
        onClose={() => setSelected(null)}
        onRead={() => {
          if (selected) markReadLocally(selected.id)
          reload().catch(err => message.error(err?.message || '刷新失败'))
        }}
      />
    </>
  )
}
