// 页面壳：只负责挂载组件，便于复用与维护
import React from 'react'
import RoleManagementComponent from '@/features/roles/components/RoleManagementComponent'

export default function RoleManagementPage() {
  return <RoleManagementComponent />
}
