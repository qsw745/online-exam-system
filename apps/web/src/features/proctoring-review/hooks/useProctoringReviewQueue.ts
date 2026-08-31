import { useCallback, useEffect, useState } from 'react'
import {
  proctoringReviewApi,
  type ReviewCaseDetail,
  type ReviewCaseListItem,
} from '@/shared/api/endpoints/proctoringReview'

export type ReviewQueueFilters = {
  status?: string
  outcome?: string
  examId?: number
  reasonCode?: string
}

export function useProctoringReviewQueue(filters: ReviewQueueFilters, page: number, limit: number) {
  const [items, setItems] = useState<ReviewCaseListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<ReviewCaseDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await proctoringReviewApi.listStaffCases({ ...filters, page, limit })
      setItems(Array.isArray(result?.items) ? result.items : [])
      setTotal(Number(result?.total || 0))
    } catch (cause: any) {
      setError(String(cause?.message || '加载失败'))
    } finally {
      setLoading(false)
    }
  }, [filters.examId, filters.outcome, filters.reasonCode, filters.status, limit, page])

  const loadDetail = useCallback(async (caseId: string) => {
    setDetailLoading(true)
    try {
      const result = await proctoringReviewApi.getStaffCase(caseId)
      setDetail(result)
      return result
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return { items, total, loading, error, detail, detailLoading, setDetail, load, loadDetail }
}

export default useProctoringReviewQueue
