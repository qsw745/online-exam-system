// src/app/routing/DynamicRoutes.tsx
import React, { Suspense } from 'react'
import { Route } from 'react-router-dom'
import { useMenuPermissions } from '@/shared/hooks/useMenuPermissions'
import type { MenuItem as CtxMenuItem } from '@/shared/contexts/MenuPermissionContext'
import LoadingSpinner from '@/shared/components/LoadingSpinner'
import { pageRegistry } from './pageRegistry'

type MenuItem = CtxMenuItem

const normalizePath = (p: string) => (p.startsWith('/') ? p.slice(1) : p)

type ProtectedRouteProps = { children: React.ReactNode; requiredPath: string }

function ProtectedRoute({ children, requiredPath }: ProtectedRouteProps) {
  const { hasMenuPermission } = useMenuPermissions()
  if (!hasMenuPermission(requiredPath)) return null
  return <>{children}</>
}

const withSuspense = (el: JSX.Element) => <Suspense fallback={<LoadingSpinner />}>{el}</Suspense>

export default function DynamicRoutes() {
  const { flatMenus, loading, error } = useMenuPermissions()
  if (loading || error) return <></>

  const routeMenus = flatMenus.filter(
    (m): m is MenuItem & { path: string } => typeof m.path === 'string' && m.path.length > 0
  )

  return (
    <>
      {routeMenus.map(menu => {
        const Component = pageRegistry[menu.path!]
        if (!Component) return null
        const routePath = normalizePath(menu.path!)
        return (
          <Route
            key={menu.id}
            path={routePath}
            element={<ProtectedRoute requiredPath={menu.path!}>{withSuspense(<Component />)}</ProtectedRoute>}
          />
        )
      })}
    </>
  )
}
