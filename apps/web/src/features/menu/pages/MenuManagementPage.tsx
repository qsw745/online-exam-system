import { Card, Empty } from 'antd'
import MenuToolbar from '../components/MenuToolbar'
import MenuTree from '../components/MenuTree'
import MenuFormModal from '../components/MenuFormModal'
import BatchSortModal from '../components/BatchSortModal'
import PickSystemMenuModal from '../components/PickSystemMenuModal'
import { useMenus } from '../hooks/useMenus'
import AppBreadcrumb from '@/shared/components/AppBreadcrumb'
type Props = {
  mode?: 'system' | 'unit'
  unitId?: number | null
}

export default function MenuManagementPage({ mode = 'unit', unitId = null }: Props) {
  const {
    loading,
    menus,
    formOpen,
    setFormOpen,
    editing,
    openCreate,
    openEdit,
    save,
    remove,
    onTreeDrop,
    sortOpen,
    setSortOpen,
    sortItems,
    setSortItems,
    openBatchSort,
    saveBatchSort,
    parentOptions,
    exportJSON,
    importJSON,
    // 多选选择器
    pickOpen,
    setPickOpen,
    sysLoading,
    sysTreeData,
    onPickSystemOk,
  } = useMenus({ mode, unitId: unitId ?? undefined })

  const title = mode === 'system' ? '功能菜单（系统内置，只读）' : '单位菜单（可维护）'
  const emptyDesc = mode === 'unit' ? (unitId == null ? '请在左侧选择组织' : '当前单位暂无覆盖项') : '暂无系统菜单'

  return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <AppBreadcrumb/>
      <Card
        title={title}
        variant="filled"
        styles={{ body: { paddingTop: 16 } }}
        extra={
          mode === 'unit' ? (
            <MenuToolbar
              onCreate={openCreate} // 弹多选对话框
              onBatchSort={openBatchSort}
              onExport={exportJSON}
              onImport={importJSON}
            />
          ) : null
        }
        style={{ flex: 1, overflow: 'hidden' }}
      >
        {!loading && (!menus || menus.length === 0) ? (
          <Empty description={emptyDesc} />
        ) : (
          <MenuTree
            menus={menus}
            loading={loading}
            onEdit={openEdit}
            onCopy={() => setFormOpen(true)}
            onDelete={id => remove(id)}
            onDrop={onTreeDrop}
          />
        )}
      </Card>

      {/* 编辑（仅修改覆盖或系统菜单属性时使用） */}
      <MenuFormModal
        open={formOpen}
        editing={editing}
        parentOptions={parentOptions}
        onCancel={() => setFormOpen(false)}
        onSubmit={save}
      />

      <BatchSortModal
        open={sortOpen}
        items={sortItems}
        setItems={setSortItems}
        onOk={saveBatchSort}
        onCancel={() => setSortOpen(false)}
      />

      {/* 系统菜单多选选择器（仅 unit 模式） */}
      <PickSystemMenuModal
        open={mode === 'unit' && pickOpen}
        loading={sysLoading}
        treeData={sysTreeData}
        onOk={onPickSystemOk} // <- 现在返回 number[]
        onCancel={() => setPickOpen(false)}
      />
    </div>
  )
}
