import { useCallback, useEffect, useState } from 'react'
import { App, Button, Card, Descriptions, Result, Space, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { cacheApi } from '@/shared/api/endpoints/cache'
import { translate } from '@/shared/utils/i18n'

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
      message.error(e?.message || translate('auto.ca402ea687'))
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
      message.success(translate('auto.c30877fb42'))
      fetchStats()
    } catch (e: any) {
      message.error(e?.message || translate('auto.640f1248bc'))
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <Space style={{ width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div>
            <Title level={4} style={{ marginBottom: 0 }}>
              {translate('menus.system-cache')}</Title>
            <Text type="secondary">{translate('auto.0213c52356')}</Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchStats} />
            <Button danger onClick={handleFlush}>
              {translate('auto.615609e144')}</Button>
          </Space>
        </Space>
      </Card>

      <Card loading={loading}>
        {stats?.connected ? (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label={translate('workflowTemplates.columns.version')}>{stats.version || '-'}</Descriptions.Item>
            <Descriptions.Item label={translate('auto.8b16a1fc0b')}>
              {stats.uptimeHuman || (stats.uptimeSeconds ? `${stats.uptimeSeconds}s` : stats.uptime || '-')}
            </Descriptions.Item>
            <Descriptions.Item label={translate('auto.2f2760567e')}>{stats.memoryUsed || '-'}</Descriptions.Item>
            <Descriptions.Item label={translate('auto.3568205fa0')}>
              {stats.keysHuman || (typeof stats.keys === 'number' ? `${stats.keys.toLocaleString()} keys` : stats.keys || '-')}
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <Result status="warning" title={translate('auto.1e928b082e')} subTitle={translate('visible.45fc7676b7')} />
        )}
      </Card>
    </Space>
  )
}
