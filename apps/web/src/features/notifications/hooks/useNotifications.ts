import { App, Form } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { notificationsApi, type NotificationDTO, type NotificationType } from '../api/notifications'
import { usersApi, type UserDTO } from '../api/users'

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
    try {
      setLoading(true)
      const { items, total } = await notificationsApi.adminList({ page, limit: pageSize })
      setNotifications(items)
      setTotal(total || items.length) // 兼容未返回 total 的情况
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
      const list = await usersApi.list()
      setUsers(list)
    } catch (e) {
      console.error(e)
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
      await notificationsApi.remove(id)
      message.success('删除成功')
      loadNotifications()
    } catch {
      message.error('删除失败')
    }
  }

  const onSubmit = async (values: CreateNotificationForm) => {
    try {
      if (editing) {
        // ✅ 编辑改为更新通知内容，而不是再次“发送”
        await notificationsApi.update(editing.id, {
          title: values.title,
          content: values.content,
          type: values.type,
        })
        message.success('更新成功')
      } else {
        if (values.send_to_all) {
          // 发送给所有用户或按角色
          let ids = users.map(u => u.id)
          if (values.role_filter) ids = users.filter(u => u.role === values.role_filter).map(u => u.id)
          const ret = await notificationsApi.batch({
            user_ids: ids,
            title: values.title,
            content: values.content,
            type: values.type,
          })
          message.success(`成功发送给 ${ret?.count ?? ids.length} 个用户`)
        } else if (values.user_ids?.length) {
          if (values.user_ids.length === 1) {
            await notificationsApi.create({
              user_id: values.user_ids[0],
              title: values.title,
              content: values.content,
              type: values.type,
            })
            message.success('通知发送成功')
          } else {
            const ret = await notificationsApi.batch({
              user_ids: values.user_ids,
              title: values.title,
              content: values.content,
              type: values.type,
            })
            message.success(`成功发送给 ${ret?.count ?? values.user_ids.length} 个用户`)
          }
        } else {
          message.error('请选择接收通知的用户')
          return
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
