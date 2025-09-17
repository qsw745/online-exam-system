/* eslint-disable @typescript-eslint/no-explicit-any */
import { LoginFailureRepository } from '@/modules/auth/repositories/login-failure.repository'

export class AuthLockService {
    constructor(private minutes: number) {}

    async getRecord(email: string, ip: string) {
        return LoginFailureRepository.get(email, ip)
    }

    async isLocked(email: string, ip: string) {
        const rec = await this.getRecord(email, ip)
        if (!rec?.locked_until) return { locked: false as const }
        const untilMs = new Date(rec.locked_until).getTime()
        const remainSec = Math.max(0, Math.ceil((untilMs - Date.now()) / 1000))
        return remainSec > 0
            ? { locked: true as const, untilMs, remainSec }
            : ({ locked: false as const } as const)
    }

    async unlockIfExpired(email: string, ip: string) {
        await LoginFailureRepository.unlockIfExpired(email, ip)
    }

    async hitFail(email: string, ip: string) {
        return LoginFailureRepository.increase(email, ip)
    }

    async reset(email: string, ip: string) {
        await LoginFailureRepository.reset(email, ip)
    }


    /** 统一加锁：一定把 locked_until + fail_count 同步到表里 */
    async lock(email: string, ip: string, minutes?: number, withCount?: number) {
        const ms = (typeof minutes === 'number' && minutes > 0 ? minutes : this.minutes) * 60 * 1000
        const until = new Date(Date.now() + ms)
        await LoginFailureRepository.lockWithCount(email, ip, until, withCount)
        return { untilMs: until.getTime(), remainSec: Math.ceil(ms / 1000) }
    }
}
