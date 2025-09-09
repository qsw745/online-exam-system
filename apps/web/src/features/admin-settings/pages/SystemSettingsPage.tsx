// features/admin-settings/pages/AdminSettingsPage.tsx
import React from 'react'
import { Typography, Space, Row, Col } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import { useSettings } from '../hooks/useSettings'
import { SettingsForm } from '../components/SettingsForm'
import  SectionCard  from '@/shared/components/SectionCard'

const { Title, Text } = Typography

export default function AdminSettingsPage() {
  const { loading, initial, current, setCurrent, save, load, isDirty } = useSettings()

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>
          <SettingOutlined style={{ marginRight: 8 }} />
          系统设置
        </Title>
        <Text type="secondary">管理系统的基本配置和参数</Text>
      </div>

      <Row gutter={[24, 24]}>
        <Col span={24}>
          <SectionCard title="基本设置" loading={loading}>
            <SettingsForm
              value={current ?? undefined}
              loading={loading}
              onChange={setCurrent as any}
              onSubmit={async v => {
                await save(v)
              }}
              onReset={() => {
                if (initial) setCurrent(initial)
              }}
              disableSave={!isDirty}
            />
          </SectionCard>
        </Col>
      </Row>
    </div>
  )
}
