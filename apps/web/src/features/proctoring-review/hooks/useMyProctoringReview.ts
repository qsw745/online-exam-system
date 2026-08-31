import { useCallback, useEffect, useState } from 'react'
import {
  proctoringReviewApi,
  type CandidateReviewCaseDetail,
} from '@/shared/api/endpoints/proctoringReview'

type CandidateReviewState = {
  detail: CandidateReviewCaseDetail | null
  loading: boolean
  error: string | null
}

const initialState: CandidateReviewState = {
  detail: null,
  loading: false,
  error: null,
}

export function useMyProctoringReview(attemptId?: string | null) {
  const [state, setState] = useState<CandidateReviewState>(initialState)

  const load = useCallback(async () => {
    if (!attemptId) {
      setState(initialState)
      return null
    }
    setState(current => ({ ...current, loading: true, error: null }))
    try {
      const page = await proctoringReviewApi.listMyCases({ attemptId, page: 1, limit: 1 })
      const item = page.items[0]
      if (!item) {
        setState({ detail: null, loading: false, error: null })
        return null
      }
      const detail = await proctoringReviewApi.getMyCase(item.caseId)
      setState({ detail, loading: false, error: null })
      return detail
    } catch (error: any) {
      setState({ detail: null, loading: false, error: error?.message || '监考复核状态加载失败' })
      return null
    }
  }, [attemptId])

  useEffect(() => {
    let active = true
    if (!attemptId) {
      setState(initialState)
      return () => { active = false }
    }
    setState(current => ({ ...current, loading: true, error: null }))
    void proctoringReviewApi.listMyCases({ attemptId, page: 1, limit: 1 })
      .then(async page => {
        const item = page.items[0]
        if (!item) return null
        return proctoringReviewApi.getMyCase(item.caseId)
      })
      .then(detail => {
        if (active) setState({ detail, loading: false, error: null })
      })
      .catch((error: any) => {
        if (active) setState({ detail: null, loading: false, error: error?.message || '监考复核状态加载失败' })
      })
    return () => { active = false }
  }, [attemptId])

  return { ...state, reload: load, setDetail: (detail: CandidateReviewCaseDetail | null) => setState({ detail, loading: false, error: null }) }
}

export function useMyProctoringReviewCase(caseId?: string) {
  const [state, setState] = useState<CandidateReviewState>(initialState)

  const load = useCallback(async () => {
    if (!caseId) {
      setState(initialState)
      return null
    }
    setState(current => ({ ...current, loading: true, error: null }))
    try {
      const detail = await proctoringReviewApi.getMyCase(caseId)
      setState({ detail, loading: false, error: null })
      return detail
    } catch (error: any) {
      setState({ detail: null, loading: false, error: error?.message || '监考复核详情加载失败' })
      return null
    }
  }, [caseId])

  useEffect(() => {
    void load()
  }, [load])

  return { ...state, reload: load, setDetail: (detail: CandidateReviewCaseDetail | null) => setState({ detail, loading: false, error: null }) }
}
