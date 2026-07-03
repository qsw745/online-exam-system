import { App, Card, Modal } from 'antd'
import { useMemo, useState } from 'react'
import MailTable from '@/features/mail/components/MailTable'
import MailViewerDrawer from '@/features/mail/components/MailViewerDrawer'
import { useMailList } from '@/features/mail/hooks/useMailList'
import type { MailMessage } from '@/shared/api/endpoints/mail'
import { mailApi } from '@/shared/api/endpoints/mail'
import { translate } from '@/shared/utils/i18n'

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
      <Card title={translate('menus.notify-inbox')} extra={null}>
        <MailTable
          mailbox="inbox"
          data={data}
          loading={loading}
          onDelete={record => {
            Modal.confirm({
              title: translate('auto.4c862066b3'),
              content: translate('auto.5dc9ae51c3'),
              onOk: async () => {
                try {
                  await mailApi.deleteInbox(record.id)
                  setData(prev => prev.filter(item => item.id !== record.id))
                  message.success(translate('auto.fb5fe1e266'))
                } catch (error: any) {
                  message.error(error?.message || translate('orgs.message.delete_failed'))
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
          reload().catch(err => message.error(err?.message || translate('auto.be6ff1fbf8')))
        }}
      />
    </>
  )
}
