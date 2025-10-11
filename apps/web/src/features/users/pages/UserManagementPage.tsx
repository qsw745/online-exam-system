import { OrgTreePanel } from '@/shared/components/OrgTreePanel'
import { useOrgTree } from '@/shared/hooks'
import { App, Card, Layout, Pagination, Typography } from 'antd'
import React from 'react'

import { UserFilterBar } from '../components/UserFilterBar'
import { UsersTable } from '../components/UsersTable'
import { useOrgPathMap } from '../hooks/useOrgPathMap'
import { useOrgUsersQuery } from '../hooks/useOrgUsersQuery'

// 弹窗组件
import { orgsApi } from '@/shared/api/endpoints/orgs'
import { BindUserModal } from '../components/BindUserModal'
import { EditUserModal } from '../components/EditUserModal'
import { ResetPasswordModal } from '../components/ResetPasswordModal'
import AssignRolesModal from '../components/AssignRolesModal' // ✅ 新增

const { Sider, Content } = Layout
const { Title, Paragraph } = Typography

function pickFirstId(tree: any[]): number | null {
  if (!Array.isArray(tree) || tree.length === 0) return null
  const first = tree.find(n => n && typeof n.id === 'number')
  return first ? first.id : null
}

const UserManagementPage: React.FC = () => {
  const { message } = App.useApp()
  const [selectedOrgId, setSelectedOrgId] = React.useState<number | null>(null)

  const { tree, loading: treeLoading, refetch: refetchTree } = useOrgTree()
  const [expandedKeys, setExpandedKeys] = React.useState<React.Key[]>([])

  React.useEffect(() => {
    void refetchTree()
  }, [refetchTree])

  React.useEffect(() => {
    if (treeLoading) return
    const first = pickFirstId(tree || [])
    if (first == null) return
    setExpandedKeys(prev => (Array.isArray(prev) && prev.includes(first) ? prev : [first]))
    setSelectedOrgId(prev => (prev == null ? first : prev))
  }, [treeLoading, tree])

  const orgPathMap = useOrgPathMap(tree)
  const getOrgPath = (id?: number | null, fb?: string | null) => (id ? orgPathMap.get(id) || fb || null : fb || null)

  // 只有选中机构后才会发请求
  const q = useOrgUsersQuery(selectedOrgId)

  const refreshTree = async () => {
    const next = await refetchTree()
    const first = pickFirstId(next || [])
    if (first != null) {
      setExpandedKeys([first])
      setSelectedOrgId(first)
    } else {
      setExpandedKeys([])
      setSelectedOrgId(null)
    }
  }

  // 弹窗状态
  const [editOpen, setEditOpen] = React.useState(false)
  const [bindOpen, setBindOpen] = React.useState(false)
  const [resetOpen, setResetOpen] = React.useState(false)
  const [resetPwd, setResetPwd] = React.useState<string | null>(null)
  const [currentUser, setCurrentUser] = React.useState<any | null>(null)

  // 分配角色弹窗
  const [assignOpen, setAssignOpen] = React.useState(false)

  const onEdit = async (u: any) => {
    const detail = await q.getUserDetail(u.id).catch(() => u)
    setCurrentUser(detail || u)
    queueMicrotask(() => setEditOpen(true))
  }

  const onAssignRoles = async (u: any) => {
    setCurrentUser(u)
    setAssignOpen(true)
  }

  const onReset = async (u: any) => {
    setCurrentUser(u)
    setResetOpen(true) // <- 打开弹窗，不再直接调用接口
  }

  const onToggle = async (u: any) => {
    await q.toggleStatus(u.id, u.status === 'active' ? 'disabled' : 'active')
    message.success('状态已更新')
    q.refetch()
  }

  const onUnbind = async (u: any) => {
    if (!selectedOrgId) return
    await q.unbind(selectedOrgId, u.id)
    message.success('已从机构移除')
    q.refetch()
  }

  const onDelete = async (u: any) => {
    await q.deleteUser(u.id)
    message.success('用户删除成功')
    const rest = q.total - 1 - (q.page - 1) * q.limit
    if (rest <= 0 && q.page > 1) q.setPage(q.page - 1)
    else q.refetch()
  }

  const openBindModal = () => {
    if (!selectedOrgId) {
      message.warning('请先在左侧选择一个机构')
      return
    }
    setBindOpen(true)
  }

  const handleBindSubmit = async (payload: { emails?: string[]; userIds?: number[] }) => {
    if (!selectedOrgId) return
    if (payload.emails?.length) {
      await orgsApi.addUsersByEmail(selectedOrgId, payload.emails)
    } else if (payload.userIds?.length) {
      await orgsApi.addUsers(selectedOrgId, payload.userIds)
    } else {
      return
    }
    message.success('绑定成功')
    setBindOpen(false)
    q.refetch()
  }

  return (
    <>
      <Layout style={{ padding: 16 }}>
        <Sider width={220} style={{ background: '#fff', marginRight: 16, borderRight: '1px solid #f0f0f0' }}>
          <OrgTreePanel
            tree={tree}
            loading={treeLoading}
            expandedKeys={Array.isArray(expandedKeys) ? expandedKeys : []}
            setExpandedKeys={setExpandedKeys}
            selectedOrgId={selectedOrgId}
            onSelect={id => {
              if (!id) return
              setSelectedOrgId(id)
              q.setPage(1)
            }}
            onRefresh={refreshTree}
          />
        </Sider>

        <Content>
          <div style={{ marginBottom: 16 }}>
            <Title level={3} style={{ margin: 0 }}>
              用户管理
            </Title>
            <Paragraph type="secondary" style={{ margin: '6px 0 0' }}>
              {selectedOrgId ? <>当前机构 ID：{selectedOrgId}</> : '请选择左侧机构以查看用户'}
            </Paragraph>
          </div>

          <Card style={{ marginBottom: 16 }}>
            <UserFilterBar
              keyword={q.keyword}
              setKeyword={v => {
                q.setKeyword(v)
                q.setPage(1)
              }}
              role={q.role || ''}
              setRole={v => {
                q.setRole(v || undefined)
                q.setPage(1)
              }}
              includeChildren={!!q.includeChildren}
              setIncludeChildren={v => {
                q.setIncludeChildren(v)
                q.setPage(1)
              }}
              canBind={!!selectedOrgId}
              onBindClick={openBindModal}
            />
          </Card>

          <Card>
            <UsersTable
              data={q.rows}
              loading={q.loading}
              selectedOrgId={selectedOrgId}
              getOrgPath={getOrgPath} // ← 新增这一行
              // ❌ 去掉 onView
              onAssignRoles={onAssignRoles} // ✅ 新增
              onEdit={onEdit}
              onToggleStatus={onToggle}
              onUnbind={onUnbind}
              onDelete={onDelete}
              onResetPassword={onReset}
            />
            <div style={{ textAlign: 'right', marginTop: 16 }}>
              <Pagination
                current={q.page}
                pageSize={q.limit}
                total={q.total}
                showSizeChanger
                showQuickJumper
                onChange={(p, ps) => {
                  if (ps !== q.limit) q.setPage(1)
                  else q.setPage(p)
                  q.setLimit(ps)
                }}
                showTotal={(t, r) => `${r[0]}-${r[1]} / 共 ${t} 条`}
              />
            </div>
          </Card>
        </Content>

        {/* —— 编辑 —— */}
        <EditUserModal
          open={editOpen}
          user={currentUser}
          tree={tree}
          onCancel={() => setEditOpen(false)}
          onSubmit={async v => {
            if (!currentUser) return
            await q.update(currentUser.id, v)
            setEditOpen(false)
            message.success('用户已更新')
            q.refetch()
          }}
        />

        {/* —— 新增到机构 —— */}
        {bindOpen && selectedOrgId != null && (
          <BindUserModal
            open={bindOpen}
            targetOrgId={selectedOrgId}
            onCancel={() => setBindOpen(false)}
            onSubmit={handleBindSubmit}
          />
        )}

        {/* —— 重置密码弹窗 —— */}
        <ResetPasswordModal
          open={resetOpen}
          username={currentUser?.username}
          onCancel={() => setResetOpen(false)}
          onSubmit={async newPwd => {
            if (!currentUser) return
            await q.resetPassword(currentUser.id, newPwd) // <- 传入自定义密码
            setResetOpen(false)
            message.success('密码已重置')
            q.refetch()
          }}
        />

        {/* —— 分配角色 —— */}
        <AssignRolesModal
          open={assignOpen}
          user={currentUser}
          orgId={selectedOrgId ?? undefined}
          onCancel={() => setAssignOpen(false)}
          onOk={() => {
            setAssignOpen(false)
            // 分配角色通常不影响列表字段，这里仅保持一致性
            q.refetch()
          }}
        />
      </Layout>
    </>
  )
}

export default UserManagementPage
