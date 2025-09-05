import React from 'react'
import { Button, Card, Tag, Avatar } from 'antd'
import { MessageCircle, ThumbsUp, Eye } from 'lucide-react'
import dayjs from 'dayjs'
import type { Discussion } from '../types'

type Props = {
  discussion: Discussion
  onLike: () => void
  onReply: () => void
}

const getCategoryColor = (color?: string) => color || '#1677ff'

export const DiscussionDetail: React.FC<Props> = ({ discussion, onLike, onReply }) => {
  return (
    <Card
      className="h-full"
      title={
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Tag color={getCategoryColor(discussion.category_color)}>{discussion.category_name}</Tag>
            {discussion.is_pinned && <Tag color="red">置顶</Tag>}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              type={discussion.is_liked ? 'primary' : 'default'}
              size="small"
              icon={<ThumbsUp className="w-4 h-4" />}
              onClick={onLike}
            >
              {discussion.likes_count}
            </Button>
            <Button type="primary" size="small" icon={<MessageCircle className="w-4 h-4" />} onClick={onReply}>
              回复
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold mb-3">{discussion.title}</h2>
          {discussion.question_title && (
            <div className="bg-blue-50 p-3 rounded-lg mb-3">
              <p className="text-sm text-blue-700">
                <strong>关联题目:</strong> {discussion.question_title}
              </p>
            </div>
          )}
          <div className="prose max-w-none">
            <p className="whitespace-pre-wrap">{discussion.content}</p>
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="flex items-center space-x-2">
              <Avatar src={discussion.author_avatar} size={32} className="bg-blue-500">
                {discussion.author_name.charAt(0)}
              </Avatar>
              <div>
                <div className="font-medium">{discussion.author_name}</div>
                <div className="text-xs text-gray-500">{dayjs(discussion.created_at).format('YYYY-MM-DD HH:mm')}</div>
              </div>
            </div>
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <span className="flex items-center space-x-1">
                <Eye className="w-4 h-4" />
                <span>{discussion.views_count} 浏览</span>
              </span>
              <span className="flex items-center space-x-1">
                <MessageCircle className="w-4 h-4" />
                <span>{discussion.replies_count} 回复</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
