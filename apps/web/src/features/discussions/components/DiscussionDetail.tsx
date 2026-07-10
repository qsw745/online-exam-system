import React from 'react'
import { Button, Card, Tag, Avatar, Space, Tooltip } from 'antd'
import { MessageCircle, ThumbsUp, Eye } from 'lucide-react'
import { translate } from '@/shared/utils/i18n'
import { formatDateTime } from '@/shared/utils/datetime'

type Props = {
  discussion: Record<string, any>
  onLike: () => void
  onReply: () => void
}

const getCategoryColor = (color?: string) => color || '#1677ff'
const safe = (v: any, fb = '') => (v === null || v === undefined ? fb : v)

export const DiscussionDetail: React.FC<Props> = ({ discussion, onLike, onReply }) => {
  const authorName = safe(discussion.author_name ?? discussion.username, '用户')
  const authorAvatar = discussion.author_avatar || discussion.avatar || undefined
  const createdAt = discussion.created_at ? formatDateTime(discussion.created_at) : ''

  // 名称/颜色兜底：后端可能只给了 category_id
  const catId = String(discussion.category_id ?? discussion.category ?? '')
  const category_name =
    typeof discussion.category_name === 'string' && discussion.category_name.trim()
      ? discussion.category_name
      : discussion.category?.name || (catId ? catId : '')
  const category_color = discussion.category_color ?? discussion.category?.color

  return (
    <Card>
      <div className="disc-detail__head">
        <Space size="small" wrap>
          {category_name && <Tag color={getCategoryColor(category_color)}>{category_name}</Tag>}
          {discussion.is_pinned ? <Tag color="red">{translate('auto.7bcf18641f')}</Tag> : null}
        </Space>
        <Space>
          <Tooltip title={discussion.is_liked ? translate('visible.5907f05aa4') : translate('auto.e07f300d0c')}>
            <Button
              shape="round"
              type={discussion.is_liked ? 'primary' : 'default'}
              icon={<ThumbsUp size={14} />}
              onClick={onLike}
            >
              {discussion.likes_count ?? discussion.like_count ?? 0}
            </Button>
          </Tooltip>
          <Button shape="round" type="primary" icon={<MessageCircle size={14} />} onClick={onReply}>
            {translate('auto.ffc7850925')}
          </Button>
        </Space>
      </div>

      <h2 className="disc-detail__title">{safe(discussion.title, translate('header.untitled'))}</h2>

      {discussion.question_title && (
        <div className="disc-detail__question">
          <strong>{translate('auto.e79035ba92')}</strong>
          {discussion.question_title}
        </div>
      )}

      <div className="disc-detail__content">{safe(discussion.content, '')}</div>

      <div className="disc-detail__foot">
        <div className="disc-detail__author">
          <Avatar src={authorAvatar} size={36}>
            {(authorName || translate('visible.61410653c6')).charAt(0)}
          </Avatar>
          <div>
            <div className="disc-detail__author-name">{authorName}</div>
            <div className="disc-detail__author-time">{createdAt}</div>
          </div>
        </div>

        <Space size="middle">
          <span className="disc-stat">
            <Eye size={14} />
            {discussion.views_count ?? discussion.view_count ?? 0} {translate('auto.ef23ea67b0')}
          </span>
          <span className="disc-stat">
            <MessageCircle size={14} />
            {discussion.replies_count ?? discussion.reply_count ?? 0} {translate('auto.ffc7850925')}
          </span>
        </Space>
      </div>
    </Card>
  )
}
