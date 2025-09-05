import React from 'react'
import { Button, Card, Modal, Typography, message } from 'antd'
import QuestionToolbar from '../components/QuestionToolbar'
import QuestionTable from '../components/QuestionTable'
import { useQuestionQuery } from '../hooks/useQuestionQuery'
import { useQuestionSelection } from '../hooks/useQuestionSelection'
import { useImportQuestions } from '../hooks/useImportQuestions'
import AddQuestionModal from '../components/AddQuestionModal'
import ImportModal from '../components/ImportModal'

const { Title, Paragraph } = Typography

export default function QuestionManagementPage() {
  const q = useQuestionQuery()
  const sel = useQuestionSelection(
    q.list.map(i => i.id),
    q.reload
  )
  const imp = useImportQuestions(q.reload, () => q.reload()) // 导入后刷新列表+标签

  // 单条删除（用选择弹窗复用 UI）
  const [single, setSingle] = React.useState<{ id: string; content: string } | null>(null)

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

      {/* 单个删除（复用 UI） */}
      <Modal
        title="确认删除"
        open={!!single}
        onCancel={() => setSingle(null)}
        onOk={async () => {
          if (!single) return
          const r = await (await import('../api')).questionsApi.delete(single.id)
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

      {/* 导入/新增 */}
      <ImportModal
        open={imp.open}
        onClose={() => imp.setOpen(false)}
        file={imp.file}
        setFile={imp.setFile}
        loading={imp.loading}
        progress={imp.progress}
        onStart={imp.startImport}
      />

      <AddQuestionModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onOk={() => {
          setAddOpen(false)
          q.reload()
        }}
      />
    </div>
  )
}

let addOpen = false
function setAddOpen(v: boolean) {
  addOpen = v
}
