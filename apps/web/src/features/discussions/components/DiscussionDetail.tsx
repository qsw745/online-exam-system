import React from 'react'
import { Button, Card, Tag, Avatar, Space, Tooltip } from 'antd'
import { MessageCircle, ThumbsUp, Eye } from 'lucide-react'
import dayjs from 'dayjs'

type Props = {
  discussion: Record<string, any>
  onLike: () => void
  onReply: () => void
}

const getCategoryColor = (color?: string) => color || '#1677ff'
const safe = (v: any, fb = '') => (v === null || v === undefined ? fb : v)

export const DiscussionDetail: React.FC<Props> = ({ discussion, onLike, onReply }) => {
  const authorName = safe(discussion.author_name ?? discussion.username, '用户')
  const authorAvatar = discussion.author_avatar ?? discussion.avatar
  const createdAt = discussion.created_at ? dayjs(discussion.created_at).format('YYYY-MM-DD HH:mm') : ''

  // 名称/颜色兜底：后端可能只给了 category_id
  const catId = String(discussion.category_id ?? discussion.category ?? '')
  const category_name =
    typeof discussion.category_name === 'string' && discussion.category_name.trim()
      ? discussion.category_name
      : discussion.category?.name || (catId ? catId : '')
  const category_color = discussion.category_color ?? discussion.category?.color

  return (
    <Card className="h-full border bg-white shadow-sm rounded-2xl">
      <div className="flex items-center justify-between mb-3">
        <Space size="small" wrap>
          {category_name && <Tag color={getCategoryColor(category_color)}>{category_name}</Tag>}
          {discussion.is_pinned ? <Tag color="red">置顶</Tag> : null}
        </Space>
        <Space>
          <Tooltip title={discussion.is_liked ? '取消点赞' : '点赞'}>
            <Button
              shape="round"
              type={discussion.is_liked ? 'primary' : 'default'}
              icon={<ThumbsUp className="w-4 h-4" />}
              onClick={onLike}
            >
              {discussion.likes_count ?? discussion.like_count ?? 0}
            </Button>
          </Tooltip>
          <Button shape="round" type="primary" icon={<MessageCircle className="w-4 h-4" />} onClick={onReply}>
            回复
          </Button>
        </Space>
      </div>

      <h2 className="text-2xl font-bold leading-snug mb-3">{safe(discussion.title, '(无标题)')}</h2>

      {discussion.question_title && (
        <div className="bg-blue-50 border border-blue-100 text-blue-700 px-3 py-2 rounded-lg mb-3">
          <strong>关联题目：</strong>
          {discussion.question_title}
        </div>
      )}

      <div className="prose max-w-none leading-7 text-gray-800 mb-4">
        <p className="whitespace-pre-wrap">{safe(discussion.content, '')}</p>
      </div>

      <div className="flex items-center justify-between pt-3 border-t">
        <div className="flex items-center gap-2">
          <Avatar src={authorAvatar} size={36} className="bg-blue-500">
            {(authorName || '用').charAt(0)}
          </Avatar>
          <div>
            <div className="font-medium">{authorName}</div>
            <div className="text-xs text-gray-500">{createdAt}</div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span className="flex items-center gap-1">
            <Eye className="w-4 h-4" />
            <span>{discussion.views_count ?? discussion.view_count ?? 0} 浏览</span>
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="w-4 h-4" />
            <span>{discussion.replies_count ?? discussion.reply_count ?? 0} 回复</span>
          </span>
        </div>
      </div>
    </Card>
  )
}
