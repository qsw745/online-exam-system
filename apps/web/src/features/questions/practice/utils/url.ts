// features/questions/practice/utils/url.ts
export type PracticeFilters = { type?: string; difficulty?: string; search?: string }

export function buildContinuousQuery(filters: PracticeFilters) {
  const qs = new URLSearchParams()
  qs.set('mode', 'continuous')
  if (filters.type) qs.set('type', filters.type)
  if (filters.difficulty) qs.set('difficulty', filters.difficulty)
  if (filters.search) qs.set('search', filters.search)
  return qs.toString()
}

export function parseFilters(search: string): { mode: 'single' | 'continuous'; filters: PracticeFilters } {
  const sp = new URLSearchParams(search)
  const mode = (sp.get('mode') as any) === 'continuous' ? 'continuous' : 'single'
  return {
    mode,
    filters: {
      type: sp.get('type') || undefined,
      difficulty: sp.get('difficulty') || undefined,
      search: sp.get('search') || undefined,
    },
  }
}
