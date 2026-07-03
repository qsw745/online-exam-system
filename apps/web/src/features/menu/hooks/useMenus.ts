import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { App } from 'antd'
import { menuApi, type MenuDTO } from '@/shared/api/endpoints/menu'
import { STEP, buildLayerUpdates, isInSubtree, buildTreeData } from '@/shared/utils/tree'
import type { DataNode } from 'antd/es/tree'
import { translate } from '@/shared/utils/i18n'

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
  menu_type: 'menu' | 'button' | 'link'
  permission_code?: string
  redirect?: string
  meta?: string
}

type UseMenusOpts = { mode?: 'system' | 'unit'; unitId?: number }

export function useMenus({ mode = 'unit', unitId }: UseMenusOpts = {}) {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [menus, setMenus] = useState<MenuDTO[]>([])

  // 表单（仅用于编辑覆盖或编辑系统菜单）
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<MenuDTO | null>(null)

  // 批量排序
  const [sortOpen, setSortOpen] = useState(false)
  const [sortItems, setSortItems] = useState<MenuDTO[]>([])

  // —— 系统菜单选择（多选） —— //
  const [pickOpen, setPickOpen] = useState(false)
  const [sysLoading, setSysLoading] = useState(false)
  const [sysMenus, setSysMenus] = useState<MenuDTO[]>([])

  const parentOptions = useMemo(
    () => menus.filter(m => m.menu_type === 'menu').map(m => ({ label: m.title, value: m.id })),
    [menus]
  )

  const load = useCallback(async () => {
    if (mode === 'unit' && unitId == null) {
      setMenus([])
      return
    }
    try {
      setLoading(true)
      const list = await menuApi.list({ scope: mode, unitId })
      setMenus(Array.isArray(list) ? list : [])
      if (!Array.isArray(list)) message.warning(translate('auto.928b454334'))
    } catch {
      setMenus([])
      message.error(translate('menuList.messages.load_failed'))
    } finally {
      setLoading(false)
    }
  }, [message, mode, unitId])

  useEffect(() => {
    void load()
  }, [load])

  // 选择器候选：系统菜单 - 已覆盖的剔除，且不含按钮型
  const loadSystemForPick = useCallback(async () => {
    setSysLoading(true)
    try {
      const allSystem = await menuApi.list({ scope: 'system' })
      const coveredIds = new Set(menus.map(m => m.id))
      const candidates = (allSystem || []).filter(m => m.menu_type !== 'button').filter(m => !coveredIds.has(m.id))
      setSysMenus(candidates)
    } catch {
      setSysMenus([])
      message.error(translate('auto.c640df1cb9'))
    } finally {
      setSysLoading(false)
    }
  }, [menus, message])

  const sysTreeData: DataNode[] = useMemo(() => buildTreeData(sysMenus, m => `${m.title}`), [sysMenus])

  // —— 交互 —— //
  const openCreate = () => {
    if (mode === 'unit') {
      if (!unitId) {
        message.warning(translate('auto.9145818679'))
        return
      }
      setPickOpen(true)
      void loadSystemForPick()
      return
    }
    // 系统菜单真新增（如允许）
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (m: MenuDTO) => {
    setEditing(m)
    setFormOpen(true)
  }

  /** 多选确认：直接批量创建覆盖项，不再弹表单 */
  const onPickSystemOk = async (sysIds: number[]) => {
    if (!unitId) {
      message.warning(translate('auto.f299902d40'))
      return
    }
    if (!sysIds?.length) {
      setPickOpen(false)
      return
    }

    try {
      const results = await Promise.allSettled(
        sysIds.map(id => menuApi.create({ sys_menu_id: id } as any, { scope: 'unit', unitId }))
      )
      const okCount = results.filter(r => r.status === 'fulfilled').length
      const failCount = results.length - okCount
      if (okCount) message.success(`已添加 ${okCount} 个覆盖项`)
      if (failCount) message.warning(`${failCount} 个添加失败`)
      setPickOpen(false)
      await load()
    } catch {
      message.error(translate('auto.bed398754f'))
    }
  }

  const copyToCreate = (m: MenuDTO) => {
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
      const ret = await menuApi.remove(id, { scope: mode, unitId })
      const ok = (ret as any)?.success !== false
      ok
        ? message.success(mode === 'unit' ? translate('auto.a0b8cdb465') : translate('users.message.delete_success'))
        : message.error((ret as any)?.message || translate('orgs.message.delete_failed'))
      if (ok) await load()
    } catch {
      message.error(translate('orgs.message.delete_failed'))
    }
  }

  // 仅用于编辑（单位覆盖/系统菜单的属性）
  const save = async (values: MenuFormData) => {
    const payload: any = { ...values }
    if (payload.meta) {
      try {
        payload.meta = JSON.stringify(JSON.parse(payload.meta))
      } catch {}
    }

    let ok = false
    if (mode === 'unit') {
      if (!unitId) {
        message.warning(translate('auto.f299902d40'))
        return
      }
      const sysId = editing?.id
      if (!sysId) {
        message.warning(translate('auto.208ee7c22e'))
        return
      }
      const ret = await menuApi.update(sysId, payload, { scope: 'unit', unitId })
      ok = (ret as any)?.success !== false
    } else {
      if (editing) {
        const ret = await menuApi.update(editing.id, payload, { scope: 'system' })
        ok = (ret as any)?.success !== false
      } else {
        const ret = await menuApi.create(payload, { scope: 'system' })
        ok = (ret as any)?.success !== false
      }
    }

    ok ? message.success(translate('orgs.message.save_success')) : message.error(translate('app.operation_failed'))
    if (ok) {
      setFormOpen(false)
      await load()
    }
  }

  // Tree 拖拽排序
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
      message.warning(translate('auto.f01376d94d'))
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
      const ret = await menuApi.batchSort(updates, { scope: mode, unitId })
      const ok = (ret as any)?.success !== false
      ok ? message.success(translate('auto.f17047db8f')) : message.error((ret as any)?.message || translate('roles.message.update_failed'))
      if (ok) await load()
    } catch {
      message.error(translate('roles.message.update_failed'))
    }
  }

  const openBatchSort = () => {
    setSortItems([...menus].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)))
    setSortOpen(true)
  }
  const saveBatchSort = async () => {
    try {
      const updates = sortItems.map((m, i) => ({ id: m.id, sort_order: i * STEP }))
      const ret = await menuApi.batchSort(updates, { scope: mode, unitId })
      const ok = (ret as any)?.success !== false
      ok ? message.success(translate('auto.841f040d8c')) : message.error((ret as any)?.message || translate('auto.4386fbcfb5'))
      if (ok) {
        setSortOpen(false)
        await load()
      }
    } catch {
      message.error(translate('auto.4386fbcfb5'))
    }
  }

  return {
    // 数据
    loading,
    menus,
    // 表单（仅编辑用）
    formOpen,
    setFormOpen,
    editing,
    setEditing,
    // 选择系统菜单（多选）
    pickOpen,
    setPickOpen,
    sysLoading,
    sysTreeData,
    onPickSystemOk,
    // 动作
    openCreate,
    openEdit,
    save,
    remove,
    // 拖拽 & 排序
    onTreeDrop,
    sortOpen,
    setSortOpen,
    sortItems,
    setSortItems,
    openBatchSort,
    saveBatchSort,
    // 选项
    parentOptions,
    // 导入导出
    exportJSON: () => {
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
      message.success(translate('auto.b46d843492'))
    },
    importJSON: () => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.json'
      input.onchange = async (e: any) => {
        const file = e.target?.files?.[0]
        if (!file) return
        try {
          const arr = JSON.parse(await file.text())
          if (!Array.isArray(arr)) throw new Error(translate('auto.b8dbd7d3bf'))
          message.success(`准备导入 ${arr.length} 个菜单项`)
        } catch {
          message.error(translate('auto.af1a5b55ab'))
        }
        e.target.value = ''
      }
      input.click()
    },
  }
}
