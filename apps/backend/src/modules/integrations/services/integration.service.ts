import type { Integration } from '../domain/integration.model'
import { IntegrationRepository } from '../repositories/integration.repository'

export class IntegrationService {
  list(type?: string): Promise<Integration[]> {
    return IntegrationRepository.list(type)
  }

  async create(payload: {
    name: string
    type: string
    endpoint?: string
    config?: any
    enabled?: boolean
    description?: string
  }) {
    const id = await IntegrationRepository.create({
      ...payload,
      enabled: payload.enabled === undefined ? 1 : payload.enabled ? 1 : 0,
    })
    return id
  }

  async update(id: number, payload: Partial<Integration>) {
    const normalized = { ...payload }
    if (payload.enabled !== undefined) normalized.enabled = payload.enabled ? 1 : 0
    await IntegrationRepository.update(id, normalized)
  }

  async remove(id: number) {
    await IntegrationRepository.remove(id)
  }
}
