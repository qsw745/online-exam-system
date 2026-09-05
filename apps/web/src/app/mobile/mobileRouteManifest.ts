export type MobileRouteDefinition = {
  path: string
  auth: 'public' | 'required'
  immersive?: boolean
}

export const mobileRouteManifest = [
  { path: '/login', auth: 'public' },
  { path: '/register', auth: 'public' },
  { path: '/forgot-password', auth: 'public' },
  { path: '/reset-password', auth: 'public' },
  { path: '/verify-email', auth: 'public' },
  { path: '/oauth/callback', auth: 'public' },
  { path: '/legal/terms', auth: 'public' },
  { path: '/legal/privacy', auth: 'public' },
  { path: '/account-deletion', auth: 'public' },
  { path: '/dashboard', auth: 'required' },
  { path: '/tasks/my', auth: 'required' },
  { path: '/tasks/detail/:id', auth: 'required' },
  { path: '/student/learning', auth: 'required' },
  { path: '/learning/practice', auth: 'required' },
  { path: '/learning/practice/:id', auth: 'required' },
  { path: '/practice/:id', auth: 'required' },
  { path: '/learning/wrong-questions', auth: 'required' },
  { path: '/learning/favorites', auth: 'required' },
  { path: '/learning/progress', auth: 'required' },
  { path: '/questions/:id/practice', auth: 'required' },
  { path: '/questions/:id', auth: 'required' },
  { path: '/wrong-questions', auth: 'required' },
  { path: '/favorites', auth: 'required' },
  { path: '/profile', auth: 'required' },
  { path: '/settings', auth: 'required' },
  { path: '/exam/:id', auth: 'required', immersive: true },
  { path: '/exam/task/:taskId', auth: 'required', immersive: true },
  { path: '/exam/results', auth: 'required' },
  { path: '/results', auth: 'required' },
  { path: '/results/:id', auth: 'required' },
  { path: '/proctoring/reviews/:caseId', auth: 'required' },
  { path: '/shared/favorites/:code', auth: 'public' },
] as const satisfies readonly MobileRouteDefinition[]
