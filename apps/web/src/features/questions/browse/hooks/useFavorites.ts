// hooks/useFavorites.ts
import { useCallback, useEffect, useState } from 'react'
import { message } from 'antd'
import { favorites as favoritesApi } from '@shared/api/http'
import { isSuccess, type ApiResult } from '../utils/apiResult'

export function useFavorites(enabled: boolean) {
  const [setIds, setSetIds] = useState<Set<string>>(new Set())

  const refresh = useCallback(async () => {
    if (!enabled) return
    try {
      const res: ApiResult<any> = await favoritesApi.list()
      if (isSuccess(res)) {
        const ids = new Set<string>((res.data?.favorites ?? []).map((f: any) => String(f.question_id)))
        setSetIds(ids)
      } else setSetIds(new Set())
    } catch {
      setSetIds(new Set())
    }
  }, [enabled])

  const toggle = useCallback(
    async (questionId: string, title?: string) => {
      try {
        if (setIds.has(questionId)) {
          const r = await favoritesApi.remove(questionId)
          if (!isSuccess(r)) throw new Error('取消收藏失败')
          const n = new Set(setIds)
          n.delete(questionId)
          setSetIds(n)
        } else {
          const r = await favoritesApi.add(questionId, title)
          if (!isSuccess(r)) throw new Error('收藏失败')
          const n = new Set(setIds)
          n.add(questionId)
          setSetIds(n)
        }
      } catch (e: any) {
        message.error(e?.message || '操作失败')
      }
    },
    [setIds]
  )

  useEffect(() => {
    refresh()
  }, [refresh])
  return { favorites: setIds, toggle, refresh }
}
