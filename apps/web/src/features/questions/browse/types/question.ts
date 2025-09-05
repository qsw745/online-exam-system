// types/question.ts
export interface Question {
  id: string
  content: string
  type: string
  difficulty: string
  knowledge_point: string
  created_at: string
  updated_at: string
}
export interface PaginationState {
  currentPage: number
  totalPages: number
  totalQuestions: number
  pageSize: number
}
export type ViewType = 'all' | 'favorites' | 'wrong' | 'browse' | 'manage'
export interface Filters {
  searchTerm: string
  filterType: string
  filterDifficulty: string
}
