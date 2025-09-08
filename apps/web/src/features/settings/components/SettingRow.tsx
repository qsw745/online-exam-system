import { Row, Col, Space, Typography } from 'antd'
import React from 'react'

const { Text } = Typography

export const SettingRow: React.FC<{
  icon: React.ReactNode
  label: React.ReactNode
  control: React.ReactNode
}> = ({ icon, label, control }) => (
  <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
    <Col>
      <Space>
        {icon}
        <Text>{label}</Text>
      </Space>
    </Col>
    <Col>{control}</Col>
  </Row>
)
