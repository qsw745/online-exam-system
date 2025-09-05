// features/users/components/UserTable.tsx
import { Button, Dropdown, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  EyeOutlined,
  EditOutlined,
  KeyOutlined,
  MoreOutlined,
  StopOutlined,
  UserDeleteOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import { ROLE_COLOR, ROLE_LABEL, STATUS_COLOR, STATUS_LABEL } from '../constants'
const { Text } = Typography

export const UserTable: React.FC<{
  data: any[]
  loading: boolean
  getOrgPath: (id?: number | null, fb?: string | null) => string | null
  selectedOrgId?: number | null
  onView: (u: any) => void
  onEdit: (u: any) => void
  onResetPassword: (u: any) => void
  onToggleStatus: (u: any) => void
  onUnbind: (u: any) => void
  onDelete: (u: any) => void
}> = ({
  data,
  loading,
  getOrgPath,
  selectedOrgId,
  onView,
  onEdit,
  onResetPassword,
  onToggleStatus,
  onUnbind,
  onDelete,
}) => {
  const columns: ColumnsType<any> = [
    {
      title: '用户信息',
      dataIndex: 'email',
      render: (_: any, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.nickname || '未设置昵称'}</div>
          <div style={{ color: '#8c8c8c', fontSize: 12 }}>{r.email}</div>
        </div>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      render: (role: string) => <Tag color={ROLE_COLOR[role]}>{ROLE_LABEL[role] || role}</Tag>,
    },
    {
      title: '部门',
      dataIndex: 'org_name',
      render: (_: any, r) => {
        const label = getOrgPath(r.org_id, r.org_name)
        return label ? <Tag>{label}</Tag> : <Text type="secondary">未分配</Text>
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (s: 'active' | 'disabled') => <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s]}</Tag>,
    },
    {
      title: '学校/班级',
      render: r => (
        <div>
          <div>{r.school || '未设置'}</div>
          <div style={{ color: '#8c8c8c', fontSize: 12 }}>{r.class_name || '未设置'}</div>
        </div>
      ),
    },
    { title: '等级', render: r => <Tag color="gold">Lv.{r.level}</Tag> },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      render: (d?: string) => (d ? new Date(d).toLocaleString('zh-CN') : '—'),
    },
    {
      title: '操作',
      key: 'actions',
      render: r => {
        const items = [
          { key: 'view', icon: <EyeOutlined />, label: '查看详情', onClick: () => onView(r) },
          { key: 'edit', icon: <EditOutlined />, label: '编辑信息', onClick: () => onEdit(r) },
          { key: 'reset', icon: <KeyOutlined />, label: '重置密码', onClick: () => onResetPassword(r) },
          ...(r.role !== 'admin' || r.status === 'disabled'
            ? [
                {
                  key: 'toggle',
                  icon: <StopOutlined />,
                  label: r.status === 'active' ? '禁用用户' : '启用用户',
                  onClick: () => onToggleStatus(r),
                },
              ]
            : []),
          { type: 'divider' },
          ...(selectedOrgId
            ? [
                {
                  key: 'unbind',
                  icon: <UserDeleteOutlined />,
                  danger: true,
                  label: '从机构移除',
                  onClick: () => onUnbind(r),
                },
              ]
            : []),
          ...(r.role !== 'admin'
            ? [{ key: 'del', icon: <DeleteOutlined />, danger: true, label: '删除用户', onClick: () => onDelete(r) }]
            : []),
        ].filter(Boolean) as any[]
        return (
          <Space>
            <Button type="primary" ghost size="small" icon={<EyeOutlined />} onClick={() => onView(r)}>
              查看
            </Button>
            <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight">
              <Button size="small" icon={<MoreOutlined />}>
                更多
              </Button>
            </Dropdown>
          </Space>
        )
      },
    },
  ]
  return <Table rowKey="id" loading={loading} dataSource={data} columns={columns} pagination={false} />
}
