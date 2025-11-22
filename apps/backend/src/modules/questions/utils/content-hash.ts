import crypto from 'node:crypto'

/**
 * 将题目内容做基本归一化：去掉多余空白、全角空格，统一大小写
 */
export function normalizeQuestionContent(raw: string | null | undefined): string {
  if (!raw) return ''
  return raw
    .replace(/\u00a0/g, ' ') // nbsp
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function buildQuestionContentHash(questionType: string, normalizedContent: string): string {
  return crypto.createHash('sha256').update(`${questionType || ''}::${normalizedContent}`).digest('hex')
}

export function computeQuestionContentSignature(questionType: string, rawContent: string) {
  const normalized = normalizeQuestionContent(rawContent)
  const hash = buildQuestionContentHash(questionType, normalized)
  return { normalized, hash }
}
