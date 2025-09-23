/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Response } from 'express'
import type { ApiResponse } from '@/types/response'
import { CODES } from '@/types/response'
import type { AuthRequest } from '@/types/auth'
import type { ResultListData } from '../domain/result.model.js'
import { ResultService } from '../services/result.service.js'

const svc = new ResultService()

// CSV 转义
const esc = (v: any) => {
    if (v == null) return ''
    const s = String(v)
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
}

// ASCII 回退 + RFC5987 UTF-8
function buildContentDisposition(filenameUtf8: string) {
    const fallback = filenameUtf8
        .replace(/["\\]/g, '')
        .replace(/[^\x20-\x7E]+/g, '_')
    const utf8Param = encodeURIComponent(filenameUtf8)
    return `attachment; filename="${fallback}"; filename*=UTF-8''${utf8Param}`
}

// 统一的状态文案（导出用）
function statusLabel(s: unknown) {
    const t = String(s ?? '').toLowerCase()
    if (t === 'completed' || t === 'submitted' || t === 'graded') return '已完成'
    if (t === 'in_progress') return '进行中'
    if (t === 'not_started' || t === 'pending' || t === 'draft') return '未开始'
    if (t === 'expired') return '已过期'
    return '未知'
}

// 提交时间：优先 end_time；格式 YYYY/MM/DD HH:mm
function fmtSubmitTime(v: any) {
    if (!v) return ''
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return String(v)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

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
            const id = Number(req.params.id)
            const include = (String(req.query.include || req.query.include_questions || '') || '').toLowerCase()
            const data = await svc.getById(req.user?.id, id, include)
            return (res as any).ok(data, '获取考试结果详情成功')
        } catch (e: any) {
            const msg = e?.message || '获取考试结果详情失败'
            if (/未授权/.test(msg)) return (res as any).unauthorized(msg, { code: CODES.AUTH_UNAUTHORIZED })
            if (/不存在/.test(msg)) return (res as any).fail(CODES.NOT_FOUND, 404, msg)
            return (res as any).internal(msg, { code: CODES.INTERNAL_ERROR })
        }
    }

    /** 导出 CSV：状态做友好映射；文件名 header 仅含 ASCII（带 RFC5987 UTF-8） */
    static async exportCsv(req: AuthRequest, res: Response) {
        try {
            const { list } = await svc.listForExport(req.user, req.query)

            const header = ['学生', '邮箱', '试卷', '得分', '满分', '百分比', '用时(秒)', '状态', '提交时间']
            const lines = [header.join(',')]

            for (const r of list as any[]) {
                const pct =
                    r?.percentage != null
                        ? r.percentage
                        : r?.total_score
                            ? Math.round((Number(r.score || 0) / Number(r.total_score || 0)) * 1000) / 10
                            : ''

                const submitText = fmtSubmitTime(r?.end_time ?? r?.created_at)
                lines.push(
                    [
                        esc(r?.student_name ?? ''),
                        esc(r?.student_email ?? ''),
                        esc(r?.paper_title ?? ''),
                        esc(r?.score ?? ''),
                        esc(r?.total_score ?? ''),
                        esc(pct === '' ? '' : `${pct}`),
                        esc(r?.duration ?? ''),
                        esc(statusLabel(r?.status)),
                        esc(submitText),
                    ].join(',')
                )
            }

            const csv = '\uFEFF' + lines.join('\n') // BOM 便于 Excel 识别 UTF-8
            const ymd = new Date().toISOString().slice(0, 10)
            const unicodeName = `成绩报告_${ymd}.csv`
            const disposition = buildContentDisposition(unicodeName)

            res.setHeader('Content-Type', 'text/csv; charset=utf-8')
            res.setHeader('Content-Disposition', disposition)
            return res.status(200).send(csv)
        } catch (e: any) {
            const msg = e?.message || '导出失败'
            return (res as any).internal(msg, { code: CODES.INTERNAL_ERROR })
        }
    }
}

export default ResultController
