import { pool } from '@/config/database.js'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'
import type { SystemSettings } from '../domain/admin-settings.model'

const DEFAULTS: SystemSettings = {
    systemName: '在线考试系统',
    allowUserRegistration: true,
    maxLoginAttempts: 5,

    // 新增默认
    enableCaptcha: true,
    captchaAfterFailed: 3,
    enableStrongPassword: true,
    strongPasswordRegex: '',
    strongPasswordMinLength: 8,
    strongPasswordRequireUpper: true,
    strongPasswordRequireLower: true,
    strongPasswordRequireDigit: true,
    strongPasswordRequireSpecial: false,

    aiEnabled: false,
    aiProvider: 'deepseek',
    aiBaseUrl: 'https://api.deepseek.com',
    aiApiKey: '',
    aiModel: 'deepseek-v4-flash',
    aiAllowedModels: 'deepseek-v4-flash,deepseek-v4-pro',
    aiTemperature: 0.2,
    aiMaxTokens: 1200,
    aiTimeoutMs: 60000,
    aiThinkingMode: 'disabled',
}

export class AdminSettingsRepository {
    static async get(): Promise<SystemSettings> {
        const [rows] = await pool.query<RowDataPacket[]>(`SELECT data FROM system_settings WHERE id = 1 LIMIT 1`)
        const raw = rows?.[0]?.data
        if (!raw) return DEFAULTS
        try {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
            return { ...DEFAULTS, ...parsed }
        } catch {
            return DEFAULTS
        }
    }

    static async update(payload: Partial<SystemSettings>): Promise<SystemSettings> {
        const current = await this.get()
        const next: SystemSettings = { ...current, ...payload }
        const json = JSON.stringify(next)
        await pool.query<ResultSetHeader>(
            `INSERT INTO system_settings (id, data, updated_at)
             VALUES (1, ?, NOW())
                 ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = NOW()`,
            [json]
        )
        return next
    }
}
