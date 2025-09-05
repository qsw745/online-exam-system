import { Layout, message } from 'antd'
import React, { useState } from 'react'
import OrgTreePanel from '../components/OrgTreePanel'
import OrgDetailCard from '../components/OrgDetailCard'
import AddOrgModal from '../components/AddOrgModal'
import { useOrgManage } from '../hooks/useOrgManage'
import type { DataNode, EventDataNode } from 'antd/es/tree'

const { Sider, Content } = Layout

export default function OrgManage() {
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

  const onSelect = (_: React.Key[], info: { node: EventDataNode<DataNode> }) => {
    const id = Number(info.node.key)
    if (Number.isFinite(id)) setSelectedId(id)
  }

  return (
    <Layout style={{ height: '100%', background: 'transparent' }}>
      <Sider width={320} theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
        <OrgTreePanel
          loading={treeLoading}
          treeData={filteredTreeData}
          selectedId={selectedId}
          search={search}
          onSearchChange={setSearch}
          onRefresh={() => loadTree(true)}
          onAdd={() => setAddOpen(true)}
          onSelect={onSelect}
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
          await createOrg({ ...v, parent_id: detail?.id ?? null, is_enabled: true })
          setAddOpen(false)
        }}
      />
    </Layout>
  )
}
