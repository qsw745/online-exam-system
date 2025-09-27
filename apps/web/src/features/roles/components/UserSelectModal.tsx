import { Button, Modal, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import React from 'react'

type User = { id: number; username: string; email?: string; status?: string }

export default function UserSelectModal({
  open,
  loading,
  users,
  selected,
  onChangeSelected,
  onCancel,
  onOk,
}: {
  open: boolean
  loading: boolean
  users: User[]
  selected: number[]
  onChangeSelected: (ids: number[]) => void
  onCancel: () => void
  onOk: () => void | Promise<void>
}) {
  const columns: ColumnsType<User> = [
    { title: '用户名', dataIndex: 'username' },
    { title: '邮箱', dataIndex: 'email' },
  ]

  return (
    <Modal
      title="选择用户"
      open={open}
      maskClosable={false}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button key="ok" type="primary" onClick={onOk} disabled={!selected.length}>
          确定（{selected.length}）
        </Button>,
      ]}
      width={740}
      destroyOnHidden
    >
      <Table
        rowKey="id"
        loading={loading}
        dataSource={users}
        columns={columns}
        pagination={false}
        rowSelection={{
          selectedRowKeys: selected,
          onChange: (keys: React.Key[]) => onChangeSelected(keys as number[]),
          preserveSelectedRowKeys: true,
        }}
      />
    </Modal>
  )
}
