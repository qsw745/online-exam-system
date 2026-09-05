import { useCallback, useEffect, useRef, useState } from 'react'
import { resultsApi, type ResultDetail } from '@/shared/api/endpoints/results'

export function useResultDetail(id: string | number | undefined) {
  const validId = /^[1-9]\d*$/.test(String(id)) && Number.isSafeInteger(Number(id))
  const [state, setState] = useState<{
    id: typeof id; loading: boolean; data: ResultDetail | null; error: string | null
  }>({ id, loading: validId, data: null, error: null })
  const requestVersion = useRef(0)

  const refetch = useCallback(async () => {
    const version = ++requestVersion.current
    if (!validId || id == null) return
    setState({ id, loading: true, data: null, error: null })
    try {
      const data = await resultsApi.getDetail(id)
      if (version === requestVersion.current) setState({ id, loading: false, data, error: null })
    } catch (error) {
      if (version === requestVersion.current) {
        setState({ id, loading: false, data: null, error: error instanceof Error ? error.message : '成绩加载失败，请稍后重试' })
      }
    }
  }, [id, validId])

  useEffect(() => {
    void refetch()
    return () => { requestVersion.current += 1 }
  }, [refetch])

  if (!validId) return { loading: false, data: null, error: '成绩编号无效，请返回成绩列表', refetch }
  if (state.id !== id) return { loading: true, data: null, error: null, refetch }
  return { loading: state.loading, data: state.data, error: state.error, refetch }
}
