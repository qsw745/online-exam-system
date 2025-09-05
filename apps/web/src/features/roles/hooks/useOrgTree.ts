// hooks/useOrgTree.ts
import { useState } from 'react'
import { App } from 'antd'
import { OrgAPI as orgs } from '@features/orgs/api'
import { roleService } from '../services/roles'
import { isSuccess, getMsg } from '../utils/apiResult'

export function useOrgTree() {
  const { message } = App.useApp()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [tree, setTree] = useState<any[]>([])
  const [checked, setChecked] = useState<number[]>([])
  const [roleId, setRoleId] = useState<number | null>(null)

  const build = (nodes: any[] = []) =>
    nodes.map(n => ({ key: n.id, title: n.name, children: n.children ? build(n.children) : undefined }))

  const showFor = async (rid: number) => {
    setRoleId(rid)
    setChecked([])
    setLoading(true)
    try {
      const r = await orgs.tree()
      if (!isSuccess(r)) throw new Error(getMsg(r, '加载机构树失败'))
      setTree(build(r.data || []))
      setOpen(true)
    } catch (e: any) {
      message.error(e.message)
      setTree([])
    } finally {
      setLoading(false)
    }
  }

  const submit = async () => {
    if (!roleId) return
    const r = await roleService.addOrgs(roleId, checked)
    if (!isSuccess(r)) return message.error(getMsg(r, '机构关联失败'))
    message.success('机构关联成功')
    setOpen(false)
    setChecked([])
  }

  return { open, setOpen, loading, tree, checked, setChecked, showFor, submit }
}
