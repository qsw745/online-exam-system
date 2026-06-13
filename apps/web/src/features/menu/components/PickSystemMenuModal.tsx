import React, { useMemo, useState } from 'react'
import { Modal, Tree, Input, Spin, Empty } from 'antd'
import type { DataNode } from 'antd/es/tree'

type Props = {
  open: boolean
  loading?: boolean
  treeData: DataNode[] // <— 传的是“完整候选系统菜单树”
  onOk: (sysMenuIds: number[]) => void
  onCancel: () => void
}

export default function PickSystemMenuModal({ open, loading, treeData, onOk, onCancel }: Props) {
  const [keyword, setKeyword] = useState('')
  const [checkedKeys, setCheckedKeys] = useState<React.Key[]>([])

  // 过滤（仅影响显示，不影响最终补全）
  const filterTree = (nodes: DataNode[]): DataNode[] => {
    const k = keyword.trim().toLowerCase()
    if (!k) return nodes
    const hit = (n: DataNode) =>
      String(n.title ?? '')
        .toLowerCase()
        .includes(k)
    const walk = (list: DataNode[]): DataNode[] => {
      const out: DataNode[] = []
      for (const n of list) {
        const children = Array.isArray(n.children) ? walk(n.children) : undefined
        if (hit(n) || (children && children.length)) out.push({ ...n, children })
      }
      return out
    }
    return walk(nodes)
  }
  const data = useMemo(() => filterTree(treeData), [treeData, keyword])

  // 计算一组 key 的所有后代 key（基于完整树 treeData，而不是过滤后的 data）
  const collectDescendants = (keys: React.Key[], forest: DataNode[]): React.Key[] => {
    const need = new Set(keys)
    const result = new Set<React.Key>()
    const visitAll = (nodes?: DataNode[]) => {
      if (!nodes) return
      for (const n of nodes) {
        if (need.has(n.key as React.Key)) markDesc(n) // 命中：把其所有后代加入
        visitAll(n.children as DataNode[] | undefined) // 继续在整棵树里找其它命中
      }
    }
    const markDesc = (node: DataNode) => {
      const ch = node.children as DataNode[] | undefined
      if (!ch?.length) return
      for (const c of ch) {
        result.add(c.key as React.Key)
        markDesc(c)
      }
    }
    visitAll(forest)
    return Array.from(result)
  }

  const handleOk = () => {
    if (!checkedKeys.length) return
    // 补全所有后代：父级被勾选 -> 子级必然加入返回
    const descendants = collectDescendants(checkedKeys, treeData)
    const all = Array.from(new Set([...checkedKeys, ...descendants]))
      .map(Number)
      .filter(Boolean)
    onOk(all)
    setCheckedKeys([])
    setKeyword('')
  }

  const handleCancel = () => {
    onCancel()
    setCheckedKeys([])
    setKeyword('')
  }

  return (
    <Modal
      maskClosable={false}
      title="选择系统菜单作为单位覆盖（可多选）"
      open={open}
      onOk={handleOk}
      okButtonProps={{ disabled: !checkedKeys.length }}
      onCancel={handleCancel}
      width={720}
      destroyOnHidden
    >
      <Input.Search
        placeholder="输入名称筛选"
        value={keyword}
        onChange={e => setKeyword(e.target.value)}
        allowClear
        style={{ marginBottom: 12 }}
      />
      <div style={{ maxHeight: 460, overflow: 'auto', border: '1px solid #f0f0f0', borderRadius: 8, padding: 8 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <Spin />
          </div>
        ) : data && data.length ? (
          <Tree
            checkable
            // ❌ 去掉 checkStrictly，启用父子级联（父选子、子选连动）
            selectable={false}
            defaultExpandAll
            treeData={data}
            checkedKeys={checkedKeys}
            onCheck={keys => setCheckedKeys(keys as React.Key[])}
          />
        ) : (
          <Empty description="没有可选的系统菜单（可能已全部覆盖）" />
        )}
      </div>
    </Modal>
  )
}
