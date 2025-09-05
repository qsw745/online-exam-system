// features/tasks/hooks/useUsersGroupedTree.ts
import { App } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import * as http from '@shared/api/http'

export function useUsersGroupedTree() {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<any[]>([])

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const r = await http.users.getAll({ page: 1, limit: 1000 })
        if (r.success) {
          const p: any = r.data
          const list = Array.isArray(p) ? p : p?.users ?? p?.items ?? p?.list ?? []
          setUsers(Array.isArray(list) ? list : [])
        }
      } catch (e: any) {
        console.error(e)
        message.error(e?.message || '加载用户失败')
      } finally {
        setLoading(false)
      }
    })()
  }, [message])

  const treeData = useMemo(() => {
    const group = (role: string, title: string) => ({
      title,
      value: role,
      key: role,
      selectable: false,
      children: users
        .filter(u => u.role === role)
        .map((u: any) => ({
          title: `${u.username} (${u.email})`,
          value: String(u.id),
          key: String(u.id),
        })),
    })
    return [group('admin', '管理员'), group('teacher', '教师'), group('student', '学生')]
  }, [users])

  return { loading, treeData }
}
