import { Card, List, Typography } from 'antd'
import React from 'react'

export default function AnnouncementsPage() {
  const items = [
    { id: 1, title: '系统维护公告', content: '本周六凌晨 1:00 — 3:00 维护升级。' },
    { id: 2, title: '新版功能上线', content: '新增考试统计、消息中心等功能。' },
  ]
  return (
    <Card title="公告">
      <List
        itemLayout="vertical"
        dataSource={items}
        renderItem={it => (
          <List.Item key={it.id}>
            <Typography.Title level={5} style={{ marginBottom: 8 }}>
              {it.title}
            </Typography.Title>
            <Typography.Paragraph style={{ margin: 0 }}>{it.content}</Typography.Paragraph>
          </List.Item>
        )}
      />
    </Card>
  )
}
