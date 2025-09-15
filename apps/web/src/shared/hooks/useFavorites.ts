import { useCallback, useEffect, useMemo, useState } from 'react'
import { App } from 'antd'
import { favoritesApi, type Favorite, type FavoriteItem } from '@/shared/api/endpoints/favorites'

/** 将后端返回的字段做统一规范化（尤其 is_public 可能是 0/1） */
function normalizeFavorite(f: any): Favorite {
  return {
    ...f,
    // 关键：把 0/1/true/false 统一成 boolean，避免在 JSX 中渲染出数字 0
    is_public: !!f?.is_public,
    // 计数类字段转 number，避免 undefined/字符串参与运算
    items_count: Number(f?.items_count ?? 0),
    // 可能为空的外键统一成 null
    category_id: f?.category_id ?? null,
  } as Favorite
}

export function useFavorites() {
  const { message } = App.useApp()

  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [items, setItems] = useState<FavoriteItem[]>([])

  const [loading, setLoading] = useState(true)
  const [itemsLoading, setItemsLoading] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const selected = useMemo(() => favorites.find(f => f.id === selectedId) ?? null, [favorites, selectedId])

  const fetchFavorites = useCallback(async () => {
    try {
      setLoading(true)
      const list = await favoritesApi.list()
      const normalized = Array.isArray(list) ? list.map(normalizeFavorite) : []
      setFavorites(normalized)
      if (!selectedId && normalized.length > 0) setSelectedId(normalized[0].id)
    } catch (e: any) {
      console.error(e)
      message.error('获取收藏夹失败')
    } finally {
      setLoading(false)
    }
  }, [message, selectedId])

  const fetchItems = useCallback(
    async (fid: number) => {
      try {
        setItemsLoading(true)
        const list = await favoritesApi.items(fid)
        setItems(list ?? [])
      } catch (e: any) {
        console.error(e)
        message.error('获取收藏夹内容失败')
      } finally {
        setItemsLoading(false)
      }
    },
    [message]
  )

  const createFavorite = useCallback(
    async (payload: Partial<Favorite>) => {
      // 未选择分类显式传 null
      const created = await favoritesApi.create({ ...payload, category_id: payload.category_id ?? null })
      if (!created) throw new Error('创建失败')
      const normalized = normalizeFavorite(created)
      setFavorites(prev => [normalized, ...prev])
      setSelectedId(normalized.id)
      message.success('创建收藏夹成功')
    },
    [message]
  )

  const updateFavorite = useCallback(
    async (payload: Partial<Favorite>) => {
      if (!selected) return
      const updated = await favoritesApi.update(selected.id, payload)
      if (!updated) throw new Error('更新失败')
      const normalized = normalizeFavorite(updated)
      setFavorites(prev => prev.map(f => (f.id === selected.id ? normalized : f)))
      message.success('更新收藏夹成功')
    },
    [message, selected]
  )

  const deleteFavorite = useCallback(
    async (fid: number) => {
      await favoritesApi.remove(fid)
      setFavorites(prev => prev.filter(f => f.id !== fid))
      if (selectedId === fid) {
        setSelectedId(null)
        setItems([])
      }
      message.success('删除收藏夹成功')
    },
    [message, selectedId]
  )

  const removeItem = useCallback(
    async (itemId: number) => {
      if (!selected) return
      await favoritesApi.removeItem(selected.id, itemId)
      setItems(prev => prev.filter(i => i.id !== itemId))
      setFavorites(prev =>
        prev.map(f => (f.id === selected.id ? { ...f, items_count: Math.max(0, Number(f.items_count ?? 0) - 1) } : f))
      )
      message.success('移除成功')
    },
    [message, selected]
  )

  const shareFavorite = useCallback(
    async (fid: number) => {
      const link = await favoritesApi.share(fid)
      if (!link) throw new Error('无分享链接')
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(link)
        message.success('分享链接已复制到剪贴板')
      } else {
        window.open(link, '_blank')
      }
    },
    [message]
  )

  useEffect(() => {
    fetchFavorites()
  }, [fetchFavorites])

  useEffect(() => {
    if (selectedId) fetchItems(selectedId)
  }, [selectedId, fetchItems])

  return {
    favorites,
    selected,
    selectedId,
    items,
    loading,
    itemsLoading,
    createOpen,
    editOpen,
    setSelectedId,
    setCreateOpen,
    setEditOpen,
    createFavorite,
    updateFavorite,
    deleteFavorite,
    removeItem,
    shareFavorite,
  }
}

export default useFavorites
