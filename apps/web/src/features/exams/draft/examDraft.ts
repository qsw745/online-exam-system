import type { ExamVaultAdapter } from '@/platform/exam-vault'
import type { PendingExamSubmission } from '../reliability/examReliability'

export const EXAM_DRAFT_VERSION = 2 as const

export type ExamDraftIdentity = {
  userId: string | number
  taskId: string | number
  examId: string | number
  attemptId: string
}
export type ExamDraftState = {
  answers: Record<string, string>
  flagged: number[]
  pendingSubmission?: PendingExamSubmission | null
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
  return `wenheng:exam-draft:v2:${identity.userId}:${identity.taskId}:${identity.examId}:${identity.attemptId}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isValidPendingSubmission(value: unknown, attemptId: string): value is PendingExamSubmission {
  if (!isRecord(value)) return false
  if (value.attemptId !== attemptId) return false
  if (typeof value.submissionId !== 'string' || value.submissionId.length < 32) return false
  if (!isRecord(value.answers) || !Object.values(value.answers).every(item => typeof item === 'string')) return false
  if (!Number.isInteger(value.timeSpent) || Number(value.timeSpent) < 0) return false
  if (!['manual', 'deadline', 'anti_cheat'].includes(String(value.reason))) return false
  return typeof value.createdAt === 'string' && !Number.isNaN(Date.parse(value.createdAt))
}

function isValidDraft(value: unknown, identity: ExamDraftIdentity): value is ExamDraft {
  if (!isRecord(value) || value.version !== EXAM_DRAFT_VERSION) return false
  if (String(value.userId) !== String(identity.userId)) return false
  if (String(value.taskId) !== String(identity.taskId)) return false
  if (String(value.examId) !== String(identity.examId)) return false
  if (String(value.attemptId) !== identity.attemptId) return false
  if (!isRecord(value.answers) || !Object.values(value.answers).every(item => typeof item === 'string')) return false
  if (!Array.isArray(value.flagged) || !value.flagged.every(Number.isInteger)) return false
  if (value.pendingSubmission != null && !isValidPendingSubmission(value.pendingSubmission, identity.attemptId)) {
    return false
  }
  return typeof value.savedAt === 'string' && !Number.isNaN(Date.parse(value.savedAt))
}

export async function saveExamDraft(
  storage: ExamVaultAdapter,
  identity: ExamDraftIdentity,
  state: ExamDraftState,
  now: () => string = () => new Date().toISOString(),
) {
  const savedAt = now()
  const draft: ExamDraft = { version: EXAM_DRAFT_VERSION, ...identity, ...state, savedAt }
  try {
    await storage.write(examDraftKey(identity), JSON.stringify(draft))
    return { ok: true as const, savedAt }
  } catch {
    return { ok: false as const }
  }
}

export async function readExamDraft(
  storage: ExamVaultAdapter,
  identity: ExamDraftIdentity,
): Promise<ExamDraftReadResult> {
  let raw: string | null
  try {
    raw = await storage.read(examDraftKey(identity))
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
    await storage.remove(examDraftKey(identity))
  } catch {
    // 清理失败不应阻断考试页。
  }
  return { status: 'invalid' }
}

export async function clearExamDraft(storage: ExamVaultAdapter, identity: ExamDraftIdentity) {
  try {
    await storage.remove(examDraftKey(identity))
    return true
  } catch {
    return false
  }
}
