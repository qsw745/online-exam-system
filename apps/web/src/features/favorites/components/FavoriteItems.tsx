import { Button, Empty, List, Space, Spin, Tag, Typography } from 'antd'
import { Trash2 } from 'lucide-react'
import type { FavoriteItem } from '@/shared/api/endpoints/favorites'
import { translate } from '@/shared/utils/i18n'
import { formatDateTime } from '@/shared/utils/datetime'

const { Text } = Typography

function getDifficultyColor(d?: string) {
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
function getDifficultyText(d?: string) {
  switch ((d || '').toLowerCase()) {
    case 'easy':
      return translate('questions.easy')
    case 'medium':
      return translate('questions.medium')
    case 'hard':
      return translate('questions.hard')
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
  if (!loading && items.length === 0) return <Empty description={translate('auto.9f1c610c1a')} />
  return (
    <Spin spinning={loading}>
      <List
        dataSource={items}
        renderItem={item => (
          <List.Item
            actions={[
              <Button
                key="view"
                type="link"
                disabled={!(item.question_id ?? item.item_id)}
                onClick={() => {
                  const qid = item.question_id ?? item.item_id
                  if (typeof qid === 'number') onView(qid)
                }}
              >
                {translate('questions.page_view')}</Button>,
              <Button
                key="remove"
                type="text"
                danger
                icon={<Trash2 style={{ width: 16, height: 16 }} />}
                onClick={() => onRemove(item.id)}
              >
                {translate('papers.op_remove')}</Button>,
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
                    {translate('auto.75b468a7bc')}{item.subject || '-'}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 14 }}>
                    {translate('auto.fe5230eabe')}{item.question_type || item.item_type || '-'}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 14 }}>
                    {translate('auto.b83b012042')}{' '}
                    {item.added_at ? formatDateTime(item.added_at) : translate('examPage.proctor.status.unknown')}
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
