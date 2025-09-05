// features/settings/services/settings.service.ts
import { settings as raw } from '@shared/api/http'
import type { UserSettings } from '../types/settings'

type ApiSuccess<T> = { success: true; data: T; message?: string }
type ApiFailure = { success: false; error?: string; message?: string }
type ApiResult<T> = ApiSuccess<T> | ApiFailure

export const settingsService = {
  async get(): Promise<UserSettings | null> {
    const res: ApiResult<any> = await raw.get()
    if (!res || (res as any).success === false) return null
    return (res as ApiSuccess<UserSettings>).data
  },
  async save(payload: UserSettings): Promise<boolean> {
    const res: ApiResult<any> = await raw.save(payload)
    return !!res && (res as any).success === true
  },
}
