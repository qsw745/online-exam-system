// src/shared/hooks/useImportQuestions.ts
import { parseFile } from '@/shared/utils/fileParser'
import { message } from 'antd'
import { useState } from 'react'
import { api, isSuccess } from '@/shared/api/http'
import { ensureArrayFromMaybeCsv, pickField } from '@/shared/api/normalizers/import-normalize'

// 兼容：本地声明导入文件里用到的字段结构（避免缺少 ParsedQuestion 类型）
type ParsedQuestion = {
  title?: string
  content: string
  question_type: string
  difficulty?: 'easy' | 'medium' | 'hard'
  options?: string[] | Array<{ value: string; label?: string }>
  correct_answer?: string
  correct_answers?: string[] | string
  knowledge_points?: string[] | string
  tags?: string[] | string
  explanation?: string
  score?: number
  // 兼容一些导入模板的命名
  answer?: string
}

function getMsg(res: any, fallback = '请求失败') {
  return (
    res?.error ||
    res?.message ||
    res?.data?.error ||
    res?.data?.message ||
    (typeof res === 'string' ? res : null) ||
    fallback
  )
}

export function useImportQuestions(onDone: () => void, reloadTags: () => void) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [loading, setLoading] = useState(false)

  const startImport = async () => {
    if (!file) return message.error('请先选择要导入的文件')
    setLoading(true)
    setProgress(10)
    try {
      const parsedRes = await parseFile(file)
      setProgress(30)
      if (!parsedRes?.success || !parsedRes.data) throw new Error(parsedRes?.errors?.join('; ') || '文件解析失败')

      const rows = parsedRes.data as ParsedQuestion[]
      if (!rows.length) throw new Error('文件中没有有效的题目数据')

      setProgress(50)
      const payload = rows.map((q, idx) => {
        const correctRaw =
          q.correct_answer ??
          (Array.isArray(q.correct_answers) ? q.correct_answers.join(',') : q.correct_answers) ??
          pickField(q as any, ['正确答案', '正確答案', '正确答案（多选）', '正確答案（多選）']) ??
          q.answer

        return {
          title: q.title || `题目${idx + 1}`,
          content: q.content,
          question_type: q.question_type,
          difficulty: q.difficulty || 'medium',
          options: q.options,
          correct_answer: correctRaw ?? '',
          answer: q.answer ?? correctRaw ?? '',
          knowledge_points: ensureArrayFromMaybeCsv(q.knowledge_points),
          tags: ensureArrayFromMaybeCsv(q.tags),
          explanation: q.explanation || '',
          score: q.score ?? 1,
        }
      })

      setProgress(70)
      // 统一从 hooks 发请求：后端若无 bulk-import，可在网关映射到 /questions/bulk-import
      const res: any = await api.post('/questions/bulk-import', payload, { params: { upsert: true } })
      setProgress(90)

      if (!isSuccess(res as any)) {
        return message.error(getMsg(res, '批量导入失败'))
      }

      const stat = (res.data as any) ?? {}
      const ok = Number(stat.success_count ?? stat.success ?? 0)
      const fail = Number(stat.fail_count ?? stat.failed ?? 0)
      if (ok || fail) {
        message.success(`导入完成！成功 ${ok} 道${fail ? `，失败 ${fail} 道` : ''}`)
      } else {
        message.success('导入完成')
      }

      onDone()
      reloadTags()
    } catch (e: any) {
      message.error(e?.message || '批量导入失败')
    } finally {
      setLoading(false)
      setProgress(0)
      setOpen(false)
      setFile(null)
    }
  }

  return {
    open,
    setOpen,
    file,
    setFile,
    progress,
    loading,
    startImport,
  }
}

export default useImportQuestions
