// features/users/pages/UserRoleManagementPage.tsx
import React, { useEffect, useMemo, useState } from 'react'
import { App, Avatar, Card, Input, Pagination, Space, Table, Tag } from 'antd'
import { UserOutlined, SearchOutlined, SettingOutlined } from '@ant-design/icons'
import { rolesApi } from '@/shared/api/endpoints/roles'
import { usersApi } from '@/shared/api/endpoints/users'
import { ROLE_COLOR } from '../constants'
import { RoleAssignModal } from '../components/OrgTreePanel'

const UserRoleManagementPage: React.FC = () => {
  const { message } = App.useApp()
  const [users, setUsers] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [assignOpen, setAssignOpen] = useState(false)
  const [current, setCurrent] = useState<any | null>(null)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const [roleList, list] = await Promise.all([
          rolesApi.list(),
          usersApi.searchAll(search), // 可换成服务端分页接口
        ])
        setRoles(roleList.filter((r: any) => !r.is_disabled))
        // 并行拉角色（如后端支持 include=roles 则不需要）：
        const withRoles = await Promise.all(
          list.map(async (u: any) => ({
            ...u,
            roles: await rolesApi.getUserRoles(u.id),
          }))
        )
        setUsers(withRoles)
      } catch (e: any) {
        message.error(e?.message || '加载失败')
      } finally {
        setLoading(false)
      }
    })()
  }, [search])

  const filtered = useMemo(
    () =>
      users.filter(
        u =>
          u.username?.toLowerCase().includes(search.toLowerCase()) ||
          u.email?.toLowerCase().includes(search.toLowerCase())
      ),
    [users, search]
  )
  const data = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize])

  return (
    <div className="p-6">
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">用户角色管理</h1>
          <Input
            placeholder="搜索用户名或邮箱"
            prefix={<SearchOutlined />}
            value={search}
            onChange={e => {
              setSearch(e.target.value)
              setPage(1)
            }}
            allowClear
            style={{ width: 300 }}
          />
        </div>

        <Table
          loading={loading}
          rowKey="id"
          pagination={false}
          dataSource={data}
          columns={[
            {
              title: '用户',
              key: 'user',
              render: (_: any, r: any) => (
                <Space>
                  <Avatar icon={<UserOutlined />} />
                  <div>
                    <div className="font-medium">{r.username}</div>
                    <div className="text-gray-500 text-sm">{r.email}</div>
                  </div>
                </Space>
              ),
            },
            {
              title: '当前角色',
              key: 'roles',
              render: (_: any, r: any) => (
                <Space wrap>
                  {r.roles?.length ? (
                    r.roles.map((role: any) => (
                      <Tag key={role.id} color={ROLE_COLOR[role.code] || 'default'}>
                        {role.name}
                      </Tag>
                    ))
                  ) : (
                    <Tag>未分配角色</Tag>
                  )}
                </Space>
              ),
            },
            { title: '注册时间', dataIndex: 'created_at', render: (t: string) => new Date(t).toLocaleString() },
            {
              title: '操作',
              key: 'action',
              render: (_: any, r: any) => (
                <a
                  onClick={() => {
                    setCurrent(r)
                    setAssignOpen(true)
                  }}
                >
                  <SettingOutlined /> 分配角色
                </a>
              ),
            },
          ]}
        />

        <Pagination
          current={page}
          total={filtered.length}
          pageSize={pageSize}
          onChange={(p, ps) => {
            setPage(p)
            setPageSize(ps)
          }}
          showSizeChanger
        />
      </Card>

      <RoleAssignModal
        open={assignOpen}
        onCancel={() => setAssignOpen(false)}
        user={current}
        roles={roles}
        onSubmit={async (ids: number[]) => {
          if (!current) return
          await rolesService.setUserRoles(current.id, ids)
          // 刷新本地
          setUsers(prev =>
            prev.map(u => (u.id === current.id ? { ...u, roles: roles.filter((r: any) => ids.includes(r.id)) } : u))
          )
          setAssignOpen(false)
        }}
      />
    </div>
  )
}
export default UserRoleManagementPage
