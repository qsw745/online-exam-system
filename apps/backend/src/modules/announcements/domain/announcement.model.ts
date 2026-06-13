export type AnnouncementStatus = 'draft' | 'published'

export interface Announcement {
  id: number
  title: string
  content: string
  status: AnnouncementStatus
  published_at?: Date | null
  created_by?: number | null
  created_at: Date
  updated_at: Date
}
