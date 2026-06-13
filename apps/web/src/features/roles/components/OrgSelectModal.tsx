import React from 'react'
import { Button, Modal, Spin, Tree, Typography } from 'antd'
import type { TreeProps } from 'antd'

const { Text } = Typography

// 兼容各种机构节点结构
export type OrgNode = {
  id: number | string
  name?: string
  title?: string
  code?: string
  children?: OrgNode[]
}

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
  treeData: OrgNode[]
  checked: React.Key[]
  onCheck: (keys: React.Key[]) => void
  onCancel: () => void
  onOk: () => void | Promise<void>
}) {
  // antd Tree 在 check 且未开启 checkStrictly 时，onCheck 的第一个参数可能是数组或对象
  const handleCheck: TreeProps['onCheck'] = ck => {
    const keys = Array.isArray(ck) ? ck : (ck as any)?.checked
    onCheck(Array.isArray(keys) ? (keys as React.Key[]) : [])
  }

  return (
    <Modal
      title="选择机构"
      open={open}
      maskClosable={false}
      onCancel={onCancel}
      destroyOnHidden // ✅ antd v5 正确属性
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取 消
        </Button>,
        <Button key="ok" type="primary" disabled={!checked.length} onClick={onOk}>
          确定（{checked.length}）
        </Button>,
      ]}
      width={720}
    >
      <div style={{ minHeight: 320 }}>
        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', height: 320 }}>
            <Spin />
          </div>
        ) : (
          <Tree
            checkable
            blockNode
            selectable={false}
            fieldNames={{ key: 'id', title: 'name', children: 'children' }}
            treeData={treeData as any}
            checkedKeys={checked}
            onCheck={handleCheck}
            defaultExpandAll
            titleRender={(node: any) => <Text>{node.name ?? node.title ?? node.code ?? '（未命名）'}</Text>}
          />
        )}
      </div>
    </Modal>
  )
}
