import { App, Card, Modal } from 'antd'
import { useNavigate } from 'react-router-dom'
import MailTable from '@/features/mail/components/MailTable'
import { useMailList } from '@/features/mail/hooks/useMailList'
import { mailApi } from '@/shared/api/endpoints/mail'
import { translate } from '@/shared/utils/i18n'

export default function MailDraftPage() {
  const { message } = App.useApp()
  const { data, loading, setData } = useMailList('drafts')
  const navigate = useNavigate()

  return (
    <Card title={translate('menus.mail-draft')}>
      <MailTable
        mailbox="drafts"
        data={data}
        loading={loading}
        onView={record => navigate(`/mail/compose?draftId=${record.id}`)}
        onEditDraft={record => navigate(`/mail/compose?draftId=${record.id}`)}
        onDelete={record => {
          Modal.confirm({
            title: translate('auto.59358b12cb'),
            content: translate('auto.c5010747c9'),
            onOk: async () => {
              try {
                await mailApi.deleteDraft(record.id)
                setData(prev => prev.filter(item => item.id !== record.id))
                message.success(translate('auto.f8c3238dd9'))
              } catch (error: any) {
                message.error(error?.message || translate('orgs.message.delete_failed'))
              }
            },
          })
        }}
      />
    </Card>
  )
}
