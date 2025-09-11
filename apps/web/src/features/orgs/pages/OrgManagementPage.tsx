import { Input, Layout, message } from 'antd'
import React, { useEffect, useMemo, useState } from 'react'
import { OrgTreePanel } from '../components/OrgTreePanel'
import OrgDetailCard from '../components/OrgDetailCard'
import AddOrgModal from '../components/AddOrgModal'
import { useOrgManage } from '../hooks/useOrgManage'

type RawNode = { id: number; name: string; children?: RawNode[] }

// DataNode -> RawNode
function toRawTree(nodes: any[] = []): RawNode[] {
  return nodes.map(n => ({
    id: Number(n.key),
    name: String(n.title ?? ''),
    children: n.children ? toRawTree(n.children) : [],
  }))
}

const { Sider, Content } = Layout
const { Search } = Input

export default function OrgManagementPage() {
  const {
    treeLoading,
    filteredTreeData,
    search,
    setSearch,
    selectedId,
    setSelectedId,
    detail,
    detailLoading,
    loadTree,
    createOrg,
    updateOrg,
    removeOrg,
  } = useOrgManage()

  const [addOpen, setAddOpen] = useState(false)

  const rawTree = useMemo<RawNode[]>(() => toRawTree(filteredTreeData), [filteredTreeData])
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])

  // 默认选中+展开根
  useEffect(() => {
    if (!rawTree.length) return
    const rootId = rawTree[0].id
    if (selectedId == null || !Number.isFinite(selectedId)) setSelectedId(rootId)
    setExpandedKeys(prev => (prev && prev.length ? prev : [rootId]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawTree])

  const handleSelect = (id: number) => {
    if (Number.isFinite(id)) setSelectedId(id)
  }

  return (
    <Layout style={{ height: '100%', background: 'transparent' }}>
      <Sider width={320} theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
        <div style={{ padding: 12 }}>
          <Search
            placeholder="搜索机构..."
            allowClear
            value={search}
            onChange={e => setSearch(e.target.value)}
            onSearch={kw => setSearch(kw)}
          />
        </div>

        <OrgTreePanel
          tree={rawTree}
          loading={treeLoading}
          expandedKeys={expandedKeys}
          setExpandedKeys={setExpandedKeys}
          selectedOrgId={selectedId}
          onSelect={handleSelect}
          onRefresh={() => loadTree(true)}
          onAdd={() => setAddOpen(true)} // ← 新增机构入口
        />
      </Sider>

      <Content style={{ padding: 16 }}>
        <OrgDetailCard
          detail={detail}
          loading={detailLoading}
          onSave={async v => {
            if (!detail) return
            await updateOrg(detail.id, v)
            message.success('保存成功')
          }}
          onDelete={async () => {
            if (!detail) return
            await removeOrg(detail.id)
            message.success('删除成功')
          }}
        />
      </Content>

      <AddOrgModal
        open={addOpen}
        parentName={detail?.name}
        onCancel={() => setAddOpen(false)}
        onOk={async v => {
          await createOrg({ ...v, parent_id: detail?.id ?? null, is_active: 1 })
          setAddOpen(false)
        }}
      />
    </Layout>
  )
}
