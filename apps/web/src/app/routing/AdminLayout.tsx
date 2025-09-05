// src/app/routing/AdminLayout.tsx
import { Navigate, Outlet } from 'react-router-dom'

export default function AdminLayout() {
  const role = localStorage.getItem('userRole') // 或从你的 AuthContext 读取
  const allowed = role === 'admin' || role === 'teacher'
  if (!allowed) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
