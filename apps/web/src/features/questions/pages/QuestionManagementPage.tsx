// src/features/questions/pages/QuestionManagementPage.tsx
import { Card, Modal, Typography, message } from 'antd'
import React from 'react'
import { useImportQuestions } from '@/shared/hooks/useImportQuestions'
import { useQuestionQuery } from '@/shared/hooks/useQuestionQuery'
import { useQuestionSelection } from '@/shared/hooks/useQuestionSelection'
import QuestionTable from '../components/QuestionTable'
import QuestionToolbar from '../components/QuestionToolbar'

const { Title, Paragraph } = Typography

export default function QuestionManagementPage() {
  const q = useQuestionQuery()
  const sel = useQuestionSelection(
    q.list.map(i => i.id),
    q.reload
  )
  const imp = useImportQuestions(q.reload, () => q.reload())

  // 单条删除
  const [single, setSingle] = React.useState<{ id: string; content: string } | null>(null)
  // 新增题目弹窗开关（替换掉错误的模块级变量）
  const [addOpen, setAddOpen] = React.useState(false)

  return (
    <div style={{ padding: 24 }}>
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
            q.setPage(1)
          }}
          type={q.type}
          onTypeChange={v => {
            q.setType(v as any)
            q.setPage(1)
          }}
          selectedTags={q.selectedTags}
          onTagsChange={v => {
            q.setSelectedTags(v)
            q.setPage(1)
          }}
          allTags={q.allTags}
          onBatchDelete={() => sel.setDeleteModalVisible(true)}
          onOpenImport={() => imp.setOpen(true)}
          onOpenAdd={() => setAddOpen(true)}
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
            },
          }}
        />
      </Card>

      {/* 批量删除 */}
      <Modal
        title="确认删除"
        open={sel.deleteModalVisible}
        onCancel={() => sel.setDeleteModalVisible(false)}
        onOk={sel.batchDelete}
        okButtonProps={{ danger: true }}
        okText="确认删除"
      >
        确定要删除选中的 {sel.selected.length} 道题目吗？此操作无法撤销。
      </Modal>

      {/* 单个删除 */}
      <Modal
        title="确认删除"
        open={!!single}
        onCancel={() => setSingle(null)}
        onOk={async () => {
          if (!single) return
          const r = await (await import('@/shared/api/http')).questionsApi.remove(single.id)
          if ((r as any)?.success) {
            message.success('题目删除成功')
            q.reload()
          } else {
            message.error('删除题目失败')
          }
          setSingle(null)
        }}
        okButtonProps={{ danger: true }}
        okText="确认删除"
      >
        确定要删除题目 {single?.content ?? ''}？此操作无法撤销。
      </Modal>

      {/* 导入题目（用内联 Modal，避免 ImportModal 的 props 类型不匹配） */}
      <Modal
        title="导入题目"
        open={imp.open}
        onCancel={() => imp.setOpen(false)}
        onOk={imp.startImport}
        confirmLoading={imp.loading}
        okText={imp.loading ? `导入中… ${Math.round(imp.progress)}%` : '开始导入'}
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <input type="file" accept=".xlsx,.xls,.csv,.json" onChange={e => imp.setFile(e.target.files?.[0] ?? null)} />
          {imp.progress > 0 && <div>进度：{Math.round(imp.progress)}%</div>}
          <div style={{ color: '#999' }}>请选择题目文件后点击「开始导入」。</div>
        </div>
      </Modal>

      {/* 新增题目（简单占位） */}
      <Modal
        title="新增题目"
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        onOk={() => {
          setAddOpen(false)
          q.reload()
        }}
        okText="保存"
      >
        <div style={{ color: '#999' }}>这里可以放新增题目的表单（占位）。</div>
      </Modal>
    </div>
  )
}
