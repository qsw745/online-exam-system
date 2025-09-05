// features/tasks/components/PublishTaskForm.tsx
import { DatePicker, Form, Input, Radio, Select, Space, Button } from 'antd'
import dayjs from 'dayjs'
import React from 'react'

export interface PublishForm {
  title: string
  description?: string
  type?: 'exam' | 'practice'
  start_time?: dayjs.Dayjs
  end_time?: dayjs.Dayjs
  assignees?: number[]
}

export const PublishTaskForm: React.FC<{
  usersForSelect: { label: string; value: number }[]
  loading: boolean
  onSubmit: (payload: any) => void
}> = ({ usersForSelect, loading, onSubmit }) => {
  const [form] = Form.useForm<PublishForm>()

  return (
    <Form<PublishForm>
      form={form}
      layout="vertical"
      onFinish={vals => {
        // 基本校验：结束时间不得早于开始时间
        if (vals.start_time && vals.end_time && vals.end_time.isBefore(vals.start_time)) {
          return form.setFields([{ name: 'end_time', errors: ['结束时间需晚于开始时间'] }])
        }
        onSubmit({
          title: vals.title,
          description: vals.description ?? '',
          type: vals.type ?? 'exam',
          start_time: vals.start_time?.toISOString(),
          end_time: vals.end_time?.toISOString(),
          assigned_user_ids: vals.assignees ?? [],
        })
      }}
    >
      <Form.Item name="title" label="任务标题" rules={[{ required: true, message: '请输入任务标题' }, { max: 80 }]}>
        <Input placeholder="例如：期中考试 - 数学（高一）" />
      </Form.Item>

      <Form.Item name="description" label="任务描述" rules={[{ max: 500 }]}>
        <Input.TextArea rows={3} placeholder="补充说明..." />
      </Form.Item>

      <Space size="large" wrap>
        <Form.Item name="type" label="任务类型" initialValue="exam">
          <Radio.Group>
            <Radio.Button value="exam">考试</Radio.Button>
            <Radio.Button value="practice">练习</Radio.Button>
          </Radio.Group>
        </Form.Item>

        <Form.Item name="start_time" label="开始时间" rules={[{ required: true, message: '请选择开始时间' }]}>
          <DatePicker showTime />
        </Form.Item>

        <Form.Item name="end_time" label="结束时间" rules={[{ required: true, message: '请选择结束时间' }]}>
          <DatePicker showTime />
        </Form.Item>
      </Space>

      <Form.Item name="assignees" label="指定用户（可选）">
        <Select
          mode="multiple"
          allowClear
          placeholder="不选表示走表格勾选"
          options={usersForSelect}
          maxTagCount="responsive"
        />
      </Form.Item>

      <Space>
        <Button type="primary" htmlType="submit" loading={loading}>
          发布
        </Button>
        <Button onClick={() => form.resetFields()}>清空</Button>
      </Space>
    </Form>
  )
}
