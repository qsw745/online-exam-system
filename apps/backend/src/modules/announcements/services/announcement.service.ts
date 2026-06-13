import type { Announcement } from '../domain/announcement.model'
import { AnnouncementRepository } from '../repositories/announcement.repository'

export class AnnouncementService {
  listPublished(): Promise<Announcement[]> {
    return AnnouncementRepository.listPublished()
  }

  listAll(): Promise<Announcement[]> {
    return AnnouncementRepository.listAll()
  }

  async create(userId: number | undefined, payload: { title: string; content: string; status?: 'draft' | 'published' }) {
    const now = payload.status === 'published' ? new Date() : null
    const id = await AnnouncementRepository.create({
      title: payload.title,
      content: payload.content,
      status: payload.status ?? 'draft',
      published_at: now,
      created_by: userId ?? null,
    })
    return AnnouncementRepository.findById(id)
  }

  async update(id: number, payload: Partial<{ title: string; content: string; status: 'draft' | 'published' }>) {
    const changes: Partial<{ title: string; content: string; status: 'draft' | 'published'; published_at: Date | null }> = {
      ...payload,
    }
    if (payload.status === 'published') changes.published_at = new Date()
    if (payload.status === 'draft') changes.published_at = null
    await AnnouncementRepository.update(id, changes)
    return AnnouncementRepository.findById(id)
  }

  async publish(id: number) {
    await AnnouncementRepository.update(id, { status: 'published', published_at: new Date() })
    return AnnouncementRepository.findById(id)
  }

  async remove(id: number) {
    await AnnouncementRepository.delete(id)
  }
}
