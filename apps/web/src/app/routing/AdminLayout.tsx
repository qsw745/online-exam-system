// src/app/routing/AdminLayout.tsx
import { Navigate } from 'react-router-dom'
import RefreshableOutlet from '@/shared/router/RefreshableOutlet'

export default function AdminLayout() {
  const role = localStorage.getItem('userRole') // 或从你的 AuthContext 读取
  const allowed = role === 'admin' || role === 'teacher'
  if (!allowed) return <Navigate to="/dashboard" replace />
  return <RefreshableOutlet />
}
