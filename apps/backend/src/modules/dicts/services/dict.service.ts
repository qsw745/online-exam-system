import type { DictionaryWithItems } from '../domain/dict.model'
import { DictRepository } from '../repositories/dict.repository'

export class DictService {
  async list(): Promise<DictionaryWithItems[]> {
    const dicts = await DictRepository.list()
    const results: DictionaryWithItems[] = []
    for (const dict of dicts) {
      const items = await DictRepository.listItems(dict.id)
      results.push({ ...dict, items })
    }
    return results
  }

  async create(payload: { code: string; name: string; description?: string; enabled?: boolean; sort_order?: number }) {
    const id = await DictRepository.create({
      ...payload,
      enabled: payload.enabled ? 1 : 0,
    })
    return id
  }

  async update(id: number, payload: Partial<{ code: string; name: string; description?: string; enabled?: boolean; sort_order?: number }>) {
    const normalized = { ...payload }
    if (payload.enabled !== undefined) normalized.enabled = payload.enabled ? 1 : 0
    await DictRepository.update(id, normalized)
  }

  async remove(id: number) {
    await DictRepository.remove(id)
  }

  async listItems(dictId: number) {
    return DictRepository.listItems(dictId)
  }

  async createItem(dictId: number, payload: { label: string; value: string; tag?: string; enabled?: boolean; sort_order?: number }) {
    const id = await DictRepository.createItem(dictId, {
      ...payload,
      enabled: payload.enabled ? 1 : 0,
    })
    return id
  }

  async updateItem(id: number, payload: Partial<{ label: string; value: string; tag?: string; enabled?: boolean; sort_order?: number }>) {
    const normalized = { ...payload }
    if (payload.enabled !== undefined) normalized.enabled = payload.enabled ? 1 : 0
    await DictRepository.updateItem(id, normalized)
  }

  async removeItem(id: number) {
    await DictRepository.removeItem(id)
  }
}
