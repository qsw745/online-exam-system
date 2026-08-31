import { Alert, Segmented, Space, Typography } from 'antd'
import type { DataRegion } from '@/platform/region/accountRegion'

const { Text } = Typography

type Props = {
  value: DataRegion
  onChange: (region: DataRegion) => void
  disabled?: boolean
  compact?: boolean
}

export function AccountRegionField({ value, onChange, disabled, compact = false }: Props) {
  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      <Text strong={!compact}>账号与数据所在地区</Text>
      <Segmented
        block
        value={value}
        disabled={disabled}
        aria-label="账号与数据所在地区"
        options={[
          { label: '中国大陆', value: 'CN' },
          { label: '海外地区', value: 'GLOBAL' },
        ]}
        onChange={next => onChange(next as DataRegion)}
      />
      {!compact && (
        <Alert
          type="info"
          showIcon
          message={
            value === 'CN'
              ? '账号数据存放在中国大陆区域；注册后不可自行跨区迁移。'
              : '账号数据存放在海外区域；注册后不可自行跨区迁移。'
          }
        />
      )}
    </Space>
  )
}
