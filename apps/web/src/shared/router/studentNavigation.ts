export function isStudentExamPath(pathname: string) {
  return /^\/exam\/(?:task\/)?(?!results\/?$)[^/]+\/?$/.test(pathname)
}

export function getStudentNavSection(pathname: string) {
  if (/^\/tasks(?:\/|$)/.test(pathname)) return '/tasks/my'
  if (/^\/(?:student\/learning|learning|practice|questions|wrong-questions|favorites)(?:\/|$)/.test(pathname)) {
    return '/student/learning'
  }
  if (/^\/(?:profile|settings|results|exam\/results|proctoring\/reviews)(?:\/|$)/.test(pathname)) return '/profile'
  return '/dashboard'
}
