import { Badge, Button, List, Space, Typography } from 'antd'
import { Bell, Check, Trash2 } from 'lucide-react'
const { Text } = Typography

export type Item = {
  id: number
  title: string
  content: string
  type: 'system' | 'exam' | 'grade' | 'announcement'
  is_read: boolean
  created_at: string
}

const typeColor = (t: string) =>
  t === 'system'
    ? 'blue'
    : t === 'exam'
    ? 'orange'
    : t === 'grade'
    ? 'green'
    : t === 'announcement'
    ? 'purple'
    : 'default'
const typeText = (t: string) =>
  t === 'system'
    ? '系统通知'
    : t === 'exam'
    ? '考试通知'
    : t === 'grade'
    ? '成绩通知'
    : t === 'announcement'
    ? '公告'
    : '通知'

export default function NotificationsList({
  data,
  loading,
  onMarkRead,
  onRemove,
}: {
  data: Item[]
  loading: boolean
  onMarkRead: (id: number) => void
  onRemove: (id: number) => void
}) {
  if (!loading && data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <Bell style={{ width: 64, height: 64, color: '#d9d9d9', margin: '0 auto 16px' }} />
        <Text type="secondary">暂无通知</Text>
      </div>
    )
  }

  return (
    <List
      dataSource={data}
      renderItem={n => (
        <List.Item
          style={{
            backgroundColor: !n.is_read ? '#f0f9ff' : undefined,
            borderRadius: 8,
            marginBottom: 8,
            padding: 16,
          }}
          actions={[
            !n.is_read && (
              <Button
                key="read"
                type="text"
                size="small"
                icon={<Check style={{ width: 16, height: 16 }} />}
                onClick={() => onMarkRead(n.id)}
              >
                标记已读
              </Button>
            ),
            <Button
              key="del"
              type="text"
              size="small"
              danger
              icon={<Trash2 style={{ width: 16, height: 16 }} />}
              onClick={() => onRemove(n.id)}
            >
              删除
            </Button>,
          ].filter(Boolean)}
        >
          <List.Item.Meta
            title={
              <Space align="center">
                <span style={{ fontWeight: !n.is_read ? 600 : 'normal' }}>{n.title}</span>
                <Badge color={typeColor(n.type)} text={typeText(n.type)} />
                {!n.is_read && <Badge status="processing" />}
              </Space>
            }
            description={
              <div>
                <Text style={{ fontWeight: !n.is_read ? 500 : 'normal' }}>{n.content}</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 14 }}>
                  {new Date(n.created_at).toLocaleString()}
                </Text>
              </div>
            }
          />
        </List.Item>
      )}
    />
  )
}
