import React, { useMemo } from 'react'
import { Select, Radio } from 'antd'
import { Modal, Form, useNotice } from '@/shared/components/ui'
import OptionsEditor, { ChoiceMode } from './OptionsEditor'
import { questions as questionsApi } from '@/shared/api/endpoints/questions'

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
  const notice = useNotice()

  const typ: QType = Form.useWatch('question_type', form) || 'single_choice'
  const mode: ChoiceMode = typ === 'multiple_choice' ? 'multiple' : 'single'
  const isChoice = typ === 'single_choice' || typ === 'multiple_choice'

  const typeTitle = useMemo(
    () => ({ single_choice: '单选题', multiple_choice: '多选题', true_false: '判断题', short_answer: '简答题' }[typ]),
    [typ]
  )

  const submit = async () => {
    try {
      const v = await form.validateFields()
      // 组装 payload
      const base: any = {
        content: String(v.content || '').trim(),
        question_type: v.question_type,
        difficulty: v.difficulty,
        score: Number(v.score) || 1,
        explanation: v.explanation?.trim() || undefined,
        tags: v.tags || [],
        knowledge_points: v.knowledge_points || [],
        source: v.source?.trim() || undefined,
      }

      if (isChoice) {
        const opts = (v.options || [])
          .map((o: any) => ({ content: String(o?.content || '').trim(), is_correct: !!o?.is_correct }))
          .filter((o: any) => o.content)
        if (opts.length < 2) throw new Error('选择题至少需要 2 个选项')
        const correctCnt = opts.filter((o: any) => o.is_correct).length
        if (correctCnt === 0) throw new Error('请选择至少 1 个正确答案')
        if (typ === 'single_choice' && correctCnt > 1) throw new Error('单选题只能有 1 个正确答案')
        base.options = opts
        base.correct_answer = opts
          .map((o: any, i: number) => (o.is_correct ? String.fromCharCode(65 + i) : ''))
          .filter(Boolean)
          .join(',')
      } else if (typ === 'true_false') {
        base.correct_answer = v.tfAnswer // 'true' | 'false'
      } else if (typ === 'short_answer') {
        const ans = (v.shortAnswer || '').trim()
        if (!ans) throw new Error('请填写参考答案')
        base.correct_answer = ans
      }

      const r: any = await questionsApi.create(base)
      if (r?.success) {
        notice.success('新增题目成功')
        onSaved?.()
      } else {
        throw new Error(r?.error || r?.message || '新增题目失败')
      }
    } catch (e: any) {
      if (e?.errorFields) return // antd 校验
      notice.error(e?.message || '新增题目失败')
    }
  }

  return (
    <Modal
      title={`新增题目（${typeTitle}）`}
      open={open}
      maskClosable={false}
      onCancel={onClose}
      onOk={submit}
      okText="保存"
      destroyOnHidden
    >
      <Form
        form={form}
        initialValues={{
          question_type: 'single_choice',
          difficulty: 'medium',
          score: 1,
          options: [
            { content: '', is_correct: false },
            { content: '', is_correct: false },
          ],
          tfAnswer: 'true',
          tags: [],
          knowledge_points: [],
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

        <Form.Item name="content" label="题干" rules={[{ required: true, message: '请输入题干' }]}>
          <Form.Input.TextArea rows={4} placeholder="请输入题干" />
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
              <Form.Input type="number" min={0} step={1} placeholder="分值" />
            </Form.Item>
          </div>
        </Form.Item>

        {isChoice && (
          <>
            <Form.Divider style={{ margin: '12px 0' }}>选项与答案</Form.Divider>
            <OptionsEditor mode={mode} />
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
            <Form.Input.TextArea rows={3} placeholder="请填写参考答案" />
          </Form.Item>
        )}

        <Form.Item name="explanation" label="解析">
          <Form.Input.TextArea rows={3} placeholder="可选" />
        </Form.Item>

        <Form.Item label="知识点 / 标签 / 来源" style={{ marginBottom: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Form.Item name="knowledge_points" style={{ marginBottom: 0 }}>
              <Select mode="multiple" allowClear placeholder="选择知识点" options={[]} />
            </Form.Item>
            <Form.Item name="tags" style={{ marginBottom: 0 }}>
              <Select
                mode="tags"
                allowClear
                placeholder="选择/创建标签"
                options={(allTags || []).map(t => ({ label: t, value: t }))}
              />
            </Form.Item>
            <Form.Item name="source" style={{ marginBottom: 0 }}>
              <Form.Input placeholder="题目来源（可选）" />
            </Form.Item>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  )
}
