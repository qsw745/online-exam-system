// features/users/components/UsersTable.tsx
import { Pagination, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import React from 'react'

export interface User {
  id: number
  username: string
  email: string
  status: string
  created_at: string
}

const columns: ColumnsType<User> = [
  { title: '用户名', dataIndex: 'username' },
  { title: '邮箱', dataIndex: 'email' },
  {
    title: '状态',
    dataIndex: 'status',
    render: s => <Tag color={s === 'active' ? 'green' : 'red'}>{s === 'active' ? '正常' : '禁用'}</Tag>,
  },
  { title: '创建时间', dataIndex: 'created_at', render: t => (t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '-') },
]

export const UsersTable: React.FC<{
  data: User[]
  loading: boolean
  selectedRowKeys: React.Key[]
  onSelectChange: (keys: React.Key[]) => void
  page: number
  pageSize: number
  total: number
  onPageChange: (p: number, ps: number) => void
}> = ({ data, loading, selectedRowKeys, onSelectChange, page, pageSize, total, onPageChange }) => (
  <>
    <Table<User>
      rowKey="id"
      loading={loading}
      dataSource={data}
      columns={columns}
      pagination={false}
      rowSelection={{ selectedRowKeys, onChange: onSelectChange }}
    />
    <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
      <Pagination
        current={page}
        pageSize={pageSize}
        total={total}
        showSizeChanger
        showQuickJumper
        onChange={onPageChange}
        showTotal={(t, range) => `共 ${t} 条，当前 ${range[0]}-${range[1]}`}
      />
    </div>
  </>
)
