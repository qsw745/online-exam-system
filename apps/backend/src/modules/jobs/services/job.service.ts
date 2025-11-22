import type { SchedulerJob } from '../domain/job.model'
import { JobRepository } from '../repositories/job.repository'

export class JobService {
  list(): Promise<SchedulerJob[]> {
    return JobRepository.list()
  }

  async create(payload: { name: string; cron: string; handler: string; status?: string; description?: string; meta?: any }) {
    const id = await JobRepository.create(payload)
    return id
  }

  async update(id: number, payload: { name?: string; cron?: string; handler?: string; status?: string; description?: string; meta?: any }) {
    await JobRepository.update(id, payload)
  }

  async remove(id: number) {
    await JobRepository.remove(id)
  }
}
