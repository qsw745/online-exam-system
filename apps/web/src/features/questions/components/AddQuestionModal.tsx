// src/features/questions/components/AddQuestionModal.tsx
import React, { useMemo, useState } from 'react'
import { Modal, Form, Input, Radio, Select, Divider, message } from 'antd'
import { questionsApi } from '@/shared/api/http'
import OptionsEditor from './OptionsEditor'
import TagsField from './TagsField'
import KnowledgePointsField from './KnowledgePointsField'
import { compactObject } from '@/shared/utils/q-helpers'

type QType = 'single_choice' | 'multiple_choice' | 'true_false' | 'short_answer'

export default function AddQuestionModal({
  open,
  onClose,
  onSaved,
  allTags,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  allTags: string[]
}) {
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const typ: QType = Form.useWatch('question_type', form) || 'single_choice'
  const options = Form.useWatch('options', form) || []

  const isChoice = typ === 'single_choice' || typ === 'multiple_choice'

  const typeTitle = useMemo(
    () =>
      ({
        single_choice: '单选题',
        multiple_choice: '多选题',
        true_false: '判断题',
        short_answer: '简答题',
      }[typ]),
    [typ]
  )

  const submit = async () => {
    try {
      const v = await form.validateFields()
      setSubmitting(true)

      // 组装 payload
      let payload: any = {
        content: String(v.content || '').trim(),
        question_type: v.question_type,
        difficulty: v.difficulty,
        score: Number(v.score) || 1,
        explanation: v.explanation?.trim(),
        tags: v.tags ?? [],
        knowledge_points: v.knowledge_points ?? [],
      }

      if (isChoice) {
        const opts = (v.options || [])
          .map((o: any) => ({ content: String(o?.content || '').trim(), is_correct: !!o?.is_correct }))
          .filter((o: any) => o.content)

        if (opts.length < 2) throw new Error('选择题至少需要 2 个选项')
        if (!opts.some((o: any) => o.is_correct)) throw new Error('请选择至少 1 个正确答案')

        payload.options = opts
        payload.correct_answer = opts
          .map((o: any, i: number) => (o.is_correct ? String.fromCharCode(65 + i) : ''))
          .filter(Boolean)
          .join(',')
      } else if (typ === 'true_false') {
        payload.correct_answer = v.tfAnswer // 'true' | 'false'
      } else if (typ === 'short_answer') {
        if (!v.shortAnswer || !String(v.shortAnswer).trim()) throw new Error('请填写参考答案')
        payload.correct_answer = String(v.shortAnswer).trim()
      }

      payload = compactObject(payload)

      const r = await questionsApi.create(payload)
      if ((r as any)?.success) {
        message.success('新增题目成功')
        onSaved()
      } else {
        message.error((r as any)?.error || '新增题目失败')
      }
    } catch (e: any) {
      if (e?.errorFields) return // antd 表单校验
      message.error(e?.message || '新增题目失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={`新增题目（${typeTitle}）`}
      open={open}
      onCancel={onClose}
      onOk={submit}
      confirmLoading={submitting}
      okText="保存"
      /** antd v5: 使用 destroyOnHidden 代替 destroyOnClose */
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          question_type: 'single_choice',
          difficulty: 'medium',
          score: 1,
          options: [{ content: '' }, { content: '' }],
          tfAnswer: 'true',
        }}
      >
        <Form.Item name="question_type" label="题目类型" rules={[{ required: true }]}>
          <Select
            options={[
              { label: '单选题', value: 'single_choice' },
              { label: '多选题', value: 'multiple_choice' },
              { label: '判断题', value: 'true_false' },
              { label: '简答题', value: 'short_answer' },
            ]}
          />
        </Form.Item>

        <Form.Item name="content" label="题目内容" rules={[{ required: true, message: '请输入题目内容' }]}>
          <Input.TextArea rows={4} placeholder="请输入题干" />
        </Form.Item>

        <Form.Item label="难度 / 分值" required style={{ marginBottom: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="difficulty" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
              <Select
                options={[
                  { label: '容易', value: 'easy' },
                  { label: '中等', value: 'medium' },
                  { label: '困难', value: 'hard' },
                ]}
              />
            </Form.Item>
            <Form.Item name="score" rules={[{ required: true, message: '请输入分值' }]} style={{ marginBottom: 0 }}>
              <Input type="number" min={0} step={1} placeholder="分值" />
            </Form.Item>
          </div>
        </Form.Item>

        {isChoice && (
          <>
            <Divider style={{ margin: '8px 0' }}>选项与答案</Divider>
            <Form.Item shouldUpdate noStyle>
              {() => (
                <OptionsEditor
                  options={options}
                  onChange={(index, patch) => {
                    const next = [...options]
                    next[index] = { ...next[index], ...patch }
                    form.setFieldsValue({ options: next })
                  }}
                  onAdd={() => form.setFieldsValue({ options: [...options, { content: '' }] })}
                  onRemove={i => {
                    const next = options.filter((_: any, idx: number) => idx !== i)
                    form.setFieldsValue({ options: next })
                  }}
                />
              )}
            </Form.Item>
          </>
        )}

        {typ === 'true_false' && (
          <Form.Item name="tfAnswer" label="正确答案" rules={[{ required: true }]}>
            <Radio.Group>
              <Radio value="true">正确</Radio>
              <Radio value="false">错误</Radio>
            </Radio.Group>
          </Form.Item>
        )}

        {typ === 'short_answer' && (
          <Form.Item name="shortAnswer" label="参考答案" rules={[{ required: true, message: '请填写参考答案' }]}>
            <Input.TextArea rows={3} placeholder="请填写参考答案" />
          </Form.Item>
        )}

        <Form.Item name="explanation" label="解析">
          <Input.TextArea rows={3} placeholder="可选" />
        </Form.Item>

        <Form.Item label="知识点 / 标签" style={{ marginBottom: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="knowledge_points" style={{ marginBottom: 0 }}>
              <KnowledgePointsField
                points={Form.useWatch('knowledge_points', form) || []}
                onChange={v => form.setFieldsValue({ knowledge_points: v })}
              />
            </Form.Item>
            <Form.Item name="tags" style={{ marginBottom: 0 }}>
              <TagsField
                value={Form.useWatch('tags', form) || []}
                onChange={v => form.setFieldsValue({ tags: v })}
                all={allTags}
              />
            </Form.Item>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  )
}
