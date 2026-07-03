import { ConfirmDialog } from '@/shared/components/ui'
import { Card, Typography, message } from 'antd'
import React from 'react'

import { useQuestionSelection } from '@/features/questions/hooks/useQuestionSelection'
import { createTablePaginationConfig, resolvePaginationChange } from '@/shared/constants/pagination'
import { useQuestionsQuery } from '../hooks/useQuestionsQuery'
import { useLanguage } from '@/shared/contexts/LanguageContext'

import AddQuestionModal from '../components/AddQuestionModal'
import ExportModal from '../components/ExportModal'
import ImportModal from '../components/ImportModal'
import QuestionTable from '../components/QuestionTable'
import QuestionToolbar from '../components/QuestionToolbar'

const { Title, Paragraph } = Typography

export default function QuestionManagementPage() {
  const { t } = useLanguage()
  const q = useQuestionsQuery()
  const sel = useQuestionSelection(
    q.list.map(i => i.id),
    q.reload
  )

  const [single, setSingle] = React.useState<{ id: string; content: string } | null>(null)
  const [addOpen, setAddOpen] = React.useState(false)
  const [importOpen, setImportOpen] = React.useState(false)
  const [exportOpen, setExportOpen] = React.useState(false)

  const handlePaginationChange = (nextPage: number, nextPageSize: number) => {
    const next = resolvePaginationChange(nextPage, nextPageSize, q.pageSize)
    q.setPage(next.page)
    if (next.pageSize !== q.pageSize) q.setPageSize(next.pageSize)
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          {t('questions.mgmt_title')}
        </Title>
        <Paragraph type="secondary" style={{ margin: '8px 0 0' }}>
          {t('questions.subtitle')}
        </Paragraph>
      </div>

      <Card style={{ marginBottom: 24 }}>
        <QuestionToolbar
          search={q.search}
          onSearch={v => q.setSearch(v)}
          onQuery={() => {
            q.setPage(1)
            q.reload()
          }}
          type={q.type}
          onTypeChange={v => {
            q.setFilter('type', v as any)

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
          /* 重复题开关 */
          dupOnly={q.dupOnly}
          onToggleDup={next => {
            q.setDupOnly(next)
            q.setPage(1)
            q.reload()
          }}
        />
      </Card>

      <Card>
        <QuestionTable
          loading={q.loading}
          data={q.list}
          selectedRowKeys={sel.selected}
          onSelectChange={ks => sel.setSelected(ks as string[])}
          onDeleteClick={row => setSingle({ id: row.id, content: (row as any).content })}
          pagination={createTablePaginationConfig({
            current: q.page,
            total: q.total, // 分组模式：这里是“组总数”
            pageSize: q.pageSize,
            unit: q.isGrouped ? t('questions.unit_group') : t('questions.unit_item'),
            onChange: handlePaginationChange,
          })}
        />
      </Card>

      {/* 批量删除 */}
      <ConfirmDialog
        open={sel.deleteModalVisible}
        title={t('questions.confirm_delete')}
        content={t('questions.confirm_delete_batch').replace('{n}', String(sel.selected.length))}
        okText={t('questions.delete_ok')}
        okDanger
        onCancel={() => sel.setDeleteModalVisible(false)}
        onOk={sel.batchDelete}
      />

      {/* 单个删除 */}
      <ConfirmDialog
        open={!!single}
        title={t('questions.confirm_delete')}
        content={t('questions.confirm_delete_single').replace('{content}', single?.content ?? '')}
        okText={t('questions.delete_ok')}
        okDanger
        onCancel={() => setSingle(null)}
        onOk={async () => {
          if (!single) return
          const { questionsApi } = await import('@/shared/api/http')
          const r = await questionsApi.remove(single.id)
          if ((r as any)?.success) {
            message.success(t('questions.delete_success'))
            q.reload()
          } else {
            message.error(t('questions.delete_failed'))
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
            // 导出时也尊重“重复模式”
            duplicates: q.dupOnly ? 'title_type' : undefined,
            grouped: q.dupOnly ? 'true' : undefined,
          }
          const r: any = await questionsApi.list(params)
          const d = r?.data
          // ★ 分组导出：把本页 groups 拍平
          if (d?.grouped === true && Array.isArray(d.groups)) {
            const items = d.groups.flatMap((g: any) => g.items || [])
            const totalGroups = Number(d?.pagination?.totalGroups ?? items.length)
            return { items, total: totalGroups }
          }
          // 兼容旧结构
          const items = Array.isArray(d) ? d : d?.items ?? d?.questions ?? []
          const total = d?.total ?? d?.pagination?.total ?? (Array.isArray(d) ? d.length : 0)
          return { items, total }
        }}
      />
    </div>
  )
}
