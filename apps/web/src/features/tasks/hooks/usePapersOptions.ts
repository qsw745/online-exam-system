import { App } from 'antd'
import { useCallback, useState } from 'react'
import { api } from '@/shared/api/http'

/** 试卷下拉：统一 value=string(id)，label=title/name */
export function usePapersOptions() {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [options, setOptions] = useState<Array<{ label: string; value: string }>>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await api.get('/papers', { params: { page: 1, limit: 1000 } })
      const data = res?.data ?? res
      const list = data?.items ?? data?.list ?? data?.papers ?? (Array.isArray(data) ? data : [])
      setOptions(
        (Array.isArray(list) ? list : []).map((p: any) => ({
          label: p.title ?? p.name ?? `试卷${p.id}`,
          value: String(p.id),
        }))
      )
    } catch (e: any) {
      console.error(e)
      message.error(e?.message || '加载试卷失败')
      setOptions([])
    } finally {
      setLoading(false)
    }
  }, [message])

  return { loading, options, load }
}
export default usePapersOptions
