// components/PermissionModal.tsx
import { Button, Descriptions, Modal, Tree } from 'antd'
import type { DataNode } from 'antd/es/tree'
import React from 'react'
import type { Role } from '../types'

export function PermissionModal({
  open,
  role,
  treeData,
  checkedKeys,
  setCheckedKeys,
  onRefreshMenus,
  onOk,
  onCancel,
}: {
  open: boolean
  role: Role | null
  treeData: DataNode[]
  checkedKeys: number[]
  setCheckedKeys: (ks: number[]) => void
  onRefreshMenus: () => void
  onOk: () => void
  onCancel: () => void
}) {
  return (
    <Modal
      title={`设置角色权限 - ${role?.name ?? ''}`}
      open={open}
      onOk={onOk}
      onCancel={onCancel}
      width={800}
      okText="保存"
    >
      {role && (
        <>
          <Descriptions size="small" column={2} className="mb-4">
            <Descriptions.Item label="角色名称">{role.name}</Descriptions.Item>
            <Descriptions.Item label="角色编码">{role.code}</Descriptions.Item>
            <Descriptions.Item label="角色描述" span={2}>
              {role.description || '无描述'}
            </Descriptions.Item>
          </Descriptions>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-medium">菜单权限</h3>
            <Button size="small" onClick={onRefreshMenus}>
              刷新菜单
            </Button>
          </div>
          <Tree
            checkable
            defaultExpandAll
            height={400}
            treeData={treeData}
            checkedKeys={checkedKeys}
            onCheck={k => setCheckedKeys((Array.isArray(k) ? k : (k as any).checked) as number[])}
          />
        </>
      )}
    </Modal>
  )
}
