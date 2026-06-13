import { ResultRepository } from '../repositories/result.repository.js'
import type { ResultListData } from '../domain/result.model.js'

type SortKey = 'start_time' | 'end_time' | 'created_at' | 'score'
const SORT_ALLOWED = new Set<SortKey>(['start_time', 'end_time', 'created_at', 'score'])

function normalizeSort(v: any): SortKey {
  const s = String(v ?? '').trim() as SortKey
  return SORT_ALLOWED.has(s) ? s : 'created_at'
}

export class ResultService {
  async list(user: { id?: number; role?: string } | undefined, query: any): Promise<ResultListData> {
    const userId = user?.id
    const role = user?.role
    if (!userId) throw new Error('未授权')

    const page = parseInt(query.page as string) || 1
    const limit = parseInt(query.limit as string) || 10
    const search = (query.search as string) || ''
    const status = (query.status as string) || ''
    const sort = normalizeSort(query.sort)
    const paperIdRaw = query.paper_id
    const paperId = paperIdRaw == null || String(paperIdRaw).trim() === '' ? '' : Number(paperIdRaw)
    const includeStudentInfo = String(query.include_student_info) === 'true'

    return ResultRepository.list({
      userId,
      role,
      page,
      limit,
      search,
      status,
      sort,
      paperId: Number.isFinite(paperId as number) ? (paperId as number) : '',
      includeStudentInfo,
    })
  }

  async getById(user: { id?: number; role?: string } | undefined, id: number, include?: string) {
    if (!user?.id) throw new Error('未授权')
    const needQs = include === 'questions' || include === 'all' || include === 'true'
    if (needQs) {
      const detail = await ResultRepository.getDetailById(user, id)
      if (!detail) throw new Error('考试结果不存在')
      return detail
    }
    const row = await ResultRepository.getById(user, id)
    if (!row) throw new Error('考试结果不存在')
    return row
  }

  /** 导出专用：拿全量（上限 5000），且包含学生信息以便导出 */
  async listForExport(user: { id?: number; role?: string } | undefined, query: any) {
    const userId = user?.id
    const role = user?.role
    if (!userId) throw new Error('未授权')

    const search = (query.search as string) || ''
    const status = (query.status as string) || ''
    const sort = normalizeSort(query.sort)
    const paperIdRaw = query.paper_id
    const paperId = paperIdRaw == null || String(paperIdRaw).trim() === '' ? '' : Number(paperIdRaw)

    const page = 1
    const limit = Math.min(5000, Number(query.limit) || 5000)

    const { results, pagination } = await ResultRepository.list({
      userId,
      role,
      page,
      limit,
      search,
      status,
      sort,
      paperId: Number.isFinite(paperId as number) ? (paperId as number) : '',
      includeStudentInfo: true,
    })

    return { list: results, pagination }
  }
}
