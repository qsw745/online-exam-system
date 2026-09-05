import type { ComponentType, LazyExoticComponent, ReactElement } from 'react'
import { createElement, lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, ScrollRestoration } from 'react-router-dom'

import NotFound404 from '@/app/errors/NotFound404'
import ServerError500 from '@/app/errors/ServerError500'
import RouterRoot from '@/app/routing/RouterRoot'
import LoadingSpinner from '@/shared/components/LoadingSpinner'
import { appBasePath } from '@/shared/router/basePath'

import MobileAppLayout from './MobileAppLayout'
import { mobileRouteManifest } from './mobileRouteManifest'

const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'))
const RegisterPage = lazy(() => import('@/features/auth/pages/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('@/features/auth/pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/features/auth/pages/ResetPasswordPage'))
const VerifyEmailPage = lazy(() => import('@/features/auth/pages/VerifyEmailPage'))
const OAuthCallbackPage = lazy(() => import('@/features/auth/pages/OAuthCallbackPage'))
const LegalDocumentPage = lazy(() => import('@/features/legal/pages/LegalDocumentPage'))
const AccountDeletionPage = lazy(() => import('@/features/account/pages/AccountDeletionPage'))
const SharedFavoritePage = lazy(() => import('@/features/favorites/pages/SharedFavoritePage'))
const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage'))
const MyTasksPage = lazy(() => import('@/features/tasks/pages/MyTasksPage'))
const TaskDetailPage = lazy(() => import('@/features/tasks/pages/TaskDetailPage'))
const StudentLearningHubPage = lazy(() => import('@/features/learning/pages/StudentLearningHubPage'))
const LearningProgressPage = lazy(() => import('@/features/learning-progress/pages/LearningProgressPage'))
const QuestionPracticePage = lazy(() => import('@/features/questions/pages/QuestionPracticePage'))
const WrongQuestionsPage = lazy(() => import('@/features/wrong-questions/pages/WrongQuestionsPage'))
const FavoritesPage = lazy(() => import('@/features/favorites/pages/FavoritesPage'))
const ProfilePage = lazy(() => import('@/features/profile/pages/ProfilePage'))
const UserSettingsPage = lazy(() => import('@/features/settings/pages/UserSettingsPage'))
const ExamPage = lazy(() => import('@/features/exams/pages/ExamPage'))
const ResultsPage = lazy(() => import('@/features/exams/pages/ResultsPage'))
const ResultDetailPage = lazy(() => import('@/features/exams/pages/ResultDetailPage'))
const MyProctoringReviewPage = lazy(() => import('@/features/proctoring-review/pages/MyProctoringReviewPage'))

type MobileRoutePath = (typeof mobileRouteManifest)[number]['path']
type MobilePage = LazyExoticComponent<ComponentType>

const mobilePages = {
  '/login': LoginPage,
  '/register': RegisterPage,
  '/forgot-password': ForgotPasswordPage,
  '/reset-password': ResetPasswordPage,
  '/verify-email': VerifyEmailPage,
  '/oauth/callback': OAuthCallbackPage,
  '/legal/terms': LegalDocumentPage,
  '/legal/privacy': LegalDocumentPage,
  '/account-deletion': AccountDeletionPage,
  '/shared/favorites/:code': SharedFavoritePage,
  '/dashboard': DashboardPage,
  '/tasks/my': MyTasksPage,
  '/tasks/detail/:id': TaskDetailPage,
  '/student/learning': StudentLearningHubPage,
  '/learning/practice': QuestionPracticePage,
  '/learning/practice/:id': QuestionPracticePage,
  '/practice/:id': QuestionPracticePage,
  '/learning/wrong-questions': WrongQuestionsPage,
  '/learning/favorites': FavoritesPage,
  '/learning/progress': LearningProgressPage,
  '/questions/:id/practice': QuestionPracticePage,
  '/questions/:id': QuestionPracticePage,
  '/wrong-questions': WrongQuestionsPage,
  '/favorites': FavoritesPage,
  '/profile': ProfilePage,
  '/settings': UserSettingsPage,
  '/exam/:id': ExamPage,
  '/exam/task/:taskId': ExamPage,
  '/exam/results': ResultsPage,
  '/results': ResultsPage,
  '/results/:id': ResultDetailPage,
  '/proctoring/reviews/:caseId': MyProctoringReviewPage,
} satisfies Record<MobileRoutePath, MobilePage>

const withSuspense = (element: ReactElement) => (
  <Suspense fallback={<LoadingSpinner center="page" text="正在载入问衡…" />}>{element}</Suspense>
)

const publicRoutes = mobileRouteManifest
  .filter((route) => route.auth === 'public')
  .map((route) => ({
    path: route.path.slice(1),
    element: withSuspense(createElement(mobilePages[route.path])),
  }))

const requiredRoutes = mobileRouteManifest
  .filter((route) => route.auth === 'required')
  .map((route) => ({
    path: route.path.slice(1),
    element: withSuspense(createElement(mobilePages[route.path])),
  }))

export const mobileRouter = createBrowserRouter(
  [
    {
      path: '/',
      element: <><RouterRoot /><ScrollRestoration /></>,
      errorElement: <ServerError500 />,
      children: [
        { index: true, element: <Navigate to="/dashboard" replace /> },
        ...publicRoutes,
        {
          element: <MobileAppLayout />,
          children: requiredRoutes,
        },
        { path: '*', element: <NotFound404 /> },
      ],
    },
  ],
  { basename: appBasePath },
)
