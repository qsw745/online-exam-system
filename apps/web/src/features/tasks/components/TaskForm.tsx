// features/tasks/components/TaskForm.tsx
import { DatePicker, Form, Input, Radio, Select, Space, TreeSelect, Button } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import React from 'react'
import { useUsersGroupedTree } from '../hooks/useUsersGroupedTree'

export type TaskFormValues = {
  title: string
  description: string
  status: 'not_started' | 'in_progress' | 'completed' | 'expired'
  type: 'practice' | 'exam'
  exam_id?: string
  start_time: Dayjs
  end_time: Dayjs
  assigned_user_ids?: string[]
}

export const TaskForm: React.FC<{
  readOnly?: boolean
  initial?: Partial<TaskFormValues>
  submitting?: boolean
  onSubmit: (payload: any) => void
}> = ({ readOnly, initial, submitting, onSubmit }) => {
  const [form] = Form.useForm<TaskFormValues>()
  const { loading: loadingUsers, treeData } = useUsersGroupedTree()

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        status: 'not_started',
        type: 'practice',
        start_time: dayjs(),
        end_time: dayjs().add(7, 'day'),
        ...initial,
      }}
      onFinish={v => {
        if (v.end_time && v.start_time && v.end_time.isBefore(v.start_time)) {
          form.setFields([{ name: 'end_time', errors: ['结束时间需晚于开始时间'] }])
          return
        }
        onSubmit({
          title: v.title.trim(),
          description: v.description.trim(),
          status: v.status,
          type: v.type,
          exam_id: v.type === 'exam' ? v.exam_id || undefined : undefined,
          start_time: v.start_time.toISOString(),
          end_time: v.end_time.toISOString(),
          assigned_user_ids: v.assigned_user_ids?.map(id => Number(id)) ?? [],
        })
      }}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Space style={{ width: '100%' }} wrap>
          <Form.Item label="任务标题" name="title" rules={[{ required: true }, { max: 80 }]} style={{ minWidth: 320 }}>
            <Input disabled={readOnly} placeholder="输入任务标题" />
          </Form.Item>

          <Form.Item label="任务类型" name="type" style={{ minWidth: 200 }}>
            <Radio.Group disabled={readOnly}>
              <Radio.Button value="practice">练习</Radio.Button>
              <Radio.Button value="exam">考试</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item label="任务状态" name="status" style={{ minWidth: 200 }}>
            <Select disabled={readOnly}>
              <Select.Option value="not_started">待开始</Select.Option>
              <Select.Option value="in_progress">进行中</Select.Option>
              <Select.Option value="completed">已完成</Select.Option>
              <Select.Option value="expired">已过期</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item shouldUpdate={(p, c) => p.type !== c.type} noStyle>
            {({ getFieldValue }) =>
              getFieldValue('type') === 'exam' && (
                <Form.Item label="考试ID" name="exam_id" style={{ minWidth: 240 }}>
                  <Input disabled={readOnly} placeholder="仅考试类型需要填写" />
                </Form.Item>
              )
            }
          </Form.Item>
        </Space>

        <Form.Item label="分配给用户（多选）" name="assigned_user_ids">
          <TreeSelect
            multiple
            treeCheckable
            showCheckedStrategy={TreeSelect.SHOW_PARENT}
            showSearch
            disabled={readOnly || loadingUsers}
            treeData={treeData}
            filterTreeNode={(input, node) => String(node.title).toLowerCase().includes(String(input).toLowerCase())}
            placeholder="选择用户（留空可仅自己）"
          />
        </Form.Item>

        <Form.Item label="任务描述" name="description" rules={[{ required: true }, { max: 500 }]}>
          <Input.TextArea rows={4} disabled={readOnly} />
        </Form.Item>

        <Space wrap>
          <Form.Item label="开始时间" name="start_time" rules={[{ required: true }]}>
            <DatePicker showTime disabled={readOnly} />
          </Form.Item>
          <Form.Item label="结束时间" name="end_time" rules={[{ required: true }]}>
            <DatePicker showTime disabled={readOnly} />
          </Form.Item>
        </Space>

        {!readOnly && (
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button htmlType="reset">重置</Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              保存
            </Button>
          </Space>
        )}
      </Space>
    </Form>
  )
}
