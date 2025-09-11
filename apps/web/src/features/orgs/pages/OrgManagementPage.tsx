// apps/web/src/features/orgs/pages/OrgManagementPage.tsx
import { Input, Layout, message } from 'antd'
import React, { useEffect, useMemo, useState } from 'react'
import AddOrgModal from '../components/AddOrgModal'
import OrgDetailCard from '../components/OrgDetailCard'
import { OrgTreePanel } from '../components/OrgTreePanel'
import { useOrgManage } from '../hooks/useOrgManage'

type RawNode = { id: number; name: string; children?: RawNode[] }

const { Sider, Content } = Layout
const { Search } = Input

export default function OrgManagementPage() {
  const {
    treeLoading,
    rawTree,
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

  // 直接使用“后端结构”的过滤结果
  const treeForPanel = useMemo<RawNode[]>(() => (rawTree as unknown as RawNode[]) || [], [rawTree])

  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])

  // 树到位后默认选中并展开根（仅当没有展开项时设置）
  useEffect(() => {
    if (!treeForPanel.length) return
    const rootId = treeForPanel[0].id
    if (selectedId == null || !Number.isFinite(selectedId)) setSelectedId(rootId)
    setExpandedKeys(prev => (prev && prev.length ? prev : [rootId]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeForPanel])

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
          tree={treeForPanel}
          loading={treeLoading}
          expandedKeys={expandedKeys}
          setExpandedKeys={setExpandedKeys}
          selectedOrgId={selectedId}
          onSelect={handleSelect}
          onRefresh={() => loadTree(true)}
          onAdd={() => setAddOpen(true)}
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
            try {
              const m = await removeOrg(detail.id) // { message }
              message.success(m?.message || '删除成功')
            } catch (e: any) {
              message.error(e?.message || '删除失败')
            }
          }}
        />
      </Content>

      <AddOrgModal
        open={addOpen}
        parentName={detail?.name}
        onCancel={() => setAddOpen(false)}
        onOk={async v => {
          try {
            await createOrg({ ...v, parent_id: detail?.id ?? null, is_active: 1 })
            setAddOpen(false)
            message.success('创建成功')
          } catch (e: any) {
            message.error(e?.message || '创建失败')
          }
        }}
      />
    </Layout>
  )
}
