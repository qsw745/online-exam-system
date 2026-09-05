import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { App } from 'antd'
import { favoritesApi, type Favorite, type FavoriteItem } from '@/shared/api/endpoints/favorites'
import { translate } from '@/shared/utils/i18n'

/** 将后端返回的字段做统一规范化（尤其 is_public 可能是 0/1） */
function normalizeFavorite(f: any): Favorite {
  return {
    ...f,
    // 关键：把 0/1/true/false 统一成 boolean，避免在 JSX 中渲染出数字 0
    is_public: [true, 1, '1', 'true'].includes(f?.is_public),
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
  const [error, setError] = useState<string | null>(null)
  const [itemsError, setItemsError] = useState<string | null>(null)
  const [shareLink, setShareLink] = useState<string | null>(null)
  const listVersion = useRef(0)
  const pending = useRef(new Set<string>())
  const [pendingItems, setPendingItems] = useState(new Set<number>())
  const itemsRequestVersion = useRef(0)
  const selectedIdRef = useRef(selectedId)
  useLayoutEffect(() => { selectedIdRef.current = selectedId }, [selectedId])

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const selected = useMemo(() => favorites.find(f => f.id === selectedId) ?? null, [favorites, selectedId])

  const fetchFavorites = useCallback(async () => {
    const version = ++listVersion.current
    setError(null)
    try {
      setLoading(true)
      const list = await favoritesApi.list()
      if (version !== listVersion.current) return
      const normalized = Array.isArray(list) ? list.map(normalizeFavorite) : []
      setFavorites(normalized)
      setSelectedId(current => normalized.some(f => f.id === current) ? current : normalized[0]?.id ?? null)
    } catch (e: any) {
      if (version === listVersion.current) setError(e?.message || translate('auto.f32af26ff3'))
    } finally {
      if (version === listVersion.current) setLoading(false)
    }
  }, [])

  const fetchItems = useCallback(
    async (fid: number) => {
      const version = ++itemsRequestVersion.current
      try {
        setItemsLoading(true)
        setItemsError(null)
        setItems([])
        const list = await favoritesApi.items(fid)
        if (version !== itemsRequestVersion.current || selectedIdRef.current !== fid) return
        setItems(list ?? [])
      } catch (e: any) {
        if (version !== itemsRequestVersion.current || selectedIdRef.current !== fid) return
        setItemsError(e?.message || translate('auto.559f885b42'))
      } finally {
        if (version === itemsRequestVersion.current) setItemsLoading(false)
      }
    },
    [message]
  )

  const createFavorite = useCallback(
    async (payload: Partial<Favorite>) => {
      // 未选择分类显式传 null
      const created = await favoritesApi.create({ ...payload, category_id: payload.category_id ?? null })
      if (!created) throw new Error(translate('roles.message.create_failed'))
      const normalized = normalizeFavorite(created)
      setFavorites(prev => [normalized, ...prev])
      setSelectedId(normalized.id)
      message.success(translate('auto.802f4b37f6'))
    },
    [message]
  )

  const updateFavorite = useCallback(
    async (payload: Partial<Favorite>) => {
      if (!selected) return
      const updated = await favoritesApi.update(selected.id, payload)
      if (!updated) throw new Error(translate('roles.message.update_failed'))
      const normalized = normalizeFavorite(updated)
      setFavorites(prev => prev.map(f => (f.id === selected.id ? normalized : f)))
      message.success(translate('auto.2d1ff04d3c'))
    },
    [message, selected]
  )

  const deleteFavorite = useCallback(
    async (fid: number) => {
      await favoritesApi.remove(fid)
      setFavorites(prev => prev.filter(f => f.id !== fid))
      setSelectedId(current => current === fid ? null : current)
      if (selectedIdRef.current === fid) {
        setItems([])
      }
      message.success(translate('auto.c3c1119821'))
    },
    [message]
  )

  const removeItem = useCallback(async (itemId: number) => {
    if (!selected) return
    const fid = selected.id
    const key = `${fid}:${itemId}`
    if (pending.current.has(key)) return
    pending.current.add(key)
    setPendingItems(previous => new Set(previous).add(itemId))
    try {
      await favoritesApi.removeItem(fid, itemId)
      if (selectedIdRef.current === fid) setItems(previous => previous.filter(item => item.id !== itemId))
      setFavorites(previous => previous.map(f => f.id === fid ? { ...f, items_count: Math.max(0, f.items_count - 1) } : f))
      message.success(translate('auto.46c52b46d4'))
    } finally {
      pending.current.delete(key)
      setPendingItems(previous => { const next = new Set(previous); next.delete(itemId); return next })
    }
  }, [selected, message])

  const shareFavorite = useCallback(
    async (fid: number) => {
      const link = await favoritesApi.share(fid)
      if (!link) throw new Error(translate('auto.406bf2ab41'))
      setShareLink(link)
      try {
        if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
        await navigator.clipboard.writeText(link)
        message.success(translate('auto.df304eb663'))
      } catch { message.info('分享链接已生成，可长按链接手动复制。') }
    },
    [message]
  )

  useEffect(() => {
    void fetchFavorites()
    return () => { listVersion.current += 1 }
  }, [fetchFavorites])

  useEffect(() => {
    if (selectedId != null) void fetchItems(selectedId)
    else {
      setItems([])
      setItemsLoading(false)
    }
    return () => { itemsRequestVersion.current += 1 }
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
    shareFavorite, error, itemsError, fetchFavorites, retryItems: () => selectedId != null && fetchItems(selectedId),
    shareLink, setShareLink, pendingItems,
  }
}

export default useFavorites
