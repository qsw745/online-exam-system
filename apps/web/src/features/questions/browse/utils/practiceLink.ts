// utils/practiceLink.ts
export function buildPracticeLink(firstId: string, filters: { type?: string; difficulty?: string; search?: string }) {
  const qs = new URLSearchParams({ mode: 'continuous' })
  if (filters.type && filters.type !== 'all') qs.set('type', filters.type)
  if (filters.difficulty && filters.difficulty !== 'all') qs.set('difficulty', filters.difficulty)
  if (filters.search) qs.set('search', filters.search)
  return `/questions/${firstId}/practice?${qs.toString()}`
}
