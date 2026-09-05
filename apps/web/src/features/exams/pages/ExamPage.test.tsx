import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ExamPage from './ExamPage'

const mocks = vi.hoisted(() => ({
  startExam: vi.fn(), submit: vi.fn(), flushDraft: vi.fn(), clearDraft: vi.fn(), navigate: vi.fn(),
  message: { error: vi.fn(), info: vi.fn(), warning: vi.fn(), success: vi.fn() },
  modal: { confirm: vi.fn() }, destroy: vi.fn(),
  t: (key: string) => key,
  proctoring: { required: false, canAnswer: true },
}))
vi.mock('antd', async importOriginal => ({
  ...await importOriginal<typeof import('antd')>(), App: { useApp: () => ({ message: mocks.message, modal: mocks.modal }) },
}))
vi.mock('react-router-dom', () => ({ useLocation: () => ({}), useParams: () => ({ taskId: '42' }), useNavigate: () => mocks.navigate }))
vi.mock('@/shared/contexts/LanguageContext', () => ({ useLanguage: () => ({ t: mocks.t }) }))
vi.mock('@/shared/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 21 } }) }))
vi.mock('@/shared/hooks/useOnlineStatus', () => ({ useOnlineStatus: () => true }))
vi.mock('@/shared/api/endpoints/tasks', () => ({ tasksApi: mocks }))
vi.mock('@/shared/api/http', () => ({ isSuccess: (res: { success: boolean }) => res.success }))
vi.mock('@/platform/exam-vault', () => ({ resolveExamVaultAdapter: () => null }))
vi.mock('@/features/exams/proctoring/useStrictProctoring', () => ({ useStrictProctoring: () => mocks.proctoring }))
vi.mock('@/features/exams/proctoring/StrictProctoringGate', () => ({ StrictProctoringGate: () => null }))
vi.mock('@/features/exams/proctoring/StrictProctoringStatusCard', () => ({ StrictProctoringStatusCard: () => null }))
vi.mock('@/features/exams/hooks/useExamDraft', () => ({ useExamDraft: () => ({
  status: 'saved', ready: true, savedAt: null, clearDraft: mocks.clearDraft, flushDraft: mocks.flushDraft,
}) }))

function exam(remainingMs = 600_000) {
  return { success: true, data: {
    taskId: 42, examId: 8, resultId: 700, paperId: 9, attemptId: '6745d94e-7d93-4a39-b348-26d8a979ee7d',
    status: 'in_progress', title: '可靠性交卷测试', duration: 10, serverNow: new Date().toISOString(),
    deadlineAt: new Date(Date.now() + remainingMs).toISOString(), questions: [],
  } }
}
async function openConfirmation() {
  fireEvent.click(await screen.findByRole('button', { name: 'app.submit' }))
  return mocks.modal.confirm.mock.calls[mocks.modal.confirm.mock.calls.length - 1][0]
}

describe('考试交卷边界', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.startExam.mockResolvedValue(exam())
    mocks.flushDraft.mockResolvedValue(true)
    mocks.clearDraft.mockResolvedValue(true)
    mocks.submit.mockResolvedValue({ success: true, data: { resultId: 700 } })
    mocks.modal.confirm.mockReturnValue({ destroy: mocks.destroy })
  })
  it('保存失败时不发送交卷、不声称已安全排队', async () => {
    mocks.flushDraft.mockResolvedValue(false)
    render(<ExamPage />)
    const dialog = await openConfirmation()
    await act(async () => dialog.onOk())
    expect(mocks.submit).not.toHaveBeenCalled()
    expect(mocks.navigate).not.toHaveBeenCalled()
    expect(mocks.message.error).toHaveBeenCalledWith(expect.stringContaining('尚未提交'))
    expect(screen.queryByText('交卷已安全排队')).toBeNull()
  })
  it('只打开一个确认弹窗，交卷后使用回执中的成绩 ID', async () => {
    mocks.submit.mockResolvedValue({ success: true, data: { resultId: 701 } })
    render(<ExamPage />)
    const dialog = await openConfirmation()
    fireEvent.click(screen.getByRole('button', { name: 'app.submit' }))
    expect(mocks.modal.confirm).toHaveBeenCalledTimes(1)
    await act(async () => dialog.onOk())
    expect(mocks.submit).toHaveBeenCalledTimes(1)
    expect(mocks.navigate).toHaveBeenCalledWith('/results/701', { replace: true })
  })
  it('网络失败后的重试复用提交编号与答案', async () => {
    mocks.submit.mockResolvedValueOnce({ success: false, error: '网络异常' }).mockResolvedValueOnce({ success: true, data: { resultId: 700 } })
    render(<ExamPage />)
    const dialog = await openConfirmation()
    await act(async () => dialog.onOk())
    const original = mocks.submit.mock.calls[0]
    fireEvent.click(screen.getAllByRole('button', { name: '重试交卷' })[0])
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalled())
    expect(mocks.submit.mock.calls[1]).toEqual(original)
    expect(mocks.modal.confirm).toHaveBeenCalledTimes(1)
  })
  it('恢复时已经到期也会自动交卷', async () => {
    mocks.startExam.mockResolvedValue(exam(0))
    render(<ExamPage />)
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/results/700', { replace: true }))
    expect(mocks.submit).toHaveBeenCalledTimes(1)
  })
  it('到时自动交卷可关闭尚未确认的弹窗，且只提交一次', async () => {
    mocks.startExam.mockResolvedValue(exam(1700))
    render(<ExamPage />)
    await openConfirmation()
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/results/700', { replace: true }), { timeout: 2500 })
    expect(mocks.destroy).toHaveBeenCalledTimes(1)
    expect(mocks.submit).toHaveBeenCalledTimes(1)
  })
})
