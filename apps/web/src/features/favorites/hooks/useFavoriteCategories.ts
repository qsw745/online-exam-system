import { useCallback, useEffect, useRef, useState } from 'react'
import { favoritesApi, type FavoriteCategory } from '@/shared/api/endpoints/favorites'

type Options = {
  /** 是否启用请求；常用于 Modal 打开时才请求 */
  enabled?: boolean
}

export function useFavoriteCategories(opts: Options = {}) {
  const { enabled = true } = opts

  const [categories, setCategories] = useState<FavoriteCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fetchedRef = useRef(false) // 避免同一轮多次触发

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const list = await favoritesApi.categories()
      setCategories(Array.isArray(list) ? list : [])
    } catch (e: any) {
      setError(e?.message || '加载分类失败')
      setCategories([])
    } finally {
      setLoading(false)
    }
  }, [])

  // 只有 enabled=true 才会触发请求
  useEffect(() => {
    if (!enabled) return
    if (fetchedRef.current) return
    fetchedRef.current = true
    fetchCategories()
  }, [enabled, fetchCategories])

  return {
    categories,
    loading,
    error,
    /** 手动刷新（比如每次 Modal 打开时都拉一次最新） */
    refetch: fetchCategories,
  }
}

export default useFavoriteCategories
