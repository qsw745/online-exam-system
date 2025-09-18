import LoadingSpinner from '@/shared/components/LoadingSpinner'
import { createPaginationConfig } from '@/shared/constants/pagination'
import { Breadcrumb, Card, Pagination, Space, Typography } from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePapersList } from '@/shared/hooks/usePapersList'
import ConfirmDialog from '../components/ConfirmDialog'
import PapersTable from '../components/PapersTable'
import PapersToolbar from '../components/PapersToolbar'

const { Title, Text } = Typography

export default function PaperManagementPage() {
  const nav = useNavigate()
  const h = usePapersList()
  const [confirmId, setConfirmId] = useState<string | null>(null)

  if (h.loading) return <LoadingSpinner text="加载试卷列表..." center="page" />

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Breadcrumb items={[{ title: '题库' }, { title: '试卷管理' }]} />

      <Card>
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Title level={3} style={{ margin: 0 }}>
            试卷管理
          </Title>
          <Text type="secondary">管理所有考试试卷</Text>
        </Space>
      </Card>

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

      <Card bodyStyle={{ padding: 0 }}>
        <PapersTable
          loading={h.loading}
          items={h.items}
          onView={id => nav(`/admin/paper-detail/${id}`)}
          onEdit={id => nav(`/admin/paper-edit/${id}`)}
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
          if (confirmId) h.onDelete(confirmId)
          setConfirmId(null)
        }}
      />
    </Space>
  )
}
