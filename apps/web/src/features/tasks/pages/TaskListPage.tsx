import React from 'react'
import { Breadcrumb, Card, Space, App, Input, Select, DatePicker, Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import { TasksTable } from '../components/TasksTable'
import { useTasksQuery, type TaskFilters, type Task } from '../hooks/useTasksQuery'
import { tasksApi } from '@/shared/api/endpoints/tasks'
import { isSuccess } from '@/shared/api/http'
import GlobalPagination from '@/shared/components/GlobalPagination'
import { translate } from '@/shared/utils/i18n'

const { RangePicker } = DatePicker

const TaskListPage: React.FC = () => {
  const { message: msg } = App.useApp()
  const nav = useNavigate()

  const { rows, total, page, pageSize, setPage, setPageSize, loading, filters, search, reset, refetch } =
    useTasksQuery()

  const [kw, setKw] = React.useState(filters.keyword || '')
  const [st, setSt] = React.useState(filters.status || 'all')
  const [rg, setRg] = React.useState(filters.range || null)

  const [statusOverrides, setStatusOverrides] = React.useState<Record<string, Task['status']>>({})

  const displayRows = React.useMemo(() => {
    if (!rows?.length) return rows as Task[]
    return rows.map(row => {
      const override = statusOverrides[String(row.id)]
      return override ? { ...row, status: override } : row
    })
  }, [rows, statusOverrides])

  const overrideStatus = React.useCallback((id: string, status: Task['status']) => {
    setStatusOverrides(prev => {
      if (prev[id] === status) return prev
      return { ...prev, [id]: status }
    })
  }, [])

  React.useEffect(() => {
    if (!rows.length) return
    setStatusOverrides(prev => {
      let changed = false
      const next = { ...prev }
      for (const row of rows) {
        const key = String(row.id)
        if (key in next && next[key] === row.status) {
          delete next[key]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [rows])

  const applySearch = () => {
    const next: TaskFilters = {
      keyword: kw || undefined,
      status: st || 'all',
      range: rg && (rg as any)?.length === 2 ? (rg as any) : null,
    }
    search(next)
  }

  const onPublish = async (id: string) => {
    const idStr = String(id)
    try {
      const r: any =
        (tasksApi as any).publish?.(id) ?? (tasksApi as any).update?.(id, { status: 'published' }) ?? null
      if (!r) throw new Error(translate('auto.2dae2f9d6e'))
      const ret = await r
      if (!isSuccess(ret)) throw new Error(ret?.error || ret?.message || '发布失败')
      overrideStatus(idStr, 'published')
      msg.success('发布成功')
      await refetch()
    } catch (e: any) {
      msg.error(e?.message || '发布失败')
    }
  }

  const onUnpublish = async (id: string) => {
    const idStr = String(id)
    try {
      const r: any =
        (tasksApi as any).unpublish?.(id) ??
        (tasksApi as any).update?.(id, { status: 'unpublished' }) ??
        (tasksApi as any).update?.(id, { status: 'draft' }) ??
        null
      if (!r) throw new Error(translate('auto.a6cbe101e5'))
      const ret = await r
      if (!isSuccess(ret)) throw new Error(ret?.error || ret?.message || '下线失败')
      overrideStatus(idStr, 'unpublished')
      msg.success('已下线')
      await refetch()
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
    

      <Card title={translate('menus.task-list')} variant="outlined">
        <Space wrap>
          <Input
            placeholder={translate('aiLogs.keyword')}
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
              { value: 'all', label: translate('auto.1a4c26d92d') },
              { value: 'draft', label: translate('auto.ce31ef5e32') },
              { value: 'published', label: translate('auto.39c964cb0f') },
              { value: 'in_progress', label: translate('dashboard.status_in_progress') },
              { value: 'completed', label: translate('dashboard.status_completed') },
              { value: 'archived', label: translate('auto.5cfbea2b76') },
            ]}
          />
          <RangePicker value={rg as any} onChange={v => setRg((v as any) || null)} showTime />
          <Button type="primary" onClick={applySearch}>
            {translate('auto.711363c424')}</Button>
          <Button
            onClick={() => {
              setKw('')
              setSt('all')
              setRg(null)
              reset()
            }}
          >
            {translate('app.reset')}</Button>
        </Space>
      </Card>

      <Card variant="outlined">
        <TasksTable
          data={displayRows as any}
          loading={loading}
          onEdit={(id: string) => nav(`/admin/tasks/detail/${id}?edit=1`)} // ★ 直接进编辑态
          onPublish={onPublish}
          onUnpublish={onUnpublish}
          onDelete={onDelete}
          showPublishActions
        />
        <GlobalPagination
          current={page}
          pageSize={pageSize}
          total={total}
          onChange={(p, size) => {
            setPage(p)
            setPageSize(size)
          }}
        />
      </Card>
    </Space>
  )
}

export default TaskListPage
