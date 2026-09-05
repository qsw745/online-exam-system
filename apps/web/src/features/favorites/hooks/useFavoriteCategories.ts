import { useEffect, useState } from 'react'
import { favoritesApi, type FavoriteCategory } from '@/shared/api/endpoints/favorites'

export function useFavoriteCategories({ enabled = true }: { enabled?: boolean } = {}) {
  const [categories, setCategories] = useState<FavoriteCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!enabled) return
    let active = true
    const load = async () => {
      setLoading(true)
      setError(null)
      await favoritesApi.categories().then(list => { if (active) setCategories(list) })
      .catch(error => { if (active) setError(error instanceof Error ? error.message : '分类加载失败') })
      .finally(() => { if (active) setLoading(false) })
    }
    void load()
    return () => { active = false }
  }, [enabled, retry])
  return { categories, loading, error, refetch: () => setRetry(value => value + 1) }
}
export default useFavoriteCategories
