import { Badge, Card, List, Space, Tag } from 'antd'
import React, { useMemo, useState } from 'react'

type Item = { id: number; title: string; type: 'notice' | 'message'; read?: boolean; created_at: string }

export default function InboxPage() {
  const [list] = useState<Item[]>(
    useMemo(
      () => [
        { id: 1, title: '系统维护公告', type: 'notice', created_at: '2025-01-05 08:00' },
        { id: 2, title: '考试开始提醒', type: 'message', created_at: '2025-01-05 09:00' },
      ],
      []
    )
  )

  const unread = list.filter(i => !i.read).length

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      <Badge count={unread}>
        <Card title="收件箱">
          <List
            dataSource={list}
            renderItem={it => (
              <List.Item>
                <Space size={8}>
                  <Tag color={it.type === 'notice' ? 'blue' : 'green'}>{it.type === 'notice' ? '公告' : '消息'}</Tag>
                  <span>{it.title}</span>
                  <span style={{ color: '#999' }}>{it.created_at}</span>
                </Space>
              </List.Item>
            )}
          />
        </Card>
      </Badge>
    </Space>
  )
}
