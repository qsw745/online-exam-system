// src/shared/utils/q-helpers.ts
import * as XLSX from 'xlsx'
import Papa from 'papaparse'

/** ----- 通用小工具 ----- */
export const getMsg = (res: any, fallback = '请求失败') =>
  res?.error ||
  res?.message ||
  res?.data?.error ||
  res?.data?.message ||
  (typeof res === 'string' ? res : null) ||
  fallback

export const compactObject = <T extends Record<string, any>>(obj: T): T =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== '')) as T

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

/** ----- 导出：表头 & 行构建 ----- */
export type ExportHeader = { key: string; label: string }

/**
 * 导出表头（label 用中文友好名字，便于人看；再次导入时也能被解析器识别）
 * 和导入别名映射保持一致：题目内容/题目类型/难度/分值/选项A~F/正确答案/知识点/标签/解析
 */
export const buildExportHeaders = (): ExportHeader[] => [
  { key: 'content', label: '题目内容' },
  { key: 'question_type', label: '题目类型' },
  { key: 'difficulty', label: '难度' },
  { key: 'score', label: '分值' },
  { key: 'option_a', label: '选项A' },
  { key: 'option_b', label: '选项B' },
  { key: 'option_c', label: '选项C' },
  { key: 'option_d', label: '选项D' },
  { key: 'option_e', label: '选项E' },
  { key: 'option_f', label: '选项F' },
  { key: 'correct_answer', label: '正确答案' },
  { key: 'knowledge_points', label: '知识点' },
  { key: 'tags', label: '标签' },
  { key: 'explanation', label: '解析' },
]

/** 从题目列表构建导出行（和 headers 的 key 一一对应） */
export const buildRowsForExport = (items: any[]) => {
  return (items || []).map((q, idx) => {
    const t = String(q.question_type || q.type || '').toLowerCase()
    const isChoice = t === 'single_choice' || t === 'multiple_choice'
    // 选项转 A~F
    const options = Array.isArray(q.options)
      ? q.options.map((o: any) => ({
          content: String(o?.content || o?.label || '').trim(),
          is_correct: !!o?.is_correct,
        }))
      : []
    const pad = (i: number) => options[i]?.content || ''
    // 正确答案（用 A,B,…）
    const letters = options
      .map((o, i) => (o.is_correct ? String.fromCharCode(65 + i) : ''))
      .filter(Boolean)
      .join(',')

    return {
      content: String(q.content || q.title || '').trim() || `题目${idx + 1}`,
      question_type: t || 'single_choice',
      difficulty: q.difficulty || 'medium',
      score: Number.isFinite(+q.score) ? +q.score : 1,
      option_a: isChoice ? pad(0) : '',
      option_b: isChoice ? pad(1) : '',
      option_c: isChoice ? pad(2) : '',
      option_d: isChoice ? pad(3) : '',
      option_e: isChoice ? pad(4) : '',
      option_f: isChoice ? pad(5) : '',
      correct_answer: isChoice ? letters : q.correct_answer ?? q.answer ?? '',
      knowledge_points: Array.isArray(q.knowledge_points) ? q.knowledge_points.join(',') : q.knowledge_points || '',
      tags: Array.isArray(q.tags) ? q.tags.join(',') : q.tags || '',
      explanation: q.explanation || '',
    }
  })
}

/** ----- 实际导出：CSV / XLSX ----- */
export const exportToCsv = async (rows: any[], filename: string, headers: ExportHeader[]) => {
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

export const exportToXlsx = async (rows: any[], filename: string, headers: ExportHeader[]) => {
  const arr = rows.map(r => {
    const obj: Record<string, any> = {}
    headers.forEach(h => (obj[h.label] = r[h.key] ?? ''))
    return obj
  })
  const ws = XLSX.utils.json_to_sheet(arr)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '题目')
  XLSX.writeFile(wb, filename)
}
