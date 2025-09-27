import AppBreadcrumb from '@/shared/components/AppBreadcrumb'
import { PlusOutlined } from '@ant-design/icons'
import { App, Button, Card, Input, Pagination, Space, Table, Layout } from 'antd'
import React, { useEffect, useMemo, useState } from 'react'
import AddOrgModal from '../components/AddOrgModal'
import OrgDetailCard from '../components/OrgDetailCard'
import { useOrgManage } from '../hooks/useOrgManage'
import { useOrgRoles } from '@/features/roles/hooks/useOrgRoles'
import { PermissionModal } from '@/features/roles/components/PermissionModal'
import RoleFormModal from '@/features/roles/components/RoleFormModal'
import RoleMembersModal from '@/features/roles/components/RoleMembersModal'
import { useRoleMembers } from '@/features/roles/hooks/useRoleMembers'
import { useRolePermissions } from '@/features/roles/hooks/useRolePermissions'
import type { Role } from '@/shared/api/endpoints/roles'
import { OrgTreePanel, type OrgRawNode } from '@/shared/components/OrgTreePanel'

const { Sider, Content } = Layout
const { Search } = Input

export default function OrgManagementPage() {
  const {
    treeLoading,
    rawTree,
    search,
    setSearch,
    selectedId,
    setSelectedId,
    detail,
    detailLoading,
    loadTree,
    createOrg,
    updateOrg,
    removeOrg,
  } = useOrgManage()

  const { message } = App.useApp()
  const [addOpen, setAddOpen] = useState(false)
  const treeForPanel = useMemo<OrgRawNode[]>(() => (rawTree as unknown as OrgRawNode[]) || [], [rawTree])
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])

  useEffect(() => {
    if (!treeForPanel.length) return
    const rootId = treeForPanel[0].id
    if (selectedId == null || !Number.isFinite(selectedId)) setSelectedId(rootId)
    setExpandedKeys(prev => (prev?.length ? prev : [rootId]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeForPanel])

  const handleSelect = (id: number) => {
    if (Number.isFinite(id)) setSelectedId(id)
  }

  /** ===== 机构内角色：列表 + CRUD + 权限/成员 ===== */
  const orgId = detail?.id
  const orgRoles = useOrgRoles(orgId)
  useEffect(() => {
    orgRoles.load(1, orgRoles.pageSize, orgRoles.keyword)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]) // 机构切换时刷新

  const perms = useRolePermissions()
  const members = useRoleMembers()

  // 新建/编辑角色
  const [formOpen, setFormOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<Partial<Role> | null>(null)

  return (
    <App>
      <AppBreadcrumb />
      <Layout style={{ height: '100%', background: 'transparent' }}>
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
            selectedOrgId={selectedId}
            onSelect={handleSelect}
            onRefresh={() => loadTree(true)}
            onAdd={() => setAddOpen(true)} // 机构管理页需要“新增”按钮
            title="机构"
          />
        </Sider>

        <Content style={{ padding: 16 }}>
          <OrgDetailCard
            detail={detail}
            loading={detailLoading}
            onSave={async v => {
              if (!detail) return
              await updateOrg(detail.id, v)
              message.success('保存成功')
            }}
            onDelete={async () => {
              if (!detail) return
              try {
                const m = await removeOrg(detail.id)
                message.success(m?.message || '删除成功')
              } catch (e: any) {
                message.error(e?.message || '删除失败')
              }
            }}
          />

          {/* ===== 机构内角色 ===== */}
          <Card className="mt-4" title={`角色（${orgRoles.total}）`}>
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
                    // 清空时自动刷新
                    if (!v) orgRoles.load(1, orgRoles.pageSize, '')
                  }}
                  onSearch={v => orgRoles.load(1, orgRoles.pageSize, v)}
                />
              </Space>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                disabled={!orgId}
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
                { title: '状态', dataIndex: 'is_disabled', width: 120, render: v => (v ? '禁用' : '启用') },
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
                      <Button size="small" onClick={() => perms.openFor({ id: r.id, name: r.name }, orgId)}>
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

        <AddOrgModal
          open={addOpen}
          parentName={detail?.name}
          onCancel={() => setAddOpen(false)}
          onOk={async v => {
            try {
              await createOrg({ ...v, parent_id: detail?.id ?? null, is_active: 1 })
              setAddOpen(false)
              message.success('创建成功')
            } catch (e: any) {
              message.error(e?.message || '创建失败')
            }
          }}
        />
      </Layout>

      {/* 权限设置（传入 orgId） */}
      <PermissionModal
        open={perms.open}
        role={perms.role}
        treeData={perms.treeData}
        checkedKeys={perms.selected}
        setCheckedKeys={perms.setSelected}
        onRefreshMenus={() => (perms.role && orgId ? perms.openFor(perms.role, orgId) : undefined)}
        onOk={perms.save}
        onCancel={() => perms.setOpen(false)}
      />

      {/* 成员管理（沿用原弹窗；机构内角色不再需要“角色⇄机构”） */}
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

      {/* 新建/编辑角色 */}
      <RoleFormModal
        open={formOpen}
        role={editingRole}
        onCancel={() => setFormOpen(false)}
        onOk={async payload => {
          if (!orgId) return
          if (editingRole?.id) await orgRoles.update(editingRole.id as number, payload as any)
          else await orgRoles.create(payload as any)
          setFormOpen(false)
        }}
      />
    </App>
  )
}
