// src/features/tasks/pages/PublishTaskPage.tsx
import React, { useMemo, useState, useCallback, useEffect } from 'react'
import { Breadcrumb, Card, Space, App } from 'antd'
import { PublishTaskForm } from '../components/PublishTaskForm'
import { UsersTable, type User } from '../../users/components/UsersTable'
import { users as usersApi } from '@/shared/api/endpoints/users'
import {  tasksApi } from '@/shared/api/endpoints/tasks'
import { isSuccess } from '@/shared/api/http'

type ApiUser = Partial<User> & {
  id: number
  username: string
  email: string
}

const normalizeUser = (u: ApiUser): User => ({
  id: Number(u.id),
  username: String(u.username ?? ''),
  email: String(u.email ?? ''),
  status: String(u.status ?? 'active'),
  created_at: typeof u.created_at === 'string' ? u.created_at : '',
})

const PublishTaskPage: React.FC = () => {
  const { message } = App.useApp()

  // —— 用户列表（本页内联查询，避免依赖丢失） ——
  const [rows, setRows] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      const r: any = await (usersApi as any).list?.({ page, limit: pageSize })
      if (!isSuccess(r)) {
        message.error(r?.error || r?.message || '加载用户失败')
        setRows([])
        setTotal(0)
        return
      }
      const d = r.data
      if (Array.isArray(d)) {
        const list = (d as ApiUser[]).map(normalizeUser)
        setRows(list)
        setTotal(list.length)
      } else if (d && typeof d === 'object') {
        const arr = (d.items ?? d.users ?? d.rows ?? []) as ApiUser[]
        const list = Array.isArray(arr) ? arr.map(normalizeUser) : []
        setRows(list)
        const pg = d.pagination ?? {}
        setTotal(pg.total ?? d.total ?? list.length ?? 0)
      } else {
        setRows([])
        setTotal(0)
      }
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, message])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // —— 选人 & 提交 ——
  const [submitting, setSubmitting] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])

  const options = useMemo(() => rows.map(u => ({ label: `${u.username}（${u.email}）`, value: u.id })), [rows])

  const onSubmit = async (payload: any) => {
    try {
      setSubmitting(true)
      // 若表单没选 assignees，则用表格勾选
      if ((!payload.assigned_user_ids || payload.assigned_user_ids.length === 0) && selectedRowKeys.length) {
        payload.assigned_user_ids = selectedRowKeys as number[]
      }

      const resp: any = (tasksApi as any).create
        ? await (tasksApi as any).create(payload)
        : await (tasksApi as any).publish?.(payload) // 兜底兼容
      if (!isSuccess(resp)) throw new Error(resp?.error || resp?.message || '发布失败')

      message.success('发布成功')
      setSelectedRowKeys([])
      fetchUsers()
    } catch (e: any) {
      console.error(e)
      message.error(e?.message || '发布失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Breadcrumb items={[{ title: '任务管理', href: '/tasks' }, { title: '发布任务' }]} />

      <Card title="发布任务" variant="outlined">
        <PublishTaskForm usersForSelect={options} loading={submitting} onSubmit={onSubmit} />
      </Card>

      <Card title="可选用户（从这里勾选也可）" variant="outlined">
        <UsersTable
          data={rows}
          loading={loading}
          selectedRowKeys={selectedRowKeys}
          onSelectChange={setSelectedRowKeys}
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={(p, ps) => {
            setPage(p)
            setPageSize(ps)
          }}
        />
      </Card>
    </Space>
  )
}
export default PublishTaskPage
