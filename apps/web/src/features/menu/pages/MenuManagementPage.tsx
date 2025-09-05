import { Card } from 'antd'
import MenuToolbar from '../components/MenuToolbar'
import MenuTree from '../components/MenuTree'
import MenuFormModal from '../components/MenuFormModal'
import BatchSortModal from '../components/BatchSortModal'
import { useMenus } from '../hooks/useMenus'

export default function MenuManagementPage() {
  const {
    loading,
    menus,
    formOpen,
    setFormOpen,
    editing,
    openCreate,
    openEdit,
    copyToCreate,
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
  } = useMenus()

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="菜单管理"
        extra={
          <MenuToolbar onCreate={openCreate} onBatchSort={openBatchSort} onExport={exportJSON} onImport={importJSON} />
        }
      >
        <MenuTree
          menus={menus}
          loading={loading}
          onEdit={openEdit}
          onCopy={m => {
            setFormOpen(true) /* 预填 */
          }}
          onDelete={remove}
          onDrop={onTreeDrop}
        />
      </Card>

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
    </div>
  )
}
