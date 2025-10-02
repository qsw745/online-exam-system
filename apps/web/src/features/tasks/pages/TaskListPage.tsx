import React from 'react'
import { Breadcrumb, Card, Pagination, Space, App, Input, Select, DatePicker, Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import { TasksTable } from '../components/TasksTable'
import { useTasksQuery, type TaskFilters } from '../hooks/useTasksQuery'
import { tasksApi } from '@/shared/api/endpoints/tasks'
import { isSuccess } from '@/shared/api/http'


const { RangePicker } = DatePicker

const TaskListPage: React.FC = () => {
  const { message: msg } = App.useApp()
  const nav = useNavigate()

  const { rows, total, page, pageSize, setPage, setPageSize, loading, filters, search, reset, refetch } =
    useTasksQuery()

  const [kw, setKw] = React.useState(filters.keyword || '')
  const [st, setSt] = React.useState(filters.status || 'all')
  const [rg, setRg] = React.useState(filters.range || null)

  const applySearch = () => {
    const next: TaskFilters = {
      keyword: kw || undefined,
      status: st || 'all',
      range: rg && (rg as any)?.length === 2 ? (rg as any) : null,
    }
    search(next)
  }

  const onPublish = async (id: string) => {
    try {
      const r: any = (tasksApi as any).update?.(id, { status: 'published' }) ?? (tasksApi as any).publish?.(id)
      const ret = await r
      if (!isSuccess(ret)) throw new Error(ret?.error || ret?.message || '发布失败')
      msg.success('发布成功')
      refetch()
    } catch (e: any) {
      msg.error(e?.message || '发布失败')
    }
  }

  const onUnpublish = async (id: string) => {
    try {
      const r: any = (tasksApi as any).update?.(id, { status: 'draft' }) ?? (tasksApi as any).unpublish?.(id)
      const ret = await r
      if (!isSuccess(ret)) throw new Error(ret?.error || ret?.message || '下线失败')
      msg.success('已下线')
      refetch()
    } catch (e: any) {
      msg.error(e?.message || '下线失败')
    }
  }

  const onDelete = async (id: string) => {
    try {
      const r: any =
        (tasksApi as any).delete?.(id) ??
        (tasksApi as any).remove?.(id) ??
        (tasksApi as any).destroy?.(id) ??
        (tasksApi as any).del?.(id)
      const ret = await r
      if (!isSuccess(ret)) throw new Error(ret?.error || ret?.message || '删除失败')
      msg.success('删除成功')
      if (rows.length === 1 && page > 1) {
        setPage(page - 1)
      } else {
        refetch()
      }
    } catch (e: any) {
      msg.error(e?.message || '删除失败')
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {/* <Breadcrumb items={[{ title: '任务管理', href: '/admin/tasks/list' }, { title: '任务列表' }]} /> */}
      {/* ✅ 公共面包屑：默认自动根据菜单生成 */}
    

      <Card title="任务列表" variant="outlined">
        <Space wrap>
          <Input
            placeholder="关键词"
            allowClear
            value={kw}
            onChange={e => setKw(e.target.value)}
            onPressEnter={applySearch}
            style={{ width: 240 }}
          />
          <Select
            style={{ width: 160 }}
            value={st}
            onChange={setSt}
            options={[
              { value: 'all', label: '全部状态' },
              { value: 'draft', label: '草稿（可发布）' },
              { value: 'published', label: '已发布（可下线）' },
              { value: 'in_progress', label: '进行中' },
              { value: 'completed', label: '已完成' },
              { value: 'archived', label: '已归档' },
            ]}
          />
          <RangePicker value={rg as any} onChange={v => setRg((v as any) || null)} showTime />
          <Button type="primary" onClick={applySearch}>
            查询
          </Button>
          <Button
            onClick={() => {
              setKw('')
              setSt('all')
              setRg(null)
              reset()
            }}
          >
            重置
          </Button>
        </Space>
      </Card>

      <Card variant="outlined">
        <TasksTable
          data={rows as any}
          loading={loading}
          onEdit={(id: string) => nav(`/admin/tasks/detail/${id}?edit=1`)} // ★ 直接进编辑态
          onPublish={onPublish}
          onUnpublish={onUnpublish}
          onDelete={onDelete}
          showPublishActions
        />
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            showSizeChanger
            showQuickJumper
            onChange={(p, ps) => {
              setPage(p)
              setPageSize(ps)
            }}
            showTotal={(t, r) => `共 ${t} 条，当前 ${r[0]}-${r[1]}`}
          />
        </div>
      </Card>
    </Space>
  )
}

export default TaskListPage
