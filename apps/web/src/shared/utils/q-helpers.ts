// src/shared/utils/q-helpers.ts
import Papa from 'papaparse'
import writeXlsxFile from 'write-excel-file/browser'

export const getMsg = (res: any, fallback = '请求失败') =>
  res?.error ||
  res?.message ||
  res?.data?.error ||
  res?.data?.message ||
  (typeof res === 'string' ? res : null) ||
  fallback

export const compactObject = <T extends Record<string, any>>(obj: T): T =>
  Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined && v !== null && v !== '')) as T

export const ensureArrayFromMaybeCsv = (input: any): string[] => {
  if (Array.isArray(input))
    return input
      .map(String)
      .map(s => s.trim())
      .filter(Boolean)
  if (typeof input === 'string') {
    const normalized = input.replace(/[\r\n]+/g, ',').replace(/[，；;]/g, ',')
    return normalized
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
  }
  if (input != null && (typeof input === 'number' || typeof input === 'boolean')) {
    return [String(input)]
  }
  return []
}

/** 统一的导出表头（人类可读表头 -> 字段 key） */
export const buildExportHeaders = () => {
  return [
    { label: '题目内容', key: 'content' },
    { label: '题目类型', key: 'question_type' }, // single_choice / multiple_choice / true_false / short_answer
    { label: '难度', key: 'difficulty' }, // easy/medium/hard
    { label: '分值', key: 'score' },

    { label: '选项A', key: 'option_a' },
    { label: '选项B', key: 'option_b' },
    { label: '选项C', key: 'option_c' },
    { label: '选项D', key: 'option_d' },
    { label: '选项E', key: 'option_e' },
    { label: '选项F', key: 'option_f' },

    { label: '正确答案', key: 'correct_answer' }, // A 或 A,B；判断题 true/false；简答题文本
    { label: '知识点', key: 'knowledge_points' }, // 多个用逗号
    { label: '标签', key: 'tags' }, // 多个用逗号
    { label: '解析', key: 'explanation' },
  ] as Array<{ label: string; key: string }>
}

/** 从后端的题目结构构建导出行 */
export const buildRowsForExport = (items: any[]) => {
  const toLetters = (opts: any[]) =>
    (opts || [])
      .map((o, i) => (o?.is_correct ? String.fromCharCode(65 + i) : ''))
      .filter(Boolean)
      .join(',')

  return (items || []).map((q, idx) => {
    const t = String(q.question_type || q.type || '').toLowerCase()
    const isChoice = t === 'single_choice' || t === 'multiple_choice'
    const options = Array.isArray(q.options)
      ? q.options.map((o: any) => ({
          content: String(o?.content || o?.label || '').trim(),
          is_correct: !!o?.is_correct,
        }))
      : []
    const pad = (i: number) => (isChoice ? options[i]?.content || '' : '')

    return {
      content: String(q.content || q.title || '').trim() || `题目${idx + 1}`,
      question_type: t || 'single_choice',
      difficulty: q.difficulty || 'medium',
      score: Number.isFinite(+q.score) ? +q.score : 1,

      option_a: pad(0),
      option_b: pad(1),
      option_c: pad(2),
      option_d: pad(3),
      option_e: pad(4),
      option_f: pad(5),

      correct_answer: isChoice ? toLetters(options) : q.correct_answer ?? q.answer ?? '',
      knowledge_points: Array.isArray(q.knowledge_points) ? q.knowledge_points.join(',') : q.knowledge_points || '',
      tags: Array.isArray(q.tags) ? q.tags.join(',') : q.tags || '',
      explanation: q.explanation || '',
    }
  })
}

export const exportToCsv = async (rows: any[], filename: string, headers: { key: string; label: string }[]) => {
  const data = rows.map(r => {
    const obj: Record<string, any> = {}
    headers.forEach(h => (obj[h.label] = r[h.key] ?? ''))
    return obj
  })
  const csv = Papa.unparse(data, { quotes: true })
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export const exportToXlsx = async (rows: any[], filename: string, headers: { key: string; label: string }[]) => {
  const data = [
    headers.map(h => ({ value: h.label, fontWeight: 'bold' as const })),
    ...rows.map(r => headers.map(h => ({ value: r[h.key] ?? '' }))),
  ]
  await writeXlsxFile(data).toFile(filename)
}
