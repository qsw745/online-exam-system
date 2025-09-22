import { ResultRepository } from '../repositories/result.repository.js'
import type { ResultListData } from '../domain/result.model.js'

export class ResultService {
    async list(user: { id?: number; role?: string } | undefined, query: any): Promise<ResultListData> {
        const userId = user?.id
        const role = user?.role
        if (!userId) throw new Error('未授权')

        const page = parseInt(query.page as string) || 1
        const limit = parseInt(query.limit as string) || 10
        const search = (query.search as string) || ''
        const status = (query.status as string) || ''
        const sort = (query.sort as string) || 'created_at'
        const paperId = (query.paper_id as string) || ''
        const includeStudentInfo = String(query.include_student_info) === 'true'

        return ResultRepository.list({ userId, role, page, limit, search, status, sort, paperId, includeStudentInfo })
    }

    async getById(userId: number | undefined, id: number, include?: string) {
        if (!userId) throw new Error('未授权')
        const needQs =
            include === 'questions' ||
            include === 'all' ||
            include === 'true'
        if (needQs) {
            const detail = await ResultRepository.getDetailByIdOwned(userId, id)
            if (!detail) throw new Error('考试结果不存在')
            return detail
        }
        const row = await ResultRepository.getByIdOwned(userId, id)
        if (!row) throw new Error('考试结果不存在')
        return row
    }
}
