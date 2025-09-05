// features/users/pages/UserManagementPage.tsx
import { Layout, Card, Pagination, Typography, Space, App } from 'antd'
import React, { useMemo, useState } from 'react'
import { OrgTreePanel } from '../components/OrgTreePanel'
import { UserFilterBar } from '../components/UserFilterBar'
import { UserTable } from '../components/UserTable'
import { useOrgTree } from '../hooks/useOrgTree'
import { useOrgPathMap } from '../hooks/useOrgPathMap'
import { useOrgUsersQuery } from '../hooks/useOrgUsersQuery'
import { orgsService } from '../services/orgs.service'
import { usersService } from '../services/users.service'

const { Sider, Content } = Layout
const { Title, Paragraph } = Typography

const UserManagementPage: React.FC = () => {
  const { message, modal } = App.useApp() // 如果需要 confirm 可用 modal.confirm
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null)

  // 机构树
  const { tree, loading: treeLoading, expanded, setExpanded } = useOrgTree()
  const orgPathMap = useOrgPathMap(tree)
  const getOrgPath = (id?: number | null, fb?: string | null) => (id ? orgPathMap.get(id) || fb || null : fb || null)

  // 列表数据（分页/筛选）
  const q = useOrgUsersQuery(selectedOrgId)

  const refreshTree = async () => {
    // 简化：useOrgTree 默认会在挂载时加载，这里如需刷新可重新触发（略）
    window.location.reload() // 或者在 useOrgTree 暴露一个 refetch
  }

  // 操作
  const onView = async (u: any) => {
    /* 打开 UserDetailModal（略）*/
  }
  const onEdit = (u: any) => {
    /* 打开 UserEditModal（略） */
  }
  const onReset = async (u: any) => {
    await usersService.resetPassword(u.id)
    message.success('密码重置成功')
  }
  const onToggle = async (u: any) => {
    await usersService.updateStatus(u.id, u.status === 'active' ? 'disabled' : 'active')
    message.success('状态已更新')
    q.setPage(1)
  }
  const onUnbind = async (u: any) => {
    if (!selectedOrgId) return
    await orgsService.unbind(selectedOrgId, u.id)
    message.success('已从机构移除')
    q.setPage(1)
  }
  const onDelete = async (u: any) => {
    await usersService.delete(u.id)
    message.success('用户删除成功')
    q.setPage(1)
  }

  // 绑定到机构
  const openBindModal = () => {
    /* 打开 BindUsersModal（略）*/
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
            {selectedOrgId ? <>当前机构 ID：{selectedOrgId}</> : '加载机构中…'}
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
          <UserTable
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

        {/* 这里挂载各类弹窗组件：UserDetailModal / UserEditModal / BindUsersModal / OrgPickerModal / LinkOrgsModal（略） */}
      </Content>
    </Layout>
  )
}
export default UserManagementPage
