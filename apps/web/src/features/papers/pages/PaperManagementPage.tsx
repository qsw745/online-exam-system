
import LoadingSpinner from '@/shared/components/LoadingSpinner'
import { usePapersList } from '@/shared/hooks/usePapersList'
import { App, Button, Card, Popconfirm, Space, Typography } from 'antd'
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ConfirmDialog from '../components/ConfirmDialog'
import PapersTable from '../components/PapersTable'
import PapersToolbar from '../components/PapersToolbar'
import GlobalPagination from '@/shared/components/GlobalPagination'
import PaperWorkflowModal from '../components/PaperWorkflowModal'
import { papersApi, type Paper } from '@/shared/api/endpoints/papers'
import { useLanguage } from '@/shared/contexts/LanguageContext'
const { Title, Text } = Typography

export default function PaperManagementPage() {
  const nav = useNavigate()
  const { t } = useLanguage()
  const { message } = App.useApp()
  const h = usePapersList()

  const [confirmId, setConfirmId] = useState<string | number | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([])
  const [workflowPaper, setWorkflowPaper] = useState<Paper | null>(null)
  const canBatch = selectedKeys.length > 0

  const onBatchDelete = useCallback(async () => {
    if (!canBatch) return
    const ids = selectedKeys.map(String)
    setSelectedKeys([])
    let ok = 0
    for (const id of ids) {
      try {
        await h.onDelete(id)
        ok++
      } catch {}
    }
    message.success(t('papers.batch_delete_done').replace('{ok}', String(ok)).replace('{total}', String(ids.length)))
  }, [selectedKeys, h, message, canBatch])

  const onReviewToggle = useCallback(
    async (paper: Paper, enabled: boolean) => {
      if (enabled) {
        setWorkflowPaper(paper)
        return
      }
      try {
        await papersApi.updateWorkflow(paper.id, {
          requires_review: false,
          template_id: null,
          form_values: null,
        })
        message.success(t('papers.approval_closed'))
        await h.reload()
      } catch (e: any) {
        message.error(e?.response?.data?.message || e?.message || t('papers.approval_close_failed'))
      }
    },
    [h, message]
  )

  if (h.loading) return <LoadingSpinner text={t('papers.loading')} center="page" />

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
   
      <Card
        title={
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Title level={3} style={{ margin: 0 }}>
              {t('papers.title')}
            </Title>
            <Text type="secondary">{t('papers.subtitle')}</Text>
          </Space>
        }
        extra={
          <Space wrap>
            <Button type="primary" onClick={() => nav('/admin/papers/create/smart')}>
              {t('papers.smart_create')}
            </Button>
            <Button onClick={() => nav('/admin/papers/create/manual')}>{t('papers.manual_create')}</Button>
            <Popconfirm
              title={t('papers.confirm_delete_selected').replace('{n}', String(selectedKeys.length))}
              okText={t('app.delete')}
              okButtonProps={{ danger: true }}
              disabled={!canBatch}
              onConfirm={onBatchDelete}
            >
              <Button danger disabled={!canBatch}>
                {t('papers.batch_delete')}
              </Button>
            </Popconfirm>
          </Space>
        }
      />
      <PapersToolbar
        search={h.searchTerm}
        onSearchChange={v => {
          h.pagination.setCurrent(1)
          h.setSearchTerm(v)
        }}
        difficulty={h.difficulty as any}
        onDifficultyChange={v => {
          h.pagination.setCurrent(1)
          h.setDifficulty(v as any)
        }}
        onCreateSmart={() => nav('/admin/papers/create/smart')}
        onCreateManual={() => nav('/admin/papers/create/manual')}
      />
      <Card styles={{ body: { padding: 0 } }}>
        <PapersTable
          loading={h.loading}
          items={h.items}
          selectedRowKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
          onEdit={id => nav(`/admin/paper-detail/${id}`)} // ← 编辑即跳详情
          onDelete={id => setConfirmId(id)}
          onReviewToggle={onReviewToggle}
        />
      </Card>
      <Card>
        <GlobalPagination
          current={h.pagination.current}
          total={h.pagination.total}
          pageSize={h.pagination.pageSize}
          onChange={(p, size) => {
            h.pagination.setCurrent(p)
            if (size !== h.pagination.pageSize) h.pagination.setPageSize(size)
          }}
        />
      </Card>
      <ConfirmDialog
        open={!!confirmId}
        title={t('papers.confirm_delete')}
        content={t('papers.delete_warning')}
        onCancel={() => setConfirmId(null)}
        onOk={() => {
          if (confirmId != null) h.onDelete(String(confirmId))
          setConfirmId(null)
        }}
      />
      <PaperWorkflowModal
        paperId={Number(workflowPaper?.id ?? 0)}
        open={!!workflowPaper}
        onClose={() => setWorkflowPaper(null)}
        onSubmitted={() => {
          setWorkflowPaper(null)
          h.reload()
        }}
      />
    </Space>
  )
}
