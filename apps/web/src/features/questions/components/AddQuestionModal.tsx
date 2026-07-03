import React, { useMemo } from 'react'
import { Select, Radio } from 'antd'
import { Modal, Form, useNotice } from '@/shared/components/ui'
import OptionsEditor, { ChoiceMode } from './OptionsEditor'
import { questions as questionsApi } from '@/shared/api/endpoints/questions'
import { useLanguage } from '@/shared/contexts/LanguageContext'

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
  const { t } = useLanguage()

  const typ: QType = Form.useWatch('question_type', form) || 'single_choice'
  const mode: ChoiceMode = typ === 'multiple_choice' ? 'multiple' : 'single'
  const isChoice = typ === 'single_choice' || typ === 'multiple_choice'

  const typeTitle = useMemo(
    () => ({ single_choice: t('questions.type_single'), multiple_choice: t('questions.type_multiple'), true_false: t('questions.type_true_false'), short_answer: t('questions.type_short') }[typ]),
    [typ, t]
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
        if (opts.length < 2) throw new Error(t('questions.err_min_options'))
        const correctCnt = opts.filter((o: any) => o.is_correct).length
        if (correctCnt === 0) throw new Error(t('questions.err_no_correct'))
        if (typ === 'single_choice' && correctCnt > 1) throw new Error(t('questions.err_single_one'))
        base.options = opts
        base.correct_answer = opts
          .map((o: any, i: number) => (o.is_correct ? String.fromCharCode(65 + i) : ''))
          .filter(Boolean)
          .join(',')
      } else if (typ === 'true_false') {
        base.correct_answer = v.tfAnswer // 'true' | 'false'
      } else if (typ === 'short_answer') {
        const ans = (v.shortAnswer || '').trim()
        if (!ans) throw new Error(t('questions.ref_answer_ph'))
        base.correct_answer = ans
      }

      const r: any = await questionsApi.create(base)
      if (r?.success) {
        notice.success(t('questions.add_success'))
        onSaved?.()
      } else {
        throw new Error(r?.error || r?.message || t('questions.add_failed'))
      }
    } catch (e: any) {
      if (e?.errorFields) return // antd 校验
      notice.error(e?.message || t('questions.add_failed'))
    }
  }

  return (
    <Modal
      title={t('questions.add_title').replace('{type}', typeTitle)}
      open={open}
      maskClosable={false}
      onCancel={onClose}
      onOk={submit}
      okText={t('app.save')}
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
        <Form.Item name="question_type" label={t('questions.col_type')} rules={[{ required: true }]}>
          <Select
            options={[
              { label: t('questions.type_single'), value: 'single_choice' },
              { label: t('questions.type_multiple'), value: 'multiple_choice' },
              { label: t('questions.type_true_false'), value: 'true_false' },
              { label: t('questions.type_short'), value: 'short_answer' },
            ]}
          />
        </Form.Item>

        <Form.Item name="content" label={t('questions.field_content')} rules={[{ required: true, message: t('questions.field_content_required') }]}>
          <Form.Input.TextArea rows={4} placeholder={t('questions.field_content_ph')} />
        </Form.Item>

        <Form.Item label={t('questions.field_difficulty_score')} required style={{ marginBottom: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="difficulty" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
              <Select
                options={[
                  { label: t('questions.diff_easy'), value: 'easy' },
                  { label: t('questions.diff_medium'), value: 'medium' },
                  { label: t('questions.diff_hard'), value: 'hard' },
                ]}
              />
            </Form.Item>
            <Form.Item name="score" rules={[{ required: true, message: t('questions.field_score_required') }]} style={{ marginBottom: 0 }}>
              <Form.Input type="number" min={0} step={1} placeholder={t('questions.field_score')} />
            </Form.Item>
          </div>
        </Form.Item>

        {isChoice && (
          <>
            <Form.Divider style={{ margin: '12px 0' }}>{t('questions.options_answers')}</Form.Divider>
            <OptionsEditor mode={mode} />
          </>
        )}

        {typ === 'true_false' && (
          <Form.Item name="tfAnswer" label={t('questions.correct_answer')} rules={[{ required: true }]}>
            <Radio.Group>
              <Radio value="true">{t('questions.tf_true')}</Radio>
              <Radio value="false">{t('questions.tf_false')}</Radio>
            </Radio.Group>
          </Form.Item>
        )}

        {typ === 'short_answer' && (
          <Form.Item name="shortAnswer" label={t('questions.ref_answer')} rules={[{ required: true, message: t('questions.ref_answer_ph') }]}>
            <Form.Input.TextArea rows={3} placeholder={t('questions.ref_answer_ph')} />
          </Form.Item>
        )}

        <Form.Item name="explanation" label={t('questions.explanation')}>
          <Form.Input.TextArea rows={3} placeholder={t('questions.optional')} />
        </Form.Item>

        <Form.Item label={t('questions.knowledge_tags_source')} style={{ marginBottom: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Form.Item name="knowledge_points" style={{ marginBottom: 0 }}>
              <Select mode="multiple" allowClear placeholder={t('questions.select_knowledge')} options={[]} />
            </Form.Item>
            <Form.Item name="tags" style={{ marginBottom: 0 }}>
              <Select
                mode="tags"
                allowClear
                placeholder={t('questions.select_create_tag')}
                options={(allTags || []).map(t => ({ label: t, value: t }))}
              />
            </Form.Item>
            <Form.Item name="source" style={{ marginBottom: 0 }}>
              <Form.Input placeholder={t('questions.source_ph')} />
            </Form.Item>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  )
}
