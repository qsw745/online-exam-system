import { Card } from 'antd'
import NotificationToolbar from '../components/NotificationToolbar'
import NotificationTable from '../components/NotificationTable'
import NotificationFormModal from '../components/NotificationFormModal'
import { useNotifications } from '../hooks/useNotifications'

export default function NotificationManagementPage() {
  const {
    // list
    notifications,
    loading,
    page,
    pageSize,
    total,
    setPage,
    setPageSize,
    // users & form
    users,
    form,
    open,
    setOpen,
    editing,
    onCreate,
    onEdit,
    onDelete,
    onSubmit,
    // utils
    typeColor,
  } = useNotifications()

  return (
    <div style={{ padding: 24 }}>
      <NotificationToolbar onCreate={onCreate} />
      <Card>
        <NotificationTable
          data={notifications}
          loading={loading}
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={(p, s) => {
            setPage(p)
            if (s && s !== pageSize) {
              setPageSize(s)
              setPage(1)
            }
          }}
          onEdit={onEdit}
          onDelete={onDelete}
          typeColor={typeColor}
        />
      </Card>

      <NotificationFormModal
        open={open}
        onClose={() => {
          setOpen(false)
          form.resetFields()
        }}
        form={form}
        users={users}
        editing={editing}
        onSubmit={onSubmit}
      />
    </div>
  )
}
