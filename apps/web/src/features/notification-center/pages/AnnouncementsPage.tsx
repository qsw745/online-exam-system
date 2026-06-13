import { Card, List, Typography } from 'antd'
import React, { useEffect, useState } from 'react'
import { announcementsApi, type Announcement } from '@/shared/api/endpoints/announcements'

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([])

  useEffect(() => {
    ;(async () => {
      try {
        const list = await announcementsApi.list()
        setItems(list)
      } catch {
        setItems([])
      }
    })()
  }, [])

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
