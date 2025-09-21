/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Response } from 'express'
import type { ApiResponse } from '@/types/response'
import { CODES } from '@/types/response'
import type { AuthRequest } from '@/types/auth'
import type { ResultListData } from '../domain/result.model'
import { ResultService } from '../services/result.service'

const svc = new ResultService()

export class ResultController {
    static async list(req: AuthRequest, res: Response<ApiResponse<ResultListData>>) {
        try {
            const data = await svc.list(req.user, req.query)
            return (res as any).ok(data, '获取考试结果列表成功')
        } catch (e: any) {
            const msg = e?.message || '获取考试结果列表失败'
            if (/未授权/.test(msg)) return (res as any).unauthorized(msg, { code: CODES.AUTH_UNAUTHORIZED })
            return (res as any).internal(msg, { code: CODES.INTERNAL_ERROR })
        }
    }

    static async getById(req: AuthRequest, res: Response<ApiResponse<any>>) {
        try {
            const data = await svc.getById(req.user?.id, Number(req.params.id))
            return (res as any).ok(data, '获取考试结果详情成功')
        } catch (e: any) {
            const msg = e?.message || '获取考试结果详情失败'
            if (/未授权/.test(msg)) return (res as any).unauthorized(msg, { code: CODES.AUTH_UNAUTHORIZED })
            if (/不存在/.test(msg)) return (res as any).fail(CODES.NOT_FOUND, 404, msg)
            return (res as any).internal(msg, { code: CODES.INTERNAL_ERROR })
        }
    }
}
