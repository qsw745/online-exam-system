import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Typography, List, Spin, Result, Space, Button, Tag, Empty } from 'antd'
import { favoritesApi, type Favorite, type FavoriteItem } from '@/shared/api/endpoints/favorites'
import { withAppBasePath } from '@/shared/router/basePath'
import { translate } from '@/shared/utils/i18n'

const { Title, Paragraph, Text } = Typography

type SharedFavoritePayload = {
  favorite: Favorite
  items: FavoriteItem[]
  owner?: { id: number; username?: string | null; nickname?: string | null }
}

export default function SharedFavoritePage() {
  const { code = '' } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [data, setData] = React.useState<SharedFavoritePayload | null>(null)

  React.useEffect(() => {
    let alive = true
    const fetchShared = async () => {
      try {
        setLoading(true)
        setError(null)
        const payload = await favoritesApi.getShared(code)
        if (!alive) return
        if (!payload) {
          setError('分享链接不存在或已失效')
          setData(null)
          return
        }
        setData(payload)
      } catch (e: any) {
        if (!alive) return
        setError(e?.message || '加载分享内容失败')
        setData(null)
      } finally {
        if (alive) setLoading(false)
      }
    }
    if (code) fetchShared()
    else {
      setError('分享链接无效')
      setLoading(false)
    }
    return () => {
      alive = false
    }
  }, [code])

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin tip={translate('visible.a826e787c0')} size="large" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <Result
        status="404"
        title={translate('auto.08224d52f1')}
        subTitle={error || translate('visible.bf2e94aad7')}
        extra={
          <Space>
            <Button onClick={() => navigate(-1)}>{translate('app.back')}</Button>
            <Button type="primary" href={withAppBasePath('/login')}>
              {translate('auto.6da511835b')}</Button>
          </Space>
        }
      />
    )
  }

  const { favorite, items, owner } = data
  const ownerName = owner?.nickname || owner?.username || '未知用户'

  return (
    <div style={{ maxWidth: 960, margin: '32px auto', padding: '0 16px' }}>
      <Card style={{ marginBottom: 24 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Title level={3} style={{ marginBottom: 8 }}>
              {favorite.name || translate('visible.4bd0d35948')}
            </Title>
            <Text type="secondary">{translate('auto.2b86dd4507')}{ownerName} {translate('auto.7a92434114')}</Text>
          </div>
          {favorite.description && <Paragraph>{favorite.description}</Paragraph>}
          {favorite.category_name && (
            <Tag color={favorite.category_color || 'blue'}>{favorite.category_name}</Tag>
          )}
        </Space>
      </Card>

      <Card title={translate('auto.00f82aeb03')}>
        {items.length === 0 ? (
          <Empty description={translate('auto.ea5f648da5')} />
        ) : (
          <List
            itemLayout="vertical"
            dataSource={items}
            renderItem={item => (
              <List.Item key={item.id}>
                <List.Item.Meta
                  title={
                    <Space size="small">
                      <Text strong>{(item as any).title || `收藏项 #${item.item_id}`}</Text>
                      <Tag>{item.item_type}</Tag>
                    </Space>
                  }
                  description={(item as any).description || `目标 ID：${item.item_id}`}
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  )
}
