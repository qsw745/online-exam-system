import { Card, Empty } from 'antd'
import BatchSortModal from '../components/BatchSortModal'
import MenuFormModal from '../components/MenuFormModal'
import MenuToolbar from '../components/MenuToolbar'
import MenuTree from '../components/MenuTree'
import PickSystemMenuModal from '../components/PickSystemMenuModal'
import { useMenus } from '../hooks/useMenus'

type Props = {
  /** 必填：系统功能菜单页传 'system'；单位菜单页传 'unit' */
  mode: 'system' | 'unit'
  /** 单位模式必填，系统模式请勿传 */
  unitId?: number | null
}

/** 纯内容组件：不再渲染面包屑；只负责树和弹窗 */
export default function MenuManagementPage({ mode, unitId = null }: Props) {
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

  const readOnly = mode === 'system'
  const title = readOnly ? '功能菜单（系统内置，只读）' : '单位菜单（可维护）'
  const emptyDesc = mode === 'unit' ? (unitId == null ? '请在左侧选择组织' : '当前单位暂无覆盖项') : '暂无系统菜单'

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Card
        title={title}
        variant="filled"
        styles={{ body: { paddingTop: 16 } }}
        extra={
          !readOnly ? (
            <MenuToolbar
              onCreate={openCreate}
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
            readOnly={readOnly}
            onEdit={readOnly ? undefined : openEdit}
            onCopy={readOnly ? undefined : () => setFormOpen(true)}
            onDelete={readOnly ? undefined : id => remove(id)}
            onDrop={readOnly ? undefined : onTreeDrop}
          />
        )}
      </Card>

      {/* 编辑（单位覆盖/系统菜单编辑才会用；系统页只读默认不会打开） */}
      <MenuFormModal
        open={formOpen}
        editing={editing}
        parentOptions={parentOptions}
        onCancel={() => setFormOpen(false)}
        onSubmit={save}
      />

      {!readOnly && (
        <>
          <BatchSortModal
            open={sortOpen}
            items={sortItems}
            setItems={setSortItems}
            onOk={saveBatchSort}
            onCancel={() => setSortOpen(false)}
          />

          {/* 系统菜单多选选择器（仅 unit 模式） */}
          <PickSystemMenuModal
            open={pickOpen}
            loading={sysLoading}
            treeData={sysTreeData}
            onOk={onPickSystemOk}
            onCancel={() => setPickOpen(false)}
          />
        </>
      )}
    </div>
  )
}
