import { ConfirmDialog } from '@/shared/components/ui'
import { Card, Typography, message } from 'antd'
import React from 'react'

import { useQuestionQuery } from '@/shared/hooks/useQuestionQuery'
import { useQuestionSelection } from '@/shared/hooks/useQuestionSelection'

import AppBreadcrumb from '@/shared/components/AppBreadcrumb'
import AddQuestionModal from '../components/AddQuestionModal'
import ExportModal from '../components/ExportModal'
import ImportModal from '../components/ImportModal'
import QuestionTable from '../components/QuestionTable'
import QuestionToolbar from '../components/QuestionToolbar'
const { Title, Paragraph } = Typography

export default function QuestionManagementPage() {
  const q = useQuestionQuery()
  const sel = useQuestionSelection(
    q.list.map(i => i.id),
    q.reload
  )

  const [single, setSingle] = React.useState<{ id: string; content: string } | null>(null)
  const [addOpen, setAddOpen] = React.useState(false)
  const [importOpen, setImportOpen] = React.useState(false)
  const [exportOpen, setExportOpen] = React.useState(false)

  return (
    <div >
      <AppBreadcrumb />
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          题目管理
        </Title>
        <Paragraph type="secondary" style={{ margin: '8px 0 0' }}>
          管理考试题库中的所有题目
        </Paragraph>
      </div>

      <Card style={{ marginBottom: 24 }}>
        <QuestionToolbar
          search={q.search}
          onSearch={v => {
            q.setSearch(v)
          }}
          onQuery={() => {
            // 点击“查询”或回车时：回到第一页并刷新
            q.setPage(1)
            q.reload()
          }}
          type={q.type}
          onTypeChange={v => {
            q.setType(v as any)
            q.setPage(1)
            q.reload()
          }}
          selectedTags={q.selectedTags}
          onTagsChange={v => {
            q.setSelectedTags(v)
            q.setPage(1)
            q.reload()
          }}
          allTags={q.allTags}
          onBatchDelete={() => sel.setDeleteModalVisible(true)}
          onOpenImport={() => setImportOpen(true)}
          onOpenAdd={() => setAddOpen(true)}
          onOpenExport={() => setExportOpen(true)}
          selectedCount={sel.selected.length}
        />
      </Card>

      <Card>
        <QuestionTable
          loading={q.loading}
          data={q.list}
          selectedRowKeys={sel.selected}
          onSelectChange={ks => sel.setSelected(ks as string[])}
          onDeleteClick={row => setSingle({ id: row.id, content: row.content })}
          pagination={{
            current: q.page,
            total: q.total,
            pageSize: q.pageSize,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total: number, range: number[]) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            onChange: q.setPage,
            onShowSizeChange: (_cur: number, ps: number) => {
              q.setPageSize(ps)
              q.setPage(1)
              q.reload()
            },
          }}
        />
      </Card>

      {/* 批量删除 */}
      <ConfirmDialog
        open={sel.deleteModalVisible}
        title="确认删除"
        content={`确定要删除选中的 ${sel.selected.length} 道题目吗？此操作无法撤销。`}
        okText="确认删除"
        okDanger
        onCancel={() => sel.setDeleteModalVisible(false)}
        onOk={sel.batchDelete}
      />

      {/* 单个删除 */}
      <ConfirmDialog
        open={!!single}
        title="确认删除"
        content={`确定要删除题目 ${single?.content ?? ''}？此操作无法撤销。`}
        okText="确认删除"
        okDanger
        onCancel={() => setSingle(null)}
        onOk={async () => {
          if (!single) return
          const { questionsApi } = await import('@/shared/api/http')
          const r = await questionsApi.remove(single.id)
          if ((r as any)?.success) {
            message.success('题目删除成功')
            q.reload()
          } else {
            message.error('删除题目失败')
          }
          setSingle(null)
        }}
      />

      {/* 新增题目 */}
      <AddQuestionModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={() => {
          setAddOpen(false)
          q.reload()
        }}
        allTags={q.allTags}
      />

      {/* 批量导入 */}
      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          setImportOpen(false)
          q.reload()
        }}
        reloadTags={q.reloadTags}
      />

      {/* 批量导出 */}
      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        itemsOnPage={q.list}
        selectedIds={sel.selected}
        total={q.total}
        pageSize={q.pageSize}
        fetchPage={async (page, limit) => {
          const { questionsApi } = await import('@/shared/api/http')
          const params: any = {
            page,
            limit,
            keyword: q.search || undefined,
            search: q.search || undefined,
            type: q.type === 'all' ? undefined : q.type,
            tags: q.selectedTags.length ? q.selectedTags.join(',') : undefined,
          }
          const r: any = await questionsApi.list(params)
          const d = r?.data
          const items = Array.isArray(d) ? d : d?.items ?? d?.questions ?? []
          const total = d?.total ?? d?.pagination?.total ?? (Array.isArray(d) ? d.length : 0)
          return { items, total }
        }}
      />
    </div>
  )
}
