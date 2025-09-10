// src/features/users/pages/UserManagementPage.tsx
import { useOrgTree } from '@/shared/hooks'
import { App, Card, Layout, Pagination, Typography } from 'antd'
import React from 'react'
import { OrgTreePanel } from '../components/OrgTreePanel'
import { UserFilterBar } from '../components/UserFilterBar'
import { UsersTable } from '../components/UsersTable'
import { useOrgPathMap } from '../hooks/useOrgPathMap'
import { useOrgUsersQuery } from '../hooks/useOrgUsersQuery'

// 弹窗组件
import { BindUserModal } from '../components/BindUserModal'
import { EditUserModal } from '../components/EditUserModal'
import { ResetPasswordModal } from '../components/ResetPasswordModal'
import { ViewUserModal } from '../components/ViewUserModal'

const { Sider, Content } = Layout
const { Title, Paragraph } = Typography

function pickFirstId(tree: any[]): number | null {
  if (!tree || !tree.length) return null
  return tree[0]?.id ?? null
}

const UserManagementPage: React.FC = () => {
  const { message } = App.useApp()
  const [selectedOrgId, setSelectedOrgId] = React.useState<number | null>(null)

  // —— 机构树 —— //
  const { tree, loading: treeLoading, expanded, setExpanded, refetch: refetchTree } = useOrgTree()

  // ✅ 首次加载：默认选中根 + 展开根
  React.useEffect(() => {
    if (!treeLoading) {
      const first = pickFirstId(tree)
      if (first != null) {
        // 展开根
        if (!expanded.includes(first)) setExpanded([first])
        // 选中根
        if (selectedOrgId == null) setSelectedOrgId(first)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeLoading])

  const orgPathMap = useOrgPathMap(tree)
  const getOrgPath = (id?: number | null, fb?: string | null) => (id ? orgPathMap.get(id) || fb || null : fb || null)

  // —— 列表数据 —— //
  const q = useOrgUsersQuery(selectedOrgId)

  const refreshTree = async () => {
    await refetchTree()
    const first = pickFirstId(tree)
    if (first != null) {
      setExpanded([first]) // 保持根展开
      setSelectedOrgId(first)
    }
  }

  // =========================
  // 弹窗状态
  // =========================
  const [viewOpen, setViewOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [bindOpen, setBindOpen] = React.useState(false)
  const [resetOpen, setResetOpen] = React.useState(false)
  const [resetPwd, setResetPwd] = React.useState<string | null>(null)

  const [currentUser, setCurrentUser] = React.useState<any | null>(null)

  // —— 行操作 —— //
  const onView = async (u: any) => {
    const detail = await q.getUserDetail(u.id).catch(() => u)
    console.log('detail', detail)
    setCurrentUser(detail || u)
    setViewOpen(true)
  }

  const onEdit = async (u: any) => {
    const detail = await q.getUserDetail(u.id).catch(() => u)
    setCurrentUser(detail || u)
    // 关键：等 state 落地后再开弹窗
    queueMicrotask(() => setEditOpen(true)) // 或者 setTimeout(() => setEditOpen(true))
  }

  const onReset = async (u: any) => {
    const pwd = await q.resetPassword(u.id) // ✅ 取回新密码
    setResetPwd(pwd || null)
    setResetOpen(true)
    q.refetch()
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
    if (!selectedOrgId) return
    setBindOpen(true)
  }

  // —— 编辑确认 —— //
  const handleEditSubmit = async (payload: any) => {
    if (!currentUser) return
    await q.update(currentUser.id, payload)
    setEditOpen(false)
    App.useApp().message.success('用户已更新')
    q.refetch()
  }

  // —— 绑定确认 —— //
  const handleBindSubmit = async (userId: number) => {
    if (!selectedOrgId) return
    await q.bind(selectedOrgId, Number(userId))
    App.useApp().message.success('绑定成功')
    setBindOpen(false)
    q.refetch()
  }

  return (
    <Layout style={{ padding: 16 }}>
      <Sider width={300} style={{ background: '#fff', marginRight: 16, borderRight: '1px solid #f0f0f0' }}>
        <OrgTreePanel
          tree={tree}
          loading={treeLoading}
          expandedKeys={expanded}
          setExpandedKeys={setExpanded}
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
            {selectedOrgId ? <>当前机构 ID：{selectedOrgId}</> : '（未选择机构，将显示全量用户）'}
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
            onView={onView}
            onEdit={onEdit}
            onResetPassword={onReset}
            onToggleStatus={onToggle}
            onUnbind={onUnbind}
            onDelete={onDelete}
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

      {/* —— 查看 —— */}
      <ViewUserModal
        open={viewOpen}
        user={currentUser}
        orgPath={
          currentUser?.orgId ? getOrgPath(currentUser?.orgId, '—') || '—' : getOrgPath(selectedOrgId, '—') || '—'
        }
        onClose={() => setViewOpen(false)}
      />

      {/* —— 编辑（已修复回显） —— */}
      <EditUserModal
        open={editOpen}
        user={currentUser}
        tree={tree}
        onCancel={() => setEditOpen(false)}
        onSubmit={handleEditSubmit}
      />

      {/* —— 绑定 —— */}
      <BindUserModal open={bindOpen} onCancel={() => setBindOpen(false)} onSubmit={handleBindSubmit} />

      {/* —— 重置密码结果 —— */}
      <ResetPasswordModal open={resetOpen} password={resetPwd} onClose={() => setResetOpen(false)} />
    </Layout>
  )
}

export default UserManagementPage
