import { Button, Modal, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import React from 'react'
import { translate } from '@/shared/utils/i18n'

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
    { title: translate('auth.username'), dataIndex: 'username' },
    { title: translate('auth.email'), dataIndex: 'email' },
  ]

  return (
    <Modal
      title={translate('auto.412af8474e')}
      open={open}
      maskClosable={false}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          {translate('app.cancel')}</Button>,
        <Button key="ok" type="primary" onClick={onOk} disabled={!selected.length}>
          {translate('auto.bee22f3c9e')}{selected.length}）
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
