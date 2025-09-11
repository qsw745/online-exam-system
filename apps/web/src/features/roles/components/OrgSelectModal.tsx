import { Button, Modal, Skeleton, Tree } from 'antd'
import type { DataNode } from 'antd/es/tree'
import React from 'react'

export type AntTreeNode = { key: number; title: string; children?: AntTreeNode[] }

export default function OrgSelectModal({
  open,
  loading,
  treeData,
  checked,
  onCheck,
  onCancel,
  onOk,
}: {
  open: boolean
  loading: boolean
  treeData: AntTreeNode[]
  checked: React.Key[]
  onCheck: (keys: React.Key[]) => void
  onCancel: () => void
  onOk: () => void | Promise<void>
}) {
  return (
    <Modal
      title="选择机构"
      open={open}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button key="ok" type="primary" onClick={onOk} disabled={!checked.length}>
          确定（{checked.length}）
        </Button>,
      ]}
      width={600}
      destroyOnHidden
    >
      {loading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : (
        <Tree
          checkable
          selectable={false}
          defaultExpandAll
          treeData={treeData as unknown as DataNode[]}
          checkedKeys={checked}
          onCheck={k => onCheck((Array.isArray(k) ? k : (k as any).checked) as React.Key[])}
        />
      )}
    </Modal>
  )
}
