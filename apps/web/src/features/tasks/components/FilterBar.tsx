// features/tasks/components/FilterBar.tsx
import { DatePicker, Form, Input, Select, Space, Button, Row, Col } from 'antd'
import React from 'react'
import type { TaskFilters } from '../hooks/useTasksQuery'

export const FilterBar: React.FC<{
  value: TaskFilters
  onSearch: (v: TaskFilters) => void
  onReset: () => void
}> = ({ value, onSearch, onReset }) => {
  const [form] = Form.useForm<TaskFilters>()
  return (
    <Form form={form} layout="vertical" initialValues={value} onFinish={vals => onSearch(vals)}>
      <Row gutter={16}>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Form.Item name="keyword" label="关键词">
            <Input allowClear placeholder="标题 / 描述 / 用户" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Form.Item name="status" label="状态" initialValue="all">
            <Select
              options={[
                { value: 'all', label: '全部' },
                { value: 'not_started', label: '待开始' },
                { value: 'in_progress', label: '进行中' },
                { value: 'completed', label: '已完成' },
                { value: 'expired', label: '已过期' },
                { value: 'published', label: '已发布' },
                { value: 'unpublished', label: '已下线' },
              ]}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={12} lg={12}>
          <Form.Item name="range" label="时间区间">
            <DatePicker.RangePicker showTime style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>
      <Space>
        <Button type="primary" htmlType="submit">
          查询
        </Button>
        <Button
          htmlType="button"
          onClick={() => {
            form.resetFields()
            onReset()
          }}
        >
          重置
        </Button>
      </Space>
    </Form>
  )
}
