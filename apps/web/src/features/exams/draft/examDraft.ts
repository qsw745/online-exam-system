export const EXAM_DRAFT_VERSION = 1 as const

export type ExamDraftIdentity = {
  userId: string | number
  taskId: string | number
  examId: string | number
}

export type ExamDraftState = {
  answers: Record<string, string>
  flagged: number[]
}

export type ExamDraft = ExamDraftIdentity &
  ExamDraftState & {
    version: typeof EXAM_DRAFT_VERSION
    savedAt: string
  }

export type ExamDraftReadResult =
  | { status: 'missing' }
  | { status: 'invalid' }
  | { status: 'unavailable' }
  | { status: 'found'; draft: ExamDraft }

export function examDraftKey(identity: ExamDraftIdentity) {
  return `wenheng:exam-draft:v1:${identity.userId}:${identity.taskId}:${identity.examId}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isValidDraft(value: unknown, identity: ExamDraftIdentity): value is ExamDraft {
  if (!isRecord(value) || value.version !== EXAM_DRAFT_VERSION) return false
  if (String(value.userId) !== String(identity.userId)) return false
  if (String(value.taskId) !== String(identity.taskId)) return false
  if (String(value.examId) !== String(identity.examId)) return false
  if (!isRecord(value.answers) || !Object.values(value.answers).every(item => typeof item === 'string')) return false
  if (!Array.isArray(value.flagged) || !value.flagged.every(Number.isInteger)) return false
  return typeof value.savedAt === 'string' && !Number.isNaN(Date.parse(value.savedAt))
}

export function saveExamDraft(
  storage: Storage,
  identity: ExamDraftIdentity,
  state: ExamDraftState,
  now: () => string = () => new Date().toISOString(),
) {
  const savedAt = now()
  const draft: ExamDraft = { version: EXAM_DRAFT_VERSION, ...identity, ...state, savedAt }
  try {
    storage.setItem(examDraftKey(identity), JSON.stringify(draft))
    return { ok: true as const, savedAt }
  } catch {
    return { ok: false as const }
  }
}

export function readExamDraft(storage: Storage, identity: ExamDraftIdentity): ExamDraftReadResult {
  let raw: string | null
  try {
    raw = storage.getItem(examDraftKey(identity))
  } catch {
    return { status: 'unavailable' }
  }

  if (raw === null) return { status: 'missing' }

  try {
    const draft: unknown = JSON.parse(raw)
    if (isValidDraft(draft, identity)) return { status: 'found', draft }
  } catch {
    // 无效 JSON 统一在下方清理。
  }

  try {
    storage.removeItem(examDraftKey(identity))
  } catch {
    // 清理失败不应阻断考试页。
  }
  return { status: 'invalid' }
}

export function clearExamDraft(storage: Storage, identity: ExamDraftIdentity) {
  try {
    storage.removeItem(examDraftKey(identity))
    return true
  } catch {
    return false
  }
}
