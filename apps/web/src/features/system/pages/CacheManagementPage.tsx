import { useCallback, useEffect, useState } from 'react'
import { App, Button, Card, Descriptions, Result, Space, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { cacheApi } from '@/shared/api/endpoints/cache'

const { Title, Text } = Typography

type CacheStats = Awaited<ReturnType<typeof cacheApi.stats>>

export default function CacheManagementPage() {
  const { message } = App.useApp()
  const [stats, setStats] = useState<CacheStats | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    try {
      const data = await cacheApi.stats()
      setStats(data)
    } catch (e: any) {
      message.error(e?.message || '加载缓存信息失败')
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const handleFlush = async () => {
    try {
      await cacheApi.flush()
      message.success('缓存已清空')
      fetchStats()
    } catch (e: any) {
      message.error(e?.message || '清空失败')
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <Space style={{ width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div>
            <Title level={4} style={{ marginBottom: 0 }}>
              缓存管理
            </Title>
            <Text type="secondary">查看 Redis 运行情况并执行清理</Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchStats} />
            <Button danger onClick={handleFlush}>
              清空缓存
            </Button>
          </Space>
        </Space>
      </Card>

      <Card loading={loading}>
        {stats?.connected ? (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="版本">{stats.version || '-'}</Descriptions.Item>
            <Descriptions.Item label="运行时间">
              {stats.uptimeHuman || (stats.uptimeSeconds ? `${stats.uptimeSeconds}s` : stats.uptime || '-')}
            </Descriptions.Item>
            <Descriptions.Item label="占用内存">{stats.memoryUsed || '-'}</Descriptions.Item>
            <Descriptions.Item label="键空间">
              {stats.keysHuman || (typeof stats.keys === 'number' ? `${stats.keys.toLocaleString()} keys` : stats.keys || '-')}
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <Result status="warning" title="未连接缓存" subTitle="请检查 Redis 配置" />
        )}
      </Card>
    </Space>
  )
}
