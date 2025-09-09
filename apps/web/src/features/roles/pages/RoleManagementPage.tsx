// pages/RoleManagementPage.tsx
import { PlusOutlined } from '@ant-design/icons'
import { App, Button, Card, Input, Pagination, Space } from 'antd'
import { useEffect } from 'react'
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

export default function RoleManagementPage() {
  const { message } = App.useApp()

  // 角色列表
  const roles = useRoles()
  useEffect(() => {
    roles.load()
  }, []) // 首次加载

  // 权限
  const perms = useRolePermissions()

  // 成员
  const members = useRoleMembers()

  // 机构
  const orgs = useOrgTree()

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
              onSearch={v => roles.load(1, roles.pageSize, v)}
              onClear={() => roles.load(1, roles.pageSize, '')}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => RoleFormModal.open({ onOk: roles.create })}>
              新建角色
            </Button>
          </Space>
        </div>

        <RolesTable
          data={roles.list}
          loading={roles.loading}
          onEdit={r => RoleFormModal.open({ role: r, onOk: p => roles.update(r.id, p) })}
          onDelete={r => roles.remove(r.id)}
          onPermission={r => perms.openFor(r)}
          onMembers={r => members.openFor(r)}
        />

        <div className="mt-4">
          <Pagination
            current={roles.page}
            total={roles.total}
            pageSize={roles.pageSize}
            showSizeChanger
            showQuickJumper
            onChange={(p, s) => roles.load(p, s, roles.keyword)}
            onShowSizeChange={(_, s) => roles.load(1, s, roles.keyword)}
            showTotal={(t, range) => `共 ${t} 条，当前 ${range[0]}-${range[1]}`}
          />
        </div>
      </Card>

      <PermissionModal
        open={perms.open}
        role={perms.role}
        treeData={perms.treeData}
        checkedKeys={perms.selected}
        setCheckedKeys={perms.setSelected}
        onRefreshMenus={perms.open ? perms.openFor.bind(null, perms.role!) : () => {}}
        onOk={perms.save}
        onCancel={() => perms.setOpen(false)}
      />

      <RoleMembersModal
        open={members.open}
        role={members.role}
        loading={members.loading}
        members={members.members}
        onClose={() => members.setOpen(false)}
        onRemove={members.remove}
        onOpenUserSelect={members.openUserSelect}
        onOpenOrgSelect={() => members.role && orgs.showFor(members.role.id)}
        onRefresh={() => members.role && members.openFor(members.role)}
      />

      <UserSelectModal
        open={members.userOpen}
        loading={members.userLoading}
        users={members.candidateUsers}
        selected={members.selectedIds}
        onChangeSelected={members.setSelectedIds}
        onCancel={() => members.setUserOpen(false)}
        onOk={members.addUsers}
      />

      <OrgSelectModal
        open={orgs.open}
        loading={orgs.loading}
        treeData={orgs.tree}
        checked={orgs.checked}
        onCheck={orgs.setChecked}
        onCancel={() => orgs.setOpen(false)}
        onOk={orgs.submit}
      />
    </div>
  )
}
