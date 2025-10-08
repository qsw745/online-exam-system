import { AdminSettingsRepository } from '@/modules/admin-settings/repositories/admin-settings.repository'

export async function validateStrongPassword(pwd: string) {
    const s = await AdminSettingsRepository.get()
    if (!s.enableStrongPassword) return // 不启用则直接通过
    if (!pwd || typeof pwd !== 'string') throw new Error('密码不能为空')

    // 优先正则
    if (s.strongPasswordRegex && s.strongPasswordRegex.trim()) {
        const re = new RegExp(s.strongPasswordRegex)
        if (!re.test(pwd)) throw new Error('密码不符合强度要求')
        return
    }

    const minLen = Math.max(1, Number(s.strongPasswordMinLength ?? 8))
    if (pwd.length < minLen) throw new Error(`密码至少需要 ${minLen} 位`)

    if (s.strongPasswordRequireUpper && !/[A-Z]/.test(pwd)) throw new Error('需包含大写字母')
    if (s.strongPasswordRequireLower && !/[a-z]/.test(pwd)) throw new Error('需包含小写字母')
    if (s.strongPasswordRequireDigit && !/[0-9]/.test(pwd)) throw new Error('需包含数字')
    if (s.strongPasswordRequireSpecial && !/[^\w\s]/.test(pwd)) throw new Error('需包含特殊字符')
}
