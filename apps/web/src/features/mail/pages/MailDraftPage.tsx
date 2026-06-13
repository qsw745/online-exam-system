import { App, Card, Modal } from 'antd'
import { useNavigate } from 'react-router-dom'
import MailTable from '@/features/mail/components/MailTable'
import { useMailList } from '@/features/mail/hooks/useMailList'
import { mailApi } from '@/shared/api/endpoints/mail'

export default function MailDraftPage() {
  const { message } = App.useApp()
  const { data, loading, setData } = useMailList('drafts')
  const navigate = useNavigate()

  return (
    <Card title="草稿箱">
      <MailTable
        mailbox="drafts"
        data={data}
        loading={loading}
        onView={record => navigate(`/mail/compose?draftId=${record.id}`)}
        onEditDraft={record => navigate(`/mail/compose?draftId=${record.id}`)}
        onDelete={record => {
          Modal.confirm({
            title: '删除草稿',
            content: '删除后不可恢复，确认删除该草稿吗？',
            onOk: async () => {
              try {
                await mailApi.deleteDraft(record.id)
                setData(prev => prev.filter(item => item.id !== record.id))
                message.success('草稿已删除')
              } catch (error: any) {
                message.error(error?.message || '删除失败')
              }
            },
          })
        }}
      />
    </Card>
  )
}
