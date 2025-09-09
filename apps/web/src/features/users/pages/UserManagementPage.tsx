// src/features/users/pages/UserManagementPage.tsx
import { Layout, Card, Pagination, Typography, App } from 'antd'
import React from 'react'
import { OrgTreePanel } from '../components/OrgTreePanel'
import { UserFilterBar } from '../components/UserFilterBar'
import { UsersTable } from '../components/UsersTable'
import { useOrgTree } from '@/shared/hooks'
import { useOrgPathMap } from '../hooks/useOrgPathMap'
import { useOrgUsersQuery } from '../hooks/useOrgUsersQuery'

const { Sider, Content } = Layout
const { Title, Paragraph } = Typography

function pickFirstId(tree: any[]): number | null {
  if (!tree || !tree.length) return null
  const node = tree[0]
  return node?.id ?? null
}

const UserManagementPage: React.FC = () => {
  const { message } = App.useApp()
  const [selectedOrgId, setSelectedOrgId] = React.useState<number | null>(null)

  // 机构树
  const { tree, loading: treeLoading, expanded, setExpanded, refetch: refetchTree } = useOrgTree()

  // 首次加载时自动选中第一个机构（若有）
  React.useEffect(() => {
    if (!treeLoading && selectedOrgId == null) {
      const first = pickFirstId(tree)
      if (first != null) setSelectedOrgId(first)
    }
  }, [treeLoading, tree, selectedOrgId])

  const orgPathMap = useOrgPathMap(tree)
  const getOrgPath = (id?: number | null, fb?: string | null) => (id ? orgPathMap.get(id) || fb || null : fb || null)

  // 列表数据（分页/筛选）
  const q = useOrgUsersQuery(selectedOrgId)

  const refreshTree = async () => {
    await refetchTree()
  }

  // 行操作
  const onView = async (_u: any) => {}
  const onEdit = async (_u: any) => {}

  const onReset = async (u: any) => {
    await q.resetPassword(u.id)
    message.success('密码重置成功')
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

  const openBindModal = () => {}

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
            setKeyword={q.setKeyword}
            role={q.role}
            setRole={v => {
              q.setRole(v)
              q.setPage(1)
            }}
            includeChildren={q.includeChildren}
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
            getOrgPath={getOrgPath}
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
                q.setPage(p)
                q.setLimit(ps)
              }}
              showTotal={(t, r) => `${r[0]}-${r[1]} / 共 ${t} 条`}
            />
          </div>
        </Card>
      </Content>
    </Layout>
  )
}

export default UserManagementPage
