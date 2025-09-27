// apps/web/src/features/roles/pages/RoleManagementPage.tsx
import { PlusOutlined } from '@ant-design/icons'
import { App, Button, Card, Input, Layout, Pagination, Space, Table } from 'antd'
import React, { useEffect, useMemo, useState } from 'react'

import AppBreadcrumb from '@/shared/components/AppBreadcrumb'
import { OrgTreePanel, type OrgRawNode } from '@/shared/components/OrgTreePanel'
import { useOrgTree } from '@/shared/hooks/useOrgTree'

import type { Role } from '@/shared/api/endpoints/roles'
import { useOrgRoles } from '@/features/roles/hooks/useOrgRoles'
import { useRolePermissions } from '@/features/roles/hooks/useRolePermissions'
import { useRoleMembers } from '@/features/roles/hooks/useRoleMembers'

import RoleFormModal from '@/features/roles/components/RoleFormModal'
import { PermissionModal } from '@/features/roles/components/PermissionModal'
import RoleMembersModal from '@/features/roles/components/RoleMembersModal'
import UserSelectModal from '@/features/roles/components/UserSelectModal'

const { Sider, Content } = Layout
const { Search } = Input

export default function RoleManagementPage() {
  const { message } = App.useApp()

  /** ===== 左侧机构树，仅用于筛选；不展示机构详情 ===== */
  const { tree, loading: treeLoading, search, setSearch, filteredTree, refetch } = useOrgTree()

  const treeForPanel = useMemo<OrgRawNode[]>(() => (filteredTree as unknown as OrgRawNode[]) || [], [filteredTree])
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null)

  // 第一次加载树并默认选中根
  useEffect(() => {
    void refetch()
  }, [refetch])

  // 树变化时，若未选中则默认选中第一项
  useEffect(() => {
    if (!treeForPanel?.length) return
    const firstId = (function first(nodes: OrgRawNode[]): number | null {
      if (!nodes?.length) return null
      const n = nodes[0]
      return n?.id ?? null
    })(treeForPanel)
    if (selectedOrgId == null && firstId != null) {
      setSelectedOrgId(firstId)
      setExpandedKeys(prev => (prev?.length ? prev : [firstId]))
    }
  }, [treeForPanel, selectedOrgId])

  const handleOrgSelect = (id: number) => {
    if (Number.isFinite(id)) setSelectedOrgId(id)
  }

  /** ===== 右侧：机构内角色列表 ===== */
  const orgRoles = useOrgRoles(selectedOrgId ?? undefined)
  useEffect(() => {
    orgRoles.load(1, orgRoles.pageSize, orgRoles.keyword)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrgId])

  const perms = useRolePermissions() // openFor(role, orgId?) 需支持 orgId
  const members = useRoleMembers()

  // 新建/编辑角色
  const [formOpen, setFormOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<Partial<Role> | null>(null)

  return (
    <App>
      <AppBreadcrumb />
      <Layout style={{ height: '100%', background: 'transparent' }}>
        {/* 左侧机构树 */}
        <Sider width={320} theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
          <div style={{ padding: 12 }}>
            <Search
              placeholder="搜索机构..."
              allowClear
              value={search}
              onChange={e => setSearch(e.target.value)}
              onSearch={kw => setSearch(kw)}
            />
          </div>
          <OrgTreePanel
            tree={treeForPanel}
            loading={treeLoading}
            expandedKeys={expandedKeys}
            setExpandedKeys={setExpandedKeys}
            selectedOrgId={selectedOrgId}
            onSelect={handleOrgSelect}
            onRefresh={() => refetch()}
            onAdd={() => {}} // 角色管理不提供新增机构入口
            title="机构"
          />
        </Sider>

        {/* 右侧仅角色列表（无机构详情） */}
        <Content style={{ padding: 16 }}>
          <Card title={`角色（${orgRoles.total}）`}>
            <div className="flex justify-between items-center mb-3">
              <Space>
                <Search
                  placeholder="搜索角色名称或编码"
                  allowClear
                  style={{ width: 300 }}
                  value={orgRoles.keyword}
                  onChange={e => {
                    const v = e.target.value
                    orgRoles.setKeyword(v)
                    if (!v) orgRoles.load(1, orgRoles.pageSize, '')
                  }}
                  onSearch={v => orgRoles.load(1, orgRoles.pageSize, v)}
                />
              </Space>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                disabled={!selectedOrgId}
                onClick={() => {
                  setEditingRole(null)
                  setFormOpen(true)
                }}
              >
                新建角色
              </Button>
            </div>

            <Table<Role>
              rowKey="id"
              dataSource={orgRoles.list}
              loading={orgRoles.loading}
              pagination={false}
              columns={[
                { title: 'ID', dataIndex: 'id', width: 80 },
                { title: '名称', dataIndex: 'name' },
                { title: '编码', dataIndex: 'code' },
                {
                  title: '状态',
                  dataIndex: 'is_disabled',
                  width: 120,
                  render: v => (v ? '禁用' : '启用'),
                },
                {
                  title: '操作',
                  width: 260,
                  render: (_, r) => (
                    <Space>
                      <Button
                        size="small"
                        onClick={() => {
                          setEditingRole({
                            id: r.id,
                            name: r.name,
                            code: r.code,
                            description: r.description || '',
                          })
                          setFormOpen(true)
                        }}
                      >
                        编辑
                      </Button>
                      <Button
                        size="small"
                        onClick={() => perms.openFor({ id: r.id, name: r.name }, selectedOrgId ?? undefined)}
                      >
                        权限
                      </Button>
                      <Button size="small" onClick={() => members.openFor({ id: r.id, name: r.name })}>
                        成员
                      </Button>
                      <Button size="small" danger onClick={() => orgRoles.remove(r.id)}>
                        删除
                      </Button>
                    </Space>
                  ),
                },
              ]}
            />

            <div className="mt-3">
              <Pagination
                current={orgRoles.page}
                total={orgRoles.total}
                pageSize={orgRoles.pageSize}
                showSizeChanger
                showQuickJumper
                onChange={(p, s) => orgRoles.load(Number(p) || 1, Number(s) || orgRoles.pageSize, orgRoles.keyword)}
                onShowSizeChange={(_p, s) => orgRoles.load(1, Number(s) || orgRoles.pageSize, orgRoles.keyword)}
                showTotal={(t, [start, end]) =>
                  `共 ${Number(t) || 0} 条，当前 ${Number(start) || 0}-${Number(end) || 0}`
                }
              />
            </div>
          </Card>
        </Content>
      </Layout>

      {/* 权限设置（传入 orgId，后端优先 role.org_id） */}
      <PermissionModal
        open={perms.open}
        role={perms.role}
        treeData={perms.treeData}
        checkedKeys={perms.selected}
        setCheckedKeys={perms.setSelected}
        onRefreshMenus={() => (perms.role && selectedOrgId ? perms.openFor(perms.role, selectedOrgId) : undefined)}
        onOk={perms.save}
        onCancel={() => perms.setOpen(false)}
      />

      {/* 成员管理（机构内角色不需要“角色⇄机构”能力，传空即可） */}
      <RoleMembersModal
        open={members.open}
        role={members.role}
        loading={members.loading}
        members={members.members}
        roleOrgs={[]}
        orgsLoading={false}
        onClose={() => members.setOpen(false)}
        onRemove={async (userId: number) => {
          await members.remove(userId)
        }}
        onOpenUserSelect={async () => {
          await members.openUserSelect()
        }}
        onOpenOrgSelect={() => {}}
        onRemoveOrg={async () => {}}
        onRefresh={() => (members.role ? members.openFor(members.role) : undefined)}
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

      {/* 新建/编辑角色 */}
      <RoleFormModal
        open={formOpen}
        role={editingRole}
        onCancel={() => setFormOpen(false)}
        onOk={async payload => {
          if (!selectedOrgId) {
            message.warning('请先选择一个机构')
            return
          }
          if (editingRole?.id) await orgRoles.update(editingRole.id as number, payload as any)
          else await orgRoles.create(payload as any)
          setFormOpen(false)
        }}
      />
    </App>
  )
}
