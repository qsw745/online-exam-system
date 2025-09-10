// features/papers/pages/PaperManagementPage.tsx
import LoadingSpinner from '@/shared/components/LoadingSpinner'
import { createPaginationConfig } from '@/shared/constants/pagination'
import { Pagination } from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePapersList } from '@/shared/hooks/usePapersList'
import ConfirmDialog from '../components/ConfirmDialog'
import PapersTable from '../components/PapersTable'
import PapersToolbar from '../components/PapersToolbar'

export default function PaperManagementPage() {
  const nav = useNavigate()
  const h = usePapersList()
  const [confirmId, setConfirmId] = useState<string | null>(null)

  if (h.loading) return <LoadingSpinner text="加载试卷列表..." />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">试卷管理</h1>
        <p className="text-gray-600 mt-1">管理所有考试试卷</p>
      </div>

      <PapersToolbar
        search={h.searchTerm}
        onSearchChange={v => {
          h.pagination.setCurrent(1)
          h.setSearchTerm(v)
        }}
        difficulty={h.difficulty}
        onDifficultyChange={v => {
          h.pagination.setCurrent(1)
          h.setDifficulty(v)
        }}
        onCreateSmart={() => nav('/admin/smart-paper-create')}
        onCreateManual={() => nav('/admin/paper-create')}
      />

      <PapersTable
        items={h.items}
        onView={id => nav(`/admin/paper-detail/${id}`)}
        onEdit={id => nav(`/admin/paper-edit/${id}`)}
        onDelete={id => setConfirmId(id)}
      />

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
      />

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
    </div>
  )
}
