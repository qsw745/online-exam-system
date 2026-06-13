import React, { ReactNode } from 'react'
import { Card, Space, Statistic, Tooltip, Typography, Skeleton } from 'antd'
import { ArrowDownOutlined, ArrowUpOutlined, MinusOutlined, InfoCircleOutlined } from '@ant-design/icons'

const { Text } = Typography

export type Trend = 'up' | 'down' | 'flat'

export interface StatsCardProps {
  title: ReactNode
  value: number | string
  loading?: boolean
  precision?: number
  prefix?: ReactNode
  suffix?: ReactNode
  tooltip?: ReactNode
  /** 趋势箭头 */
  trend?: Trend
  /** 趋势值，如 +12% / -3 */
  trendValue?: ReactNode
  onClick?: () => void
}

function TrendIcon({ trend }: { trend?: Trend }) {
  if (trend === 'up') return <ArrowUpOutlined />
  if (trend === 'down') return <ArrowDownOutlined />
  return <MinusOutlined />
}

function StatsCard({
  title,
  value,
  loading,
  precision,
  prefix,
  suffix,
  tooltip,
  trend = 'flat',
  trendValue,
  onClick,
}: StatsCardProps) {
  return (
    <Card hoverable={!!onClick} onClick={onClick} bodyStyle={{ padding: 16 }}>
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Space align="center">
          <Text type="secondary">{title}</Text>
          {tooltip && (
            <Tooltip title={tooltip}>
              <InfoCircleOutlined />
            </Tooltip>
          )}
        </Space>

        {loading ? (
          <Skeleton active paragraph={false} />
        ) : (
          <Statistic value={value as any} precision={precision} prefix={prefix} suffix={suffix} />
        )}

        {trendValue !== undefined && (
          <Space size={8}>
            <TrendIcon trend={trend} />
            <Text type={trend === 'down' ? 'danger' : trend === 'up' ? 'success' : 'secondary'}>{trendValue}</Text>
          </Space>
        )}
      </Space>
    </Card>
  )
}

export default StatsCard
