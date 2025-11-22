import type { SystemConfig } from '../domain/config.model'
import { ConfigRepository } from '../repositories/config.repository'

export class ConfigService {
  list(): Promise<SystemConfig[]> {
    return ConfigRepository.list()
  }

  async create(payload: {
    config_key: string
    config_name: string
    config_value?: string
    value_type?: string
    enabled?: boolean
    description?: string
  }) {
    const id = await ConfigRepository.create({
      ...payload,
      enabled: payload.enabled === undefined ? 1 : payload.enabled ? 1 : 0,
    })
    return id
  }

  async update(id: number, payload: any) {
    const normalized = { ...payload }
    if (payload.enabled !== undefined) normalized.enabled = payload.enabled ? 1 : 0
    await ConfigRepository.update(id, normalized)
  }

  async remove(id: number) {
    await ConfigRepository.remove(id)
  }
}
