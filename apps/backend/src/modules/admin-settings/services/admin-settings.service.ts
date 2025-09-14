import { AdminSettingsRepository } from '../repositories/admin-settings.repository.js'
import type { SystemSettings } from '../domain/admin-settings.model'

export class AdminSettingsService {
    static async getSafe(): Promise<SystemSettings> {
        const data = await AdminSettingsRepository.get()
        const { defaultPassword, ...safe } = data as any
        return safe
    }

    static async update(payload: Partial<SystemSettings>): Promise<void> {
        await AdminSettingsRepository.update(payload)
    }
}
