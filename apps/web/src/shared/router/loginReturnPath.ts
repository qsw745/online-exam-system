/** 仅接受站内路径，并阻止登录循环及外部地址跳转。 */
export function getLoginReturnPath(state: unknown, search = ''): string | null {
  const from = state && typeof state === 'object' && 'from' in state ? state.from : null
  const location = from && typeof from === 'object' ? from as Record<string, unknown> : null
  const raw = typeof from === 'string' ? from : typeof location?.pathname === 'string'
    ? `${location.pathname}${typeof location.search === 'string' ? location.search : ''}${typeof location.hash === 'string' ? location.hash : ''}`
    : new URLSearchParams(search).get('returnTo')
  if (!raw || !raw.startsWith('/')) return null
  try {
    const decoded = decodeURIComponent(raw)
    const hasControlCharacter = [...decoded].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
    if (decoded.startsWith('//') || decoded.includes('\\') || hasControlCharacter) return null
    const url = new URL(raw, 'https://app.invalid')
    if (url.origin !== 'https://app.invalid' || /^\/(?:login|register|forgot-password|reset-password|verify-email|oauth)(?:\/|$)/i.test(decodeURIComponent(url.pathname))) return null
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}
