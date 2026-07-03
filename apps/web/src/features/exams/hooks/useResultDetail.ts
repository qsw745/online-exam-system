import { useEffect, useState } from 'react'
import { App } from 'antd'
import { resultsApi, type ResultDetail } from '@/shared/api/endpoints/results'
import { translate } from '@/shared/utils/i18n'

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
        message.error(e?.message || translate('auto.a9d58a715f'))
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
