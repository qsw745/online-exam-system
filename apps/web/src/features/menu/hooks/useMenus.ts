// src/features/menu/hooks/useMenus.ts
import { menuApi, type MenuDTO } from '@shared/api/endpoints/menu'
import { App } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { STEP, buildLayerUpdates, isInSubtree } from '../../../shared/utils/tree'

export type MenuFormData = {
  name: string
  title: string
  path?: string
  component?: string
  icon?: string
  parent_id?: number | null
  sort_order?: number
  is_hidden?: boolean
  is_disabled?: boolean
  menu_type: 'menu' | 'button' | 'page'
  permission_code?: string
  redirect?: string
  meta?: string
}

export function useMenus() {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [menus, setMenus] = useState<MenuDTO[]>([])

  // 表单弹窗
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<MenuDTO | null>(null)

  // 批量排序弹窗
  const [sortOpen, setSortOpen] = useState(false)
  const [sortItems, setSortItems] = useState<MenuDTO[]>([])

  const parentOptions = useMemo(
    () => menus.filter(m => m.menu_type === 'menu').map(m => ({ label: m.title, value: m.id })),
    [menus]
  )

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const ret: any = await menuApi.list()
      let list: MenuDTO[] = []

      if (Array.isArray(ret)) {
        list = ret as MenuDTO[]
      } else if (ret && typeof ret === 'object') {
        const data = (ret as any).data ?? (ret as any).items ?? (ret as any).menus ?? []
        if (Array.isArray(data)) list = data as MenuDTO[]
      }

      setMenus(Array.isArray(list) ? list : [])
      if (!Array.isArray(list)) {
        // 非致命，给个提示
        message.warning('菜单数据格式异常，已为空展示')
      }
    } catch {
      setMenus([]) // 防御：出现 404/网络错时不再抛到 UI
      message.error('加载菜单失败')
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (m: MenuDTO) => {
    setEditing(m)
    setFormOpen(true)
  }
  const copyToCreate = (m: MenuDTO) => {
    // 返回预填表单值
    const meta = (() => {
      if (!m.meta) return ''
      try {
        return JSON.stringify(JSON.parse(m.meta), null, 2)
      } catch {
        return m.meta
      }
    })()
    return {
      name: `${m.name}_copy`,
      title: `${m.title}(副本)`,
      path: m.path,
      component: m.component,
      icon: m.icon,
      parent_id: m.parent_id ?? null,
      sort_order: (m.sort_order ?? 0) + 1,
      is_hidden: m.is_hidden,
      is_disabled: m.is_disabled,
      menu_type: m.menu_type,
      permission_code: m.permission_code,
      redirect: m.redirect,
      meta,
    } as Partial<MenuFormData>
  }

  const remove = async (id: number) => {
    try {
      const ret = await menuApi.remove(id)
      const ok = (ret as any)?.success !== false
      ok ? message.success('删除成功') : message.error((ret as any)?.message || '删除失败')
      await load()
    } catch {
      message.error('删除失败')
    }
  }

  const save = async (values: MenuFormData) => {
    const payload: MenuFormData = { ...values }
    if (payload.meta) {
      try {
        payload.meta = JSON.stringify(JSON.parse(payload.meta))
      } catch {}
    }
    const ret = editing ? await menuApi.update(editing.id, payload) : await menuApi.create(payload)
    const ok = (ret as any)?.success !== false
    ok ? message.success(editing ? '更新成功' : '创建成功') : message.error((ret as any)?.message || '操作失败')
    if (ok) {
      setFormOpen(false)
      await load()
    }
  }

  // Tree 拖拽：换父级 + 同层重排
  const onTreeDrop = async (info: any) => {
    const { dragNode, node, dropPosition, dropToGap } = info
    if (!dragNode || !node) return
    const draggedId = Number(dragNode.key)
    const targetId = Number(node.key)
    const map = new Map(menus.map(m => [m.id, m]))
    const dragged = map.get(draggedId)
    const target = map.get(targetId)
    if (!dragged || !target) return

    const newParentId: number | null = dropToGap ? target.parent_id ?? null : target.id
    if (isInSubtree(menus, draggedId, newParentId)) {
      message.warning('不能拖到自己的子级下')
      return
    }

    const siblings = menus
      .filter(m => (m.parent_id ?? null) === (newParentId ?? null) && m.id !== dragged.id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

    const targetIdx = siblings.findIndex(s => s.id === target.id)
    const insertIdx = dropToGap ? (dropPosition < 0 ? targetIdx : targetIdx + 1) : siblings.length
    const nextLayer = [...siblings]
    nextLayer.splice(insertIdx, 0, { ...dragged, parent_id: newParentId })
    const updates = buildLayerUpdates(nextLayer, dragged.id, newParentId)

    try {
      const ret = await menuApi.batchSort(updates)
      const ok = (ret as any)?.success !== false
      ok ? message.success('菜单结构已更新') : message.error((ret as any)?.message || '更新失败')
      if (ok) await load()
    } catch {
      message.error('更新失败')
    }
  }

  // 批量排序
  const openBatchSort = () => {
    setSortItems([...menus].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)))
    setSortOpen(true)
  }
  const saveBatchSort = async () => {
    try {
      const updates = sortItems.map((m, i) => ({ id: m.id, sort_order: i * STEP }))
      const ret = await menuApi.batchSort(updates)
      const ok = (ret as any)?.success !== false
      ok ? message.success('批量排序更新成功') : message.error((ret as any)?.message || '批量排序更新失败')
      if (ok) {
        setSortOpen(false)
        await load()
      }
    } catch {
      message.error('批量排序更新失败')
    }
  }

  // 导入/导出
  const exportJSON = () => {
    const exportData = menus.map(m => ({
      name: m.name,
      title: m.title,
      path: m.path,
      component: m.component,
      icon: m.icon,
      parent_id: m.parent_id ?? null,
      sort_order: m.sort_order,
      is_hidden: m.is_hidden,
      is_disabled: m.is_disabled,
      menu_type: m.menu_type,
      permission_code: m.permission_code,
      redirect: m.redirect,
      meta: m.meta,
    }))
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `menu-config-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    message.success('菜单配置已导出')
  }

  const importJSON = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0]
      if (!file) return
      const text = await file.text()
      try {
        const arr = JSON.parse(text)
        if (!Array.isArray(arr)) throw new Error('格式错误')
        // TODO：可在此调用后端批量创建接口
        message.success(`准备导入 ${arr.length} 个菜单项`)
      } catch {
        message.error('导入文件解析失败，请检查格式')
      }
      e.target.value = ''
    }
    input.click()
  }

  return {
    loading,
    menus,
    // form
    formOpen,
    setFormOpen,
    editing,
    openCreate,
    openEdit,
    copyToCreate,
    save,
    remove,
    // tree
    onTreeDrop,
    // batch sort
    sortOpen,
    setSortOpen,
    sortItems,
    setSortItems,
    openBatchSort,
    saveBatchSort,
    // options
    parentOptions,
    // io
    exportJSON,
    importJSON,
  }
}
