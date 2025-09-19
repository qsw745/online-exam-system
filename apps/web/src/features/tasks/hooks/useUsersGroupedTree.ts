import { App } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import * as http from '@/shared/api/http'

/**
 * 分组为 角色 → 用户 的 TreeSelect 数据
 * 注意：key 必须与 value 一致，避免 Antd 警告
 */
export function useUsersGroupedTree() {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<any[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r: any = await http.users.getAll?.({ page: 1, limit: 1000 })
      const payload = r?.data ?? r
      const list =
        (payload?.users as any[]) ?? payload?.items ?? payload?.list ?? (Array.isArray(payload) ? payload : []) ?? []
      setUsers(Array.isArray(list) ? list : [])
    } catch (e: any) {
      console.error(e)
      message.error(e?.message || '加载用户失败')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    load()
  }, [load])

  const treeData = useMemo(() => {
    const byRole: Record<string, any[]> = { admin: [], teacher: [], student: [] }
    for (const u of users) {
      const role = String(u.role || 'student')
      const title = `${u.nickname || u.username || `用户${u.id}`} (${u.email || '无邮箱'})`
      byRole[role] = byRole[role] || []
      byRole[role].push({
        title,
        value: String(u.id),
        key: String(u.id), // 关键：与 value 一致
        selectable: true,
        isLeaf: true,
      })
    }
    const mk = (role: string, label: string) =>
      byRole[role]?.length
        ? {
            title: label,
            value: `role-${role}`,
            key: `role-${role}`, // 非可选分组节点也保持一致
            selectable: false,
            children: byRole[role],
          }
        : null

    return [mk('admin', '管理员'), mk('teacher', '教师'), mk('student', '学生')].filter(Boolean) as any[]
  }, [users])

  return { loading, treeData, reload: load }
}
