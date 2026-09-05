import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  loadLoginEmailPreference,
  saveLoginEmailPreference,
} from './loginEmailPreference'

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()

  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, String(value)) }
}

describe('loginEmailPreference', () => {
  beforeAll(() => {
    vi.stubGlobal('localStorage', new MemoryStorage())
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    localStorage.clear()
  })

  it('未勾选记住我时不恢复并清除残留邮箱', () => {
    localStorage.setItem('remember_me_flag', '0')
    localStorage.setItem('last_login_email', 'previous@example.com')

    expect(loadLoginEmailPreference()).toEqual({
      rememberMe: false,
      email: '',
    })
    expect(localStorage.getItem('last_login_email')).toBeNull()
  })

  it('勾选记住我时恢复已保存邮箱', () => {
    localStorage.setItem('remember_me_flag', '1')
    localStorage.setItem('last_login_email', 'student@demo.com')

    expect(loadLoginEmailPreference()).toEqual({
      rememberMe: true,
      email: 'student@demo.com',
    })
  })

  it('关闭记住我时立即删除已保存邮箱', () => {
    localStorage.setItem('last_login_email', 'student@demo.com')

    saveLoginEmailPreference(false, 'student@demo.com')

    expect(localStorage.getItem('remember_me_flag')).toBe('0')
    expect(localStorage.getItem('last_login_email')).toBeNull()
  })
})
