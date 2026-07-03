// features/tasks/components/PublishTaskForm.tsx
import { DatePicker, Form, Input, Radio, Select, Space, Button } from 'antd'
import dayjs from '@/shared/utils/dayjs'
import React from 'react'
import { translate } from '@/shared/utils/i18n'

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
          return form.setFields([{ name: 'end_time', errors: [translate('taskForm.validation.end_after_start')] }])
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
      <Form.Item name="title" label={translate('auto.6eae640bc4')} rules={[{ required: true, message: translate('auto.edd729f7f2') }, { max: 80 }]}>
        <Input placeholder={translate('auto.6d2355a6e9')} />
      </Form.Item>

      <Form.Item name="description" label={translate('auto.5c0193ae42')} rules={[{ max: 500 }]}>
        <Input.TextArea rows={3} placeholder={translate('auto.e36bd12007')} />
      </Form.Item>

      <Space size="large" wrap>
        <Form.Item name="type" label={translate('auto.4a6f4156fc')} initialValue="exam">
          <Radio.Group>
            <Radio.Button value="exam">{translate('nav.exams')}</Radio.Button>
            <Radio.Button value="practice">{translate('menus.exam-practice')}</Radio.Button>
          </Radio.Group>
        </Form.Item>

        <Form.Item name="start_time" label={translate('dashboard.start_time')} rules={[{ required: true, message: translate('auto.96870563bb') }]}>
          <DatePicker showTime />
        </Form.Item>

        <Form.Item name="end_time" label={translate('auto.a0bb9f49ab')} rules={[{ required: true, message: translate('auto.53579ed9bf') }]}>
          <DatePicker showTime />
        </Form.Item>
      </Space>

      <Form.Item name="assignees" label={translate('auto.73486c2813')}>
        <Select
          mode="multiple"
          allowClear
          placeholder={translate('auto.2bbfd02e22')}
          options={usersForSelect}
          maxTagCount="responsive"
        />
      </Form.Item>

      <Space>
        <Button type="primary" htmlType="submit" loading={loading}>
          {translate('auto.94f172d02f')}</Button>
        <Button onClick={() => form.resetFields()}>{translate('auto.84fcd70d42')}</Button>
      </Space>
    </Form>
  )
}
