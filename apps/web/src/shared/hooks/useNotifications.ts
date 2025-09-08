// src/shared/hooks/useNotifications.ts
import { App, Form } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, isSuccess, getErr, type ApiResult } from '@shared/api/http'

// —— 最小类型定义，避免外部类型名不一致 —— //
export type NotificationType = 'info' | 'success' | 'warning' | 'error' | string
export interface NotificationDTO {
  id: number
  title: string
  content: string
  type: NotificationType
  user_id?: number
  created_at?: string
  [k: string]: any
}
export interface UserDTO {
  id: number
  name?: string
  role?: string
  [k: string]: any
}

export interface CreateNotificationForm {
  title: string
  content: string
  type: NotificationType
  user_ids?: number[]
  send_to_all?: boolean
  role_filter?: string
}

export function useNotifications() {
  const { message } = App.useApp()

  // 列表 & 分页
  const [notifications, setNotifications] = useState<NotificationDTO[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)

  // 用户
  const [users, setUsers] = useState<UserDTO[]>([])

  // 表单
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<NotificationDTO | null>(null)
  const [form] = Form.useForm<CreateNotificationForm>()

  const loadNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get<any>('/notifications', { params: { page, limit: pageSize } })
      if (!isSuccess(r)) throw new Error(getErr(r, '获取通知列表失败'))
      const data = r.data
      const items: NotificationDTO[] = Array.isArray(data) ? data : data?.items ?? data?.list ?? []
      const t = data?.total ?? data?.count ?? items.length
      setNotifications(items)
      setTotal(t)
    } catch (e) {
      console.error(e)
      setNotifications([])
      setTotal(0)
      message.error('获取通知列表失败')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, message])

  const loadUsers = useCallback(async () => {
    try {
      const r: ApiResult<UserDTO[]> = await api.get('/users')
      if (isSuccess(r)) setUsers(r.data ?? [])
      else setUsers([])
    } catch (e) {
      console.error(e)
      setUsers([])
    }
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])
  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  // 新建 / 编辑
  const onCreate = () => {
    setEditing(null)
    form.resetFields()
    setOpen(true)
  }
  const onEdit = (row: NotificationDTO) => {
    setEditing(row)
    form.setFieldsValue({ title: row.title, content: row.content, type: row.type })
    setOpen(true)
  }
  const onDelete = async (id: number) => {
    try {
      const r = await api.delete(`/notifications/${id}`)
      if (!isSuccess(r)) throw new Error(getErr(r, '删除失败'))
      message.success('删除成功')
      loadNotifications()
    } catch {
      message.error('删除失败')
    }
  }

  const onSubmit = async (values: CreateNotificationForm) => {
    try {
      if (editing) {
        // 更新通知
        const r = await api.put(`/notifications/${editing.id}`, {
          title: values.title,
          content: values.content,
          type: values.type,
        })
        if (!isSuccess(r)) throw new Error(getErr(r, '更新失败'))
        message.success('更新成功')
      } else {
        // 发送通知
        let targetIds: number[] = []
        if (values.send_to_all) {
          targetIds = users.map(u => u.id)
          if (values.role_filter) targetIds = users.filter(u => u.role === values.role_filter).map(u => u.id)
        } else if (values.user_ids?.length) {
          targetIds = values.user_ids
        } else {
          message.error('请选择接收通知的用户')
          return
        }

        if (targetIds.length <= 1) {
          const r = await api.post('/notifications', {
            user_id: targetIds[0],
            title: values.title,
            content: values.content,
            type: values.type,
          })
          if (!isSuccess(r)) throw new Error(getErr(r, '发送失败'))
          message.success('通知发送成功')
        } else {
          // 优先尝试批量接口，不存在则降级为逐个发送
          try {
            const r = await api.post('/notifications/batch', {
              user_ids: targetIds,
              title: values.title,
              content: values.content,
              type: values.type,
            })
            if (!isSuccess(r)) throw new Error(getErr(r, '批量发送失败'))
            const cnt = (r.data as any)?.count ?? targetIds.length
            message.success(`成功发送给 ${cnt} 个用户`)
          } catch {
            await Promise.all(
              targetIds.map(id =>
                api.post('/notifications', {
                  user_id: id,
                  title: values.title,
                  content: values.content,
                  type: values.type,
                })
              )
            )
            message.success(`成功发送给 ${targetIds.length} 个用户`)
          }
        }
      }
      setOpen(false)
      form.resetFields()
      loadNotifications()
    } catch (e) {
      console.error(e)
      message.error(editing ? '更新失败' : '发送失败')
    }
  }

  const typeColor = useMemo(
    () => ({
      info: 'blue',
      success: 'green',
      warning: 'orange',
      error: 'red',
    }),
    []
  )

  return {
    // list
    notifications,
    loading,
    page,
    pageSize,
    total,
    setPage,
    setPageSize,
    loadNotifications,

    // users
    users,

    // form
    form,
    open,
    setOpen,
    editing,
    onCreate,
    onEdit,
    onDelete,
    onSubmit,

    // utils
    typeColor,
  }
}
