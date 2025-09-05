import React from 'react'
import { Empty, List, Spin, Button, Avatar } from 'antd'
import { ThumbsUp } from 'lucide-react'
import dayjs from 'dayjs'
import type { Reply } from '../types'

type Props = {
  loading: boolean
  replies: Reply[]
  onLike: (replyId: number) => void
}

export const ReplyList: React.FC<Props> = ({ loading, replies, onLike }) => {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-3">回复 ({replies.length})</h3>
      <Spin spinning={loading}>
        {replies.length === 0 ? (
          <Empty description="暂无回复" />
        ) : (
          <List
            dataSource={replies}
            renderItem={r => (
              <List.Item className="border-b border-gray-100 last:border-b-0">
                <div className="w-full">
                  <div className="flex items-start space-x-3">
                    <Avatar src={r.author_avatar} size={32} className="bg-green-500">
                      {r.author_name.charAt(0)}
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium">{r.author_name}</div>
                        <div className="flex items-center space-x-2">
                          <Button
                            type={r.is_liked ? 'primary' : 'text'}
                            size="small"
                            icon={<ThumbsUp className="w-3 h-3" />}
                            onClick={() => onLike(r.id)}
                          >
                            {r.likes_count}
                          </Button>
                          <span className="text-xs text-gray-500">{dayjs(r.created_at).fromNow()}</span>
                        </div>
                      </div>
                      <p className="whitespace-pre-wrap text-gray-700">{r.content}</p>
                    </div>
                  </div>
                </div>
              </List.Item>
            )}
          />
        )}
      </Spin>
    </div>
  )
}
