import { useNotifications } from '@/shared/hooks/useNotifications'
import { Card } from 'antd'
import NotificationFormModal from '../components/NotificationFormModal'
import NotificationsList from '../components/NotificationsList'
import NotificationsToolbar from '../components/NotificationsToolbar'
// ★ 最小“列表项”形状（满足 NotificationsList 的 data 要求）
// ✅ 与 NotificationsList 的要求一致
type NotifType = 'system' | 'exam' | 'grade' | 'announcement'
// ✅ 让 content 成为必填
type ListItem = {
  id: number
  title: string
  content: string
  type: NotifType
  is_read: boolean
  created_at: string // ← 必填 string
}

// 小工具：把后端来的字符串规范到联合类型；未知一律归为 system
const normalizeType = (t: any): NotifType => {
  switch ((t ?? '').toString().toLowerCase()) {
    case 'exam':
    case 'grade':
    case 'announcement':
    case 'system':
      return t as NotifType
    default:
      return 'system'
  }
}
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
  // 将 NotificationDTO → ListItem（兜底兼容不同字段命名）
  // ✅ 映射时强制成字符串
  const items: ListItem[] = (notifications || []).map((n: any) => ({
    id: Number(n.id),
    title: n.title ?? n.subject ?? '',
    content: String(n.content ?? n.message ?? ''),
    type: normalizeType(n.type ?? n.level ?? 'system'),
    is_read: Boolean(n.is_read ?? n.read ?? n.read_at),
    created_at: String(n.created_at ?? n.createdAt ?? ''), // ← 强转为 string
  }))

  const unread = items.filter(i => !i.is_read).length
  const handleMarkAll = () => {
    // 这里没有显式的 markAllRead，就先占位；后端/Hook加上后再替换
    // message.info('已将全部标记为已读') // 若你想给个反馈
  }
  const handlePageChange = (p: number, s?: number) => {
    setPage(p)
    if (typeof s === 'number' && s !== pageSize) {
      setPageSize(s)
      setPage(1)
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <NotificationsToolbar unread={unread} onMarkAll={handleMarkAll} />
      <Card>
        <NotificationsList
          data={items}
          loading={loading}
          onMarkRead={(_id: number) => {}}
          onRemove={(id: number) => {
            void onDelete(id)
          }}
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
