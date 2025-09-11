// apps/web/src/features/roles/pages/RoleManagementPage.tsx
import { PlusOutlined } from '@ant-design/icons'
import { App, Button, Card, Input, Pagination, Space } from 'antd'
import React, { useEffect, useState } from 'react'
import { useOrgTree } from '@/shared/hooks/useOrgTree'
import OrgSelectModal from '../components/OrgSelectModal'
import { PermissionModal } from '../components/PermissionModal'
import RoleFormModal from '../components/RoleFormModal'
import RoleMembersModal from '../components/RoleMembersModal'
import { RolesTable } from '../components/RolesTable'
import UserSelectModal from '../components/UserSelectModal'
import { useRoleMembers } from '../hooks/useRoleMembers'
import { useRolePermissions } from '../hooks/useRolePermissions'
import { useRoles } from '../hooks/useRoles'
import { rolesApi } from '@/shared/api/endpoints/roles' // ✅ 使用封装好的 API

export default function RoleManagementPage() {
  const { message } = App.useApp()

  // 角色列表
  const roles = useRoles()
  useEffect(() => {
    roles.load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 权限
  const perms = useRolePermissions()

  // 成员
  const members = useRoleMembers()

  // 机构树（仅提供树数据）
  const orgsTree = useOrgTree()

  // —— 新建/编辑角色 —— //
  const [formOpen, setFormOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<null | {
    id?: number
    name?: string
    code?: string
    description?: string
  }>(null)

  // —— 按机构添加用户 —— //
  const [orgOpen, setOrgOpen] = useState(false)
  const [orgChecked, setOrgChecked] = useState<React.Key[]>([])

  const handleOrgOk = async (): Promise<void> => {
    if (!members.role) return
    // React.Key[] -> number[]
    const orgIds = orgChecked.map(n => Number(n)).filter(n => Number.isFinite(n)) as number[]
    if (orgIds.length === 0) {
      message.warning('请选择要关联的机构')
      return
    }
    try {
      // ✅ 调后端：POST /roles/:id/orgs  Body: { orgIds: number[] }
      const resp = await rolesApi.addRoleOrgs(members.role.id, orgIds)
      if ((resp as any)?.success === false) {
        throw new Error((resp as any)?.message || '关联机构失败')
      }
      message.success((resp as any)?.message || `成功关联 ${orgIds.length} 个机构`)
      setOrgOpen(false)
      setOrgChecked([])
      // 业务需要的话，可以在这里刷新角色-机构或成员：
      if (members.role) await members.openFor(members.role)
    } catch (e: any) {
      message.error(e?.message || '关联机构失败')
    }
  }

  const openOrgSelect = async (): Promise<void> => {
    setOrgChecked([])
    setOrgOpen(true)
  }

  // —— 分页兜底，避免 NaN —— //
  const safeTotal = Number.isFinite(Number(roles.total)) ? Number(roles.total) : 0
  const safePageSize = Math.max(1, Number(roles.pageSize) || 10)
  const safePage = Math.max(1, Number(roles.page) || 1)

  return (
    <div className="p-6">
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">角色管理</h2>
          <Space>
            <Input.Search
              placeholder="搜索角色名称或编码"
              allowClear
              style={{ width: 300 }}
              value={roles.keyword}
              onChange={e => roles.setKeyword(e.target.value)}
              onSearch={v => roles.load(1, safePageSize, v)}
              onClear={() => roles.load(1, safePageSize, '')}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingRole(null)
                setFormOpen(true)
              }}
            >
              新建角色
            </Button>
          </Space>
        </div>

        <RolesTable
          data={roles.list}
          loading={roles.loading}
          onEdit={r => {
            setEditingRole({ id: r.id, name: r.name, code: r.code, description: r.description || '' })
            setFormOpen(true)
          }}
          onDelete={r => roles.remove(r.id)}
          onPermission={r => perms.openFor(r)}
          onMembers={r => members.openFor(r)}
        />

        <div className="mt-4">
          <Pagination
            current={safePage}
            total={safeTotal}
            pageSize={safePageSize}
            showSizeChanger
            showQuickJumper
            onChange={(p, s) => roles.load(Number(p) || 1, Number(s) || safePageSize, roles.keyword)}
            onShowSizeChange={(_p, s) => roles.load(1, Number(s) || safePageSize, roles.keyword)}
            showTotal={(t, [start, end]) => `共 ${Number(t) || 0} 条，当前 ${Number(start) || 0}-${Number(end) || 0}`}
          />
        </div>
      </Card>

      {/* 权限设置 */}
      <PermissionModal
        open={perms.open}
        role={perms.role}
        treeData={perms.treeData}
        checkedKeys={perms.selected}
        setCheckedKeys={perms.setSelected}
        onRefreshMenus={perms.role ? perms.openFor.bind(null, perms.role) : () => {}}
        onOk={perms.save}
        onCancel={() => perms.setOpen(false)}
      />

      {/* 成员管理 */}
      <RoleMembersModal
        open={members.open}
        role={members.role}
        loading={members.loading}
        members={members.members}
        onClose={() => members.setOpen(false)}
        onRemove={async (userId: number) => {
          await members.remove(userId)
        }}
        onOpenUserSelect={async () => {
          await members.openUserSelect()
        }}
        onOpenOrgSelect={openOrgSelect}
        onRefresh={() => (members.role ? members.openFor(members.role) : null)}
      />

      {/* 选人弹窗 */}
      <UserSelectModal
        open={members.userOpen}
        loading={members.userLoading}
        users={members.candidateUsers}
        selected={members.selectedIds}
        onChangeSelected={members.setSelectedIds}
        onCancel={() => members.setUserOpen(false)}
        onOk={async () => {
          await members.addUsers()
        }}
      />

      {/* 机构选择（按机构添加用户） */}
      <OrgSelectModal
        open={orgOpen}
        loading={orgsTree.loading}
        treeData={orgsTree.tree}
        checked={orgChecked}
        onCheck={setOrgChecked}
        onCancel={() => setOrgOpen(false)}
        onOk={handleOrgOk}
      />

      {/* 新建/编辑 角色 */}
      <RoleFormModal
        open={formOpen}
        role={editingRole}
        onCancel={() => setFormOpen(false)}
        onOk={async payload => {
          if (editingRole?.id) {
            await roles.update(editingRole.id, payload)
          } else {
            await roles.create(payload)
          }
          setFormOpen(false)
        }}
      />
    </div>
  )
}
