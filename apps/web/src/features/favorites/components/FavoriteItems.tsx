import { Button, Empty, List, Space, Spin, Tag, Typography } from 'antd'
import { Trash2 } from 'lucide-react'
import type { FavoriteItem } from '@/shared/api/endpoints/favorites'

const { Text } = Typography

function getDifficultyColor(d: string) {
  switch ((d || '').toLowerCase()) {
    case 'easy':
      return 'green'
    case 'medium':
      return 'orange'
    case 'hard':
      return 'red'
    default:
      return 'default'
  }
}
function getDifficultyText(d: string) {
  switch ((d || '').toLowerCase()) {
    case 'easy':
      return '简单'
    case 'medium':
      return '中等'
    case 'hard':
      return '困难'
    default:
      return d
  }
}

type Props = {
  items: FavoriteItem[]
  loading: boolean
  onView: (qid: number) => void
  onRemove: (itemId: number) => void
}

export default function FavoriteItems({ items, loading, onView, onRemove }: Props) {
  if (!loading && items.length === 0) return <Empty description="收藏夹为空" />
  return (
    <Spin spinning={loading}>
      <List
        dataSource={items}
        renderItem={item => (
          <List.Item
            actions={[
              <Button key="view" type="link" onClick={() => onView(item.question_id)}>
                查看题目
              </Button>,
              <Button
                key="remove"
                type="text"
                danger
                icon={<Trash2 style={{ width: 16, height: 16 }} />}
                onClick={() => onRemove(item.id)}
              >
                移除
              </Button>,
            ]}
          >
            <List.Item.Meta
              title={
                <div className="flex items-center space-x-2">
                  <span>{item.question_title}</span>
                  <Tag color={getDifficultyColor(item.difficulty)}>{getDifficultyText(item.difficulty)}</Tag>
                </div>
              }
              description={
                <Space size="large">
                  <Text type="secondary" style={{ fontSize: 14 }}>
                    科目: {item.subject}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 14 }}>
                    类型: {item.question_type}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 14 }}>
                    收藏时间: {new Date(item.added_at).toLocaleDateString()}
                  </Text>
                </Space>
              }
            />
          </List.Item>
        )}
      />
    </Spin>
  )
}
