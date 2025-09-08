import { parseFile } from '@shared/utils/fileParser'
import { message } from 'antd'
import { useState } from 'react'
import { questionsApi } from '@shared/api/http'
import { ensureArrayFromMaybeCsv, pickField } from '../api/normalizers/import-normalize'
import type { ParsedQuestion } from '@shared/types/index'
import { getMsg, isSuccess } from '../utils/api-result'

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
          pickField(q as any, ['正确答案', '正確答案', '正确答案（多选）', '正確答案（多選）'])

        return {
          title: q.title || `题目${idx + 1}`,
          content: q.content,
          question_type: q.question_type,
          difficulty: q.difficulty || 'medium',
          options: q.options,
          correct_answer: correctRaw ?? (q as any).answer,
          answer: (q as any).answer,
          knowledge_points: ensureArrayFromMaybeCsv(q.knowledge_points),
          tags: ensureArrayFromMaybeCsv(q.tags),
          explanation: q.explanation || '',
          score: q.score ?? 1,
        }
      })

      setProgress(70)
      const res = await questionsApi.bulkImport(payload, { upsert: true })
      setProgress(90)
      if (!isSuccess(res)) return message.error(getMsg(res, '批量导入失败'))

      const stat = (res.data as any) ?? {}
      const ok = Number(stat.success_count ?? 0)
      const fail = Number(stat.fail_count ?? 0)
      if (ok) message.success(`导入完成！成功 ${ok} 道${fail ? `，失败 ${fail} 道` : ''}`)
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
