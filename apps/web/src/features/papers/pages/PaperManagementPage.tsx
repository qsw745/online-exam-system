import AppBreadcrumb from '@/shared/components/AppBreadcrumb'
import LoadingSpinner from '@/shared/components/LoadingSpinner'
import { createPaginationConfig } from '@/shared/constants/pagination'
import { usePapersList } from '@/shared/hooks/usePapersList'
import { App, Button, Card, Pagination, Popconfirm, Space, Typography } from 'antd'
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ConfirmDialog from '../components/ConfirmDialog'
import PapersTable from '../components/PapersTable'
import PapersToolbar from '../components/PapersToolbar'
const { Title, Text } = Typography

export default function PaperManagementPage() {
  const nav = useNavigate()
  const { message } = App.useApp()
  const h = usePapersList()

  const [confirmId, setConfirmId] = useState<string | number | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([])
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
    message.success(`批量删除完成，成功 ${ok}/${ids.length}`)
  }, [selectedKeys, h, message, canBatch])

  if (h.loading) return <LoadingSpinner text="加载试卷列表..." center="page" />

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <AppBreadcrumb />
      <Card
        title={
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Title level={3} style={{ margin: 0 }}>
              试卷管理
            </Title>
            <Text type="secondary">管理所有考试试卷</Text>
          </Space>
        }
        extra={
          <Space wrap>
            <Button type="primary" onClick={() => nav('/admin/papers/create/smart')}>
              智能组卷
            </Button>
            <Button onClick={() => nav('/admin/papers/create/manual')}>手动创建</Button>
            <Popconfirm
              title={`确认删除选中的 ${selectedKeys.length} 条试卷？`}
              okText="删除"
              okButtonProps={{ danger: true }}
              disabled={!canBatch}
              onConfirm={onBatchDelete}
            >
              <Button danger disabled={!canBatch}>
                批量删除
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
        />
      </Card>
      <Card>
        <Pagination
          {...createPaginationConfig()}
          current={h.pagination.current}
          total={h.pagination.total}
          pageSize={h.pagination.pageSize}
          onChange={(p, s) => {
            if (s && s !== h.pagination.pageSize) h.pagination.setPageSize(s)
            h.pagination.setCurrent(p)
          }}
          onShowSizeChange={(_, s) => h.pagination.setPageSize(s)}
          showTotal={(t, range) => `共 ${t} 条，当前 ${range[0]}-${range[1]}`}
          showSizeChanger
          showQuickJumper
        />
      </Card>
      <ConfirmDialog
        open={!!confirmId}
        title="确认删除"
        content="删除后将无法恢复，确定要删除该试卷吗？"
        onCancel={() => setConfirmId(null)}
        onOk={() => {
          if (confirmId != null) h.onDelete(String(confirmId))
          setConfirmId(null)
        }}
      />
    </Space>
  )
}
