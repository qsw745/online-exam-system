import { api } from '../core/httpClient'
import type { ApiResult } from '../core/types'

const AI_TIMEOUT_MS =
  Number((typeof import.meta !== 'undefined' && (import.meta as any)?.env?.VITE_AI_TIMEOUT_MS) || 60000) || 60000

export const aiApi = {
  chat: (payload: { prompt?: string; messages?: any[] }) =>
    api.post('/ai/chat', payload, { timeout: AI_TIMEOUT_MS }) as Promise<ApiResult<any>>,
  agent: (payload: {
    messages: Array<{ role: string; content: string }>
    context?: any
    model?: string
    sessionId?: string
  }) =>
    api.post('/ai/agent', payload, { timeout: AI_TIMEOUT_MS }) as Promise<ApiResult<any>>,
  generateQuestions: (payload: any) =>
    api.post('/ai/questions/generate', payload, { timeout: AI_TIMEOUT_MS }) as Promise<ApiResult<any>>,
  generateQuestionsAsync: (payload: any) =>
    api.post('/ai/questions/generate/async', payload) as Promise<ApiResult<any>>,
  getQuestionJob: (id: string) =>
    api.get(`/ai/questions/generate/jobs/${encodeURIComponent(id)}`) as Promise<ApiResult<any>>,
  explainQuestion: (payload: any) =>
    api.post('/ai/questions/explain', payload, { timeout: AI_TIMEOUT_MS }) as Promise<ApiResult<any>>,
  gradeShortAnswer: (payload: any) =>
    api.post('/ai/answers/grade', payload, { timeout: AI_TIMEOUT_MS }) as Promise<ApiResult<any>>,
  examSummary: (payload: any) =>
    api.post('/ai/exams/summary', payload, { timeout: AI_TIMEOUT_MS }) as Promise<ApiResult<any>>,
  studyPlan: (payload: any) =>
    api.post('/ai/study/plan', payload, { timeout: AI_TIMEOUT_MS }) as Promise<ApiResult<any>>,
  suggestPaper: (payload: any) =>
    api.post('/ai/papers/suggest', payload, { timeout: AI_TIMEOUT_MS }) as Promise<ApiResult<any>>,
  listSessions: () => api.get('/ai/sessions') as Promise<ApiResult<any>>,
  saveSession: (id: string, payload: { title?: string; items?: any[] }) =>
    api.put(`/ai/sessions/${encodeURIComponent(id)}`, payload) as Promise<ApiResult<any>>,
  deleteSession: (id: string) => api.delete(`/ai/sessions/${encodeURIComponent(id)}`) as Promise<ApiResult<any>>,
  addKnowledge: (payload: { title?: string; content: string; tags?: string; source?: string }) =>
    api.post('/ai/knowledge', payload) as Promise<ApiResult<any>>,
  listKnowledge: (params?: { page?: number; limit?: number }) =>
    api.get('/ai/knowledge', { params }) as Promise<ApiResult<any>>,
  searchKnowledge: (payload: { query: string; topK?: number }) =>
    api.post('/ai/knowledge/search', payload) as Promise<ApiResult<any>>,
}
