// features/questions/components/QuestionHeader.tsx
import { Button, Col, Row, Typography } from 'antd'
import { ArrowLeft } from 'lucide-react'
import React from 'react'
const { Title, Paragraph } = Typography

export default function QuestionHeader({ title, desc, onBack }: { title: string; desc: string; onBack: () => void }) {
  return (
    <Row justify="space-between" align="middle">
      <Col>
        <Title level={2} style={{ margin: 0 }}>
          {title}
        </Title>
        <Paragraph type="secondary" style={{ margin: '8px 0 0' }}>
          {desc}
        </Paragraph>
      </Col>
      <Col>
        <Button onClick={onBack} icon={<ArrowLeft style={{ width: 16, height: 16 }} />}>
          返回题目列表
        </Button>
      </Col>
    </Row>
  )
}
