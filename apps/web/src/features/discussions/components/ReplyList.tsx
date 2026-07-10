import React from 'react'
import { Avatar, Button, Empty, List, Skeleton, Tooltip } from 'antd'
import { ThumbsUp } from 'lucide-react'
import dayjs from '@/shared/utils/dayjs'
import { translate } from '@/shared/utils/i18n'
import { formatDateTime } from '@/shared/utils/datetime'

type ReplyVM = {
  id: number
  content: string
  author_name?: string
  author_avatar?: string
  created_at?: string
  is_liked?: boolean | 0 | 1
  likes_count?: number
}

type Props = {
  loading: boolean
  replies: any[]
  onLike: (replyId: number) => void
}

const toVM = (r: any): ReplyVM => ({
  id: Number(r.id),
  content: r.content ?? '',
  author_name: r.author_name ?? r.username ?? translate('common.anonymous_user'),
  author_avatar: r.author_avatar || r.avatar || undefined,
  created_at: r.created_at ?? r.createdAt ?? undefined,
  is_liked: !!(r.is_liked ?? 0),
  likes_count: Number(r.likes_count ?? 0),
})

export const ReplyList: React.FC<Props> = ({ loading, replies, onLike }) => {
  const data = Array.isArray(replies) ? replies.map(toVM) : []

  if (!loading && data.length === 0) {
    return <Empty description={translate('auto.e6b9f96ec8')} />
  }

  return (
    <List
      dataSource={loading ? [1, 2, 3] : data}
      renderItem={(item: any) =>
        loading ? (
          <List.Item>
            <Skeleton active avatar title paragraph={{ rows: 2 }} />
          </List.Item>
        ) : (
          <List.Item
            key={item.id}
            actions={[
              <Tooltip key="like" title={item.is_liked ? translate('visible.5907f05aa4') : translate('auto.e07f300d0c')}>
                <Button
                  size="small"
                  type={item.is_liked ? 'primary' : 'default'}
                  icon={<ThumbsUp size={13} />}
                  onClick={() => onLike(item.id)}
                >
                  {item.likes_count}
                </Button>
              </Tooltip>,
            ]}
          >
            <List.Item.Meta
              avatar={
                <Avatar src={item.author_avatar}>
                  {(item.author_name ?? translate('visible.4e0a3caa22')).charAt(0)}
                </Avatar>
              }
              title={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 500 }}>{item.author_name}</span>
                  {item.created_at && (
                    <span className="disc-detail__author-time">{formatDateTime(item.created_at)}</span>
                  )}
                </span>
              }
              description={<div className="disc-prewrap">{item.content}</div>}
            />
          </List.Item>
        )
      }
    />
  )
}
