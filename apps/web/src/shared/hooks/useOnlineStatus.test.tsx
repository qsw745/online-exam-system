import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useOnlineStatus } from './useOnlineStatus'

const originalOnline = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine')

afterEach(() => {
  if (originalOnline) Object.defineProperty(Navigator.prototype, 'onLine', originalOnline)
  else delete (Navigator.prototype as unknown as Record<string, unknown>).onLine
})

describe('useOnlineStatus', () => {
  it('响应浏览器离线和在线事件', () => {
    Object.defineProperty(Navigator.prototype, 'onLine', { configurable: true, get: () => true })
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(true)

    act(() => window.dispatchEvent(new Event('offline')))
    expect(result.current).toBe(false)

    act(() => window.dispatchEvent(new Event('online')))
    expect(result.current).toBe(true)
  })
})
