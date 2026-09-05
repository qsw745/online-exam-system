const REMEMBER_ME_FLAG = 'remember_me_flag'
const LAST_EMAIL_KEY = 'last_login_email'

export function loadLoginEmailPreference() {
  const rememberMe = localStorage.getItem(REMEMBER_ME_FLAG) === '1'
  if (!rememberMe) {
    localStorage.removeItem(LAST_EMAIL_KEY)
    return { rememberMe: false, email: '' }
  }

  return {
    rememberMe: true,
    email: localStorage.getItem(LAST_EMAIL_KEY) || '',
  }
}

export function saveLoginEmailPreference(rememberMe: boolean, email: string) {
  localStorage.setItem(REMEMBER_ME_FLAG, rememberMe ? '1' : '0')
  if (rememberMe) {
    localStorage.setItem(LAST_EMAIL_KEY, email)
    return
  }

  localStorage.removeItem(LAST_EMAIL_KEY)
}
