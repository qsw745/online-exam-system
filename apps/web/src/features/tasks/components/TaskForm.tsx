import { DatePicker, Form, Input, Radio, Select, Space, TreeSelect, Button } from 'antd'
import dayjs from '@/shared/utils/dayjs'
import type { Dayjs } from 'dayjs'

import React, { useEffect } from 'react'
import { useUsersGroupedTree } from '../hooks/useUsersGroupedTree'
import { useDepartmentsTree } from '../hooks/useDepartmentsTree'
import { usePapersOptions } from '../hooks/usePapersOptions'
import { TASK_STATUS_OPTIONS } from '../constants/taskStatus'

export type TaskFormValues = {
  title: string
  description: string
  status: 'not_started' | 'in_progress' | 'completed' | 'expired' | 'published' | 'unpublished' | 'draft'
  type: 'practice' | 'exam'
  paper_id?: string | number
  exam_id?: string | number
  start_time?: Dayjs
  end_time?: Dayjs
  assigned_department_ids?: Array<string | number>
  assigned_user_ids?: Array<string | number>
}

export const TaskForm: React.FC<{
  readOnly?: boolean
  initial?: Partial<TaskFormValues>
  submitting?: boolean
  onSubmit: (payload: any) => void
}> = ({ readOnly, initial, submitting, onSubmit }) => {
  const [form] = Form.useForm<TaskFormValues>()
  const { loading: loadingUsers, treeData: userTree, reload: reloadUsers } = useUsersGroupedTree()
  const { loading: loadingDepts, treeData: deptTree, load: loadDepts } = useDepartmentsTree()
  const { loading: loadingPapers, options: paperOptions, load: loadPapers } = usePapersOptions()

  useEffect(() => {
    loadDepts()
    loadPapers()
    reloadUsers()
  }, [loadDepts, loadPapers, reloadUsers])

  useEffect(() => {
    if (!initial) return
    form.setFieldsValue({
      title: initial.title,
      description: initial.description,
      status: (initial.status as any) ?? 'not_started',
      type: (initial.type as any) || 'practice',
      paper_id:
        initial.paper_id != null
          ? typeof initial.paper_id === 'string'
            ? initial.paper_id
            : String(initial.paper_id)
          : undefined,
      exam_id:
        initial.exam_id != null
          ? typeof initial.exam_id === 'string'
            ? initial.exam_id
            : String(initial.exam_id)
          : undefined,
      start_time: initial.start_time ? dayjs(initial.start_time as any) : (dayjs() as any),
      end_time: initial.end_time ? dayjs(initial.end_time as any) : (dayjs().add(7, 'day') as any),
      assigned_user_ids: (initial.assigned_user_ids || []).map(String),
      assigned_department_ids: (initial.assigned_department_ids || []).map(String),
    } as any)
  }, [initial, form])

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        status: 'not_started',
        type: 'practice',
        start_time: dayjs(),
        end_time: dayjs().add(7, 'day'),
      }}
      onFinish={v => {
        if (v.end_time && v.start_time && v.end_time.isBefore(v.start_time)) {
          form.setFields([{ name: 'end_time', errors: ['结束时间需晚于开始时间'] }])
          return
        }
        const toNum = (x: any) => {
          if (x === null || x === undefined || x === '') return undefined
          const n = Number(x)
          return Number.isFinite(n) ? n : undefined
        }
        const toNumArr = (a: any) => (Array.isArray(a) ? a.map(id => Number(id)).filter(n => Number.isFinite(n)) : [])

        onSubmit({
          title: String(v.title || '').trim(),
          description: String(v.description || '').trim(),
          status: v.status,
          type: v.type,
          paper_id: v.type === 'exam' ? toNum(v.paper_id) : undefined,
          exam_id: v.type === 'exam' ? toNum(v.exam_id) : undefined,
          start_time: v.start_time?.format('YYYY-MM-DD HH:mm:ss'),
          end_time: v.end_time?.format('YYYY-MM-DD HH:mm:ss'),
          assigned_department_ids: toNumArr(v.assigned_department_ids),
          assigned_user_ids: toNumArr(v.assigned_user_ids),
        })
      }}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Space style={{ width: '100%' }} wrap>
          <Form.Item label="任务标题" name="title" rules={[{ required: true }, { max: 80 }]} style={{ minWidth: 320 }}>
            <Input disabled={readOnly} placeholder="输入任务标题" allowClear />
          </Form.Item>

          <Form.Item label="任务类型" name="type" style={{ minWidth: 200 }}>
            <Radio.Group disabled={readOnly}>
              <Radio.Button value="practice">练习</Radio.Button>
              <Radio.Button value="exam">考试</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item label="任务状态" name="status" style={{ minWidth: 220 }}>
            <Select disabled={readOnly} options={TASK_STATUS_OPTIONS} getPopupContainer={t => t.parentElement!} />
          </Form.Item>

          <Form.Item shouldUpdate={(p, c) => p.type !== c.type} noStyle>
            {({ getFieldValue }) =>
              getFieldValue('type') === 'exam' && (
                <>
                  <Form.Item
                    label="选择试卷"
                    name="paper_id"
                    style={{ minWidth: 280 }}
                    rules={[{ required: true, message: '请选择试卷' }]}
                  >
                    <Select
                      showSearch
                      optionFilterProp="label"
                      placeholder={loadingPapers ? '加载试卷中…' : '请选择试卷'}
                      disabled={readOnly || loadingPapers}
                      options={paperOptions}
                      allowClear
                      getPopupContainer={t => t.parentElement!}
                    />
                  </Form.Item>

                  <Form.Item label="指定考试ID（可选）" name="exam_id" style={{ minWidth: 180 }}>
                    <Input disabled={readOnly} placeholder="有现成考试可指定" allowClear />
                  </Form.Item>
                </>
              )
            }
          </Form.Item>
        </Space>

        <Form.Item label="分配给部门（多选）" name="assigned_department_ids" tooltip="支持多选，父子节点均可选">
          <TreeSelect
            multiple
            treeCheckable
            showCheckedStrategy={TreeSelect.SHOW_PARENT}
            showSearch
            allowClear
            treeDefaultExpandAll
            treeNodeFilterProp="title"
            disabled={readOnly || loadingDepts}
            treeData={deptTree}
            placeholder={loadingDepts ? '加载部门中…' : '选择部门（可选）'}
            getPopupContainer={t => t.parentElement!}
          />
        </Form.Item>

        <Form.Item label="分配给用户（多选）" name="assigned_user_ids">
          <TreeSelect
            multiple
            treeCheckable
            showCheckedStrategy={TreeSelect.SHOW_CHILD}
            showSearch
            allowClear
            treeDefaultExpandAll
            treeNodeFilterProp="title"
            disabled={readOnly || loadingUsers}
            treeData={userTree}
            placeholder={loadingUsers ? '加载用户中…' : '选择用户（可选）'}
            getPopupContainer={t => t.parentElement!}
          />
        </Form.Item>

        <Form.Item label="任务描述" name="description" rules={[{ required: true }, { max: 500 }]}>
          <Input.TextArea rows={4} disabled={readOnly} showCount maxLength={500} />
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

export default TaskForm
