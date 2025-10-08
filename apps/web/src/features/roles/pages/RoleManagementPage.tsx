import { MoreOutlined, PlusOutlined } from '@ant-design/icons'
import { App, Button, Card, Dropdown, Grid, Input, Layout, Modal, Pagination, Space, Table, type MenuProps } from 'antd'
import React, { useEffect, useMemo, useState } from 'react'

import { OrgTreePanel, type OrgRawNode } from '@/shared/components/OrgTreePanel'
import { useOrgTree } from '@/shared/hooks/useOrgTree'

import { useOrgRoles } from '@/features/roles/hooks/useOrgRoles'
import { useRoleMembers } from '@/features/roles/hooks/useRoleMembers'
import { useRolePermissions } from '@/features/roles/hooks/useRolePermissions'
import type { Role } from '@/shared/api/endpoints/roles'

import { PermissionModal } from '@/features/roles/components/PermissionModal'
import RoleFormModal from '@/features/roles/components/RoleFormModal'
import RoleMembersModal from '@/features/roles/components/RoleMembersModal'
import UserSelectModal from '@/features/roles/components/UserSelectModal'
import OrgSelectModal from '@/features/roles/components/OrgSelectModal'

const { Sider, Content } = Layout
const { Search } = Input

export default function RoleManagementPage() {
  const { message } = App.useApp()
  const screens = Grid.useBreakpoint()

  /** ===== 左侧机构树，仅用于筛选 ===== */
  const { loading: treeLoading, search, setSearch, filteredTree, refetch } = useOrgTree()
  const treeForPanel = useMemo<OrgRawNode[]>(() => (filteredTree as unknown as OrgRawNode[]) || [], [filteredTree])
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null)

  useEffect(() => {
    void refetch()
  }, [refetch])

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

  const perms = useRolePermissions()
  const members = useRoleMembers()

  // 新建/编辑角色
  const [formOpen, setFormOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<Partial<Role> | null>(null)

  // —— 机构选择弹窗（“按机构添加”用）——
  const [orgPickerOpen, setOrgPickerOpen] = useState(false)
  const [orgChecked, setOrgChecked] = useState<React.Key[]>([])
  const handleOpenOrgSelect = () => setOrgPickerOpen(true)

  return (
    <App>
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
            onAdd={() => {}}
            title="机构"
          />
        </Sider>

        {/* 右侧角色列表 */}
        <Content style={{ padding: 16 }}>
          <Card title={`角色（${orgRoles.total}）`} bodyStyle={{ overflowX: 'auto' }}>
            <div className="flex justify-between items-center mb-3">
              <Space wrap>
                <Search
                  placeholder="搜索角色名称或编码"
                  allowClear
                  style={{ width: 300, maxWidth: '100%' }}
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
              scroll={{ x: 'max-content' }}
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
                  width: 200,
                  render: (_, r) => {
                    // 小屏或窄容器：收纳为“更多”
                    const compact = !screens.lg
                    if (compact) {
                      const items: MenuProps['items'] = [
                        {
                          key: 'edit',
                          label: '编辑',
                        },
                        {
                          key: 'perm',
                          label: '权限',
                        },
                        {
                          key: 'members',
                          label: '成员',
                        },
                        { type: 'divider' as const },
                        {
                          key: 'delete',
                          label: <span style={{ color: '#ff4d4f' }}>删除</span>,
                        },
                      ]
                      const onClick: MenuProps['onClick'] = ({ key }) => {
                        switch (key) {
                          case 'edit':
                            setEditingRole({
                              id: r.id,
                              name: r.name,
                              code: r.code,
                              description: (r as any).description || '',
                            })
                            setFormOpen(true)
                            break
                          case 'perm':
                            perms.openFor({ id: r.id, name: r.name } as any, selectedOrgId ?? undefined)
                            break
                          case 'members':
                            members.openFor({ id: r.id, name: r.name } as any)
                            break
                          case 'delete':
                            Modal.confirm({
                              title: '确定删除该角色？',
                              okText: '删除',
                              okButtonProps: { danger: true },
                              onOk: () => orgRoles.remove(r.id),
                            })
                            break
                        }
                      }
                      return (
                        <Dropdown menu={{ items, onClick }} trigger={['click']}>
                          <Button size="small" icon={<MoreOutlined />}>
                            更多
                          </Button>
                        </Dropdown>
                      )
                    }

                    // 大屏：原四个按钮
                    return (
                      <Space size={[8, 8]} wrap>
                        <Button
                          size="small"
                          onClick={() => {
                            setEditingRole({
                              id: r.id,
                              name: r.name,
                              code: r.code,
                              description: (r as any).description || '',
                            })
                            setFormOpen(true)
                          }}
                        >
                          编辑
                        </Button>
                        <Button
                          size="small"
                          onClick={() => perms.openFor({ id: r.id, name: r.name } as any, selectedOrgId ?? undefined)}
                        >
                          权限
                        </Button>
                        <Button size="small" onClick={() => members.openFor({ id: r.id, name: r.name } as any)}>
                          成员
                        </Button>
                        <Button
                          size="small"
                          danger
                          onClick={() =>
                            Modal.confirm({
                              title: '确定删除该角色？',
                              okText: '删除',
                              okButtonProps: { danger: true },
                              onOk: () => orgRoles.remove(r.id),
                            })
                          }
                        >
                          删除
                        </Button>
                      </Space>
                    )
                  },
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

      {/* 权限设置 */}
      <PermissionModal
        open={perms.open}
        role={perms.role}
        treeData={perms.treeData}
        checkedKeys={perms.selected}
        setCheckedKeys={perms.setSelected}
        onRefreshMenus={() => (perms.role && selectedOrgId ? perms.openFor(perms.role, selectedOrgId) : undefined)}
        onOk={async () => {
          await perms.save()
        }}
        onCancel={() => perms.setOpen(false)}
      />

      {/* 成员管理 */}
      <RoleMembersModal
        open={members.open}
        role={members.role}
        loading={members.loading}
        members={members.members}
        roleOrgs={members.roleOrgs}
        orgsLoading={members.orgsLoading}
        onOpenOrgSelect={handleOpenOrgSelect}
        onRemoveOrg={members.removeOrg}
        onClose={() => members.setOpen(false)}
        onRemove={async (userId: number) => {
          await members.remove(userId)
        }}
        onOpenUserSelect={async () => {
          await members.openUserSelect()
        }}
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
        role={
          editingRole
            ? {
                id: editingRole.id!,
                name: editingRole.name,
                code: editingRole.code,
                description: editingRole.description ?? undefined,
              }
            : null
        }
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

      {/* 机构选择弹窗 */}
      <OrgSelectModal
        open={orgPickerOpen}
        loading={treeLoading}
        treeData={treeForPanel}
        checked={orgChecked}
        onCheck={setOrgChecked}
        onCancel={() => {
          setOrgPickerOpen(false)
          setOrgChecked([])
        }}
        onOk={async () => {
          if (!members.role) {
            message.warning('请先选择一个角色')
            return
          }
          const orgIds = Array.from(new Set(orgChecked.map(Number).filter(Number.isFinite))) as number[]
          if (!orgIds.length) {
            message.warning('请先选择一个机构')
            return
          }
          try {
            await members.addOrgs(orgIds)
            message.success('已关联机构')
            setOrgPickerOpen(false)
            setOrgChecked([])
          } catch (e: any) {
            message.error(e?.message || '关联机构失败')
          }
        }}
      />
    </App>
  )
}
