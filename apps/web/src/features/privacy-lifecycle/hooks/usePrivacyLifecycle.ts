import { useCallback, useEffect, useState } from 'react'

import type { DataRegion } from '@/platform/region/accountRegion'
import {
  privacyLifecycleApi,
  type LifecycleAdminRequest,
  type PrivacyLifecycleApi,
} from '@/shared/api/endpoints/privacyLifecycle'

type QueueApi = Pick<PrivacyLifecycleApi, 'listRequests' | 'getRequest'>

export function usePrivacyLifecycle({
  api = privacyLifecycleApi,
  region,
  enabled = true,
}: {
  api?: QueueApi
  region: DataRegion
  enabled?: boolean
}) {
  const [items, setItems] = useState<LifecycleAdminRequest[]>([])
  const [detail, setDetail] = useState<LifecycleAdminRequest | null>(null)
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const result = await api.listRequests({ region, limit: 50, offset: 0 })
      setItems(result.items)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法加载生命周期队列')
    } finally {
      setLoading(false)
    }
  }, [api, enabled, region])

  const loadDetail = useCallback(async (requestId: string) => {
    setDetailLoading(true)
    setError(null)
    try {
      const result = await api.getRequest({ region, requestId })
      setDetail(result)
      return result
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法加载请求详情')
      return null
    } finally {
      setDetailLoading(false)
    }
  }, [api, region])

  useEffect(() => {
    void load()
  }, [load])

  return {
    items,
    detail,
    loading,
    detailLoading,
    error,
    load,
    loadDetail,
    setDetail,
    setError,
  }
}
