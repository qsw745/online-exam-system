// src/shared/hooks/useFavorites.ts
import { useCallback, useEffect, useMemo, useState } from 'react'
import { App } from 'antd'
import { favoritesApi, type Favorite, type FavoriteCategory, type FavoriteItem } from '@/shared/api/endpoints/favorites'

export function useFavorites() {
  const { message } = App.useApp()

  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [items, setItems] = useState<FavoriteItem[]>([])
  const [categories, setCategories] = useState<FavoriteCategory[]>([])

  const [loading, setLoading] = useState(true)
  const [itemsLoading, setItemsLoading] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const selected = useMemo(() => favorites.find(f => f.id === selectedId) ?? null, [favorites, selectedId])

  const fetchFavorites = useCallback(async () => {
    try {
      setLoading(true)
      const list = await favoritesApi.list()
      setFavorites(list)
      if (!selectedId && list.length > 0) setSelectedId(list[0].id)
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
        setItems(list)
      } catch (e: any) {
        console.error(e)
        message.error('获取收藏夹内容失败')
      } finally {
        setItemsLoading(false)
      }
    },
    [message]
  )

  const fetchCategories = useCallback(async () => {
    try {
      const list = await favoritesApi.categories()
      setCategories(list)
    } catch {
      // 静默
    }
  }, [])

  const createFavorite = useCallback(
    async (payload: Partial<Favorite>) => {
      // 未选择分类时，确保传 null
      const created = await favoritesApi.create({ ...payload, category_id: payload.category_id ?? null })
      if (!created) throw new Error('创建失败')
      setFavorites(prev => [created, ...prev])
      setSelectedId(created.id)
      message.success('创建收藏夹成功')
    },
    [message]
  )

  const updateFavorite = useCallback(
    async (payload: Partial<Favorite>) => {
      if (!selected) return
      const updated = await favoritesApi.update(selected.id, payload)
      if (!updated) throw new Error('更新失败')
      setFavorites(prev => prev.map(f => (f.id === selected.id ? updated : f)))
      message.success('更新收藏夹成功')
    },
    [message, selected]
  )

  const deleteFavorite = useCallback(
    async (fid: number) => {
      await favoritesApi.remove(fid)
      setFavorites(prev => prev.filter(f => f.id !== fid))
      if (selectedId === fid) {
        const remain = favorites.filter(f => f.id !== fid)
        setSelectedId(remain[0]?.id ?? null)
        setItems([])
      }
      message.success('删除收藏夹成功')
    },
    [favorites, message, selectedId]
  )

  const removeItem = useCallback(
    async (itemId: number) => {
      if (!selected) return
      await favoritesApi.removeItem(selected.id, itemId)
      setItems(prev => prev.filter(i => i.id !== itemId))
      setFavorites(prev =>
        prev.map(f => (f.id === selected.id ? { ...f, items_count: Math.max(0, (f.items_count || 0) - 1) } : f))
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
    fetchCategories()
  }, [fetchFavorites, fetchCategories])

  useEffect(() => {
    if (selectedId) fetchItems(selectedId)
  }, [selectedId, fetchItems])

  return {
    favorites,
    selected,
    selectedId,
    items,
    categories,
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
