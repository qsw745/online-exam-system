import React from 'react'
import { Avatar, Button, Empty, List, Skeleton, Tooltip } from 'antd'
import { ThumbsUp } from 'lucide-react'
import dayjs from 'dayjs'

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
  author_name: r.author_name ?? r.username ?? '匿名用户',
  author_avatar: r.author_avatar ?? r.avatar ?? undefined,
  created_at: r.created_at ?? r.createdAt ?? undefined,
  is_liked: !!(r.is_liked ?? 0),
  likes_count: Number(r.likes_count ?? 0),
})

export const ReplyList: React.FC<Props> = ({ loading, replies, onLike }) => {
  const data = Array.isArray(replies) ? replies.map(toVM) : []

  if (!loading && data.length === 0) {
    return <Empty description="暂无回复" />
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
              <Tooltip key="like" title={item.is_liked ? '取消点赞' : '点赞'}>
                <Button
                  size="small"
                  type={item.is_liked ? 'primary' : 'default'}
                  icon={<ThumbsUp className="w-4 h-4" />}
                  onClick={() => onLike(item.id)}
                >
                  {item.likes_count}
                </Button>
              </Tooltip>,
            ]}
          >
            <List.Item.Meta
              avatar={
                <Avatar src={item.author_avatar} className="bg-blue-500">
                  {(item.author_name ?? '匿').charAt(0)}
                </Avatar>
              }
              title={
                <div className="flex items-center gap-2">
                  <span className="font-medium">{item.author_name}</span>
                  {item.created_at && (
                    <span className="text-xs text-gray-500">{dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}</span>
                  )}
                </div>
              }
              description={<div className="whitespace-pre-wrap">{item.content}</div>}
            />
          </List.Item>
        )
      }
    />
  )
}
