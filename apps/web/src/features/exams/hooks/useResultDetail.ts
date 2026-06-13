import { useEffect, useState } from 'react'
import { App } from 'antd'
import { resultsApi, type ResultDetail } from '@/shared/api/endpoints/results'

export function useResultDetail(id: string | number | undefined) {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ResultDetail | null>(null)

  useEffect(() => {
    let alive = true
    if (!id) {
      setLoading(false)
      setData(null)
      return
    }
    ;(async () => {
      try {
        setLoading(true)
        const res = await resultsApi.getDetail(id)
        if (alive) setData(res)
      } catch (e: any) {
        message.error(e?.message || '加载结果详情失败')
        if (alive) setData(null)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [id, message])

  return { loading, data }
}
