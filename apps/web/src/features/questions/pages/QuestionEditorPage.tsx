// features/questions/pages/QuestionEditorPage.tsx
import { Button, Card, Col, Divider, Form, Input, Row, Select, Typography, Checkbox, Space } from 'antd'
import { useQuestionEditor } from '../../../shared/hooks/useQuestionEditor'
import KnowledgePointsField from '../components/KnowledgePointsField'
import QuestionHeader from '../components/QuestionHeader'
import { ShortAnswerEditor } from '../components/TrueFalseEditor'
import TagsField from '../components/TagsField'
import { TrueFalseEditor } from '../components/TrueFalseEditor'
import { translate } from '@/shared/utils/i18n'
const { TextArea } = Input
const { Title, Text } = Typography
const { Option } = Select

export default function QuestionEditorPage() {
  const {
    mode,
    isView,
    isEdit,
    initialLoading,
    loading,
    content,
    setContent,
    type,
    setType,
    options,
    addOption,
    removeOption,
    changeOption,
    answer,
    setAnswer,
    explanation,
    setExplanation,
    knowledgePoints,
    setKnowledgePoints,
    tags,
    setTags,
    allTags,
    submit,
  } = useQuestionEditor()

  const pageTitle = isView ? '查看题目' : isEdit ? '编辑题目' : '创建新题目'
  const pageDesc = isView ? '查看题目详细信息' : isEdit ? '修改现有题目信息' : '添加新的考试题目到题库'

  if (initialLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="flex justify-center items-center min-h-[300px]">
          <span>{translate('auto.300ee3dee4')}</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <Card style={{ marginBottom: 24 }}>
        <QuestionHeader title={pageTitle} desc={pageDesc} onBack={() => history.back()} />
      </Card>

      <Card>
        <Form layout="vertical" onFinish={isView ? undefined : submit} disabled={isView}>
          <Row gutter={[24, 16]}>
            <Col xs={24} md={12}>
              <Form.Item label={translate('questions.col_type')} required>
                <Select value={type} onChange={v => setType(v as any)} disabled={isView}>
                  <Option value="single_choice">{translate('questions.single_choice')}</Option>
                  <Option value="multiple_choice">{translate('questions.multiple_choice')}</Option>
                  <Option value="true_false">{translate('questions.judge')}</Option>
                  <Option value="short_answer">{translate('questions.type_short')}</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label={translate('questions.col_content')} required>
            <TextArea rows={4} value={content} onChange={e => setContent(e.target.value)} disabled={isView} />
          </Form.Item>

          {(type === 'single_choice' || type === 'multiple_choice') && (
            <Form.Item label={<Text strong>{translate('auto.45012422d4')}</Text>}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {options.map((opt, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8 }}>
                    <Checkbox
                      checked={!!opt.is_correct}
                      disabled={isView}
                      onChange={e => changeOption(idx, { is_correct: e.target.checked })}
                      style={{ marginTop: 6 }}
                    />
                    <Input
                      placeholder={`选项 ${idx + 1}`}
                      value={opt.content}
                      disabled={isView}
                      onChange={e => changeOption(idx, { content: e.target.value })}
                    />
                    {!isView && (
                      <Button danger onClick={() => removeOption(idx)}>
                        {translate('app.delete')}</Button>
                    )}
                  </div>
                ))}
                {!isView && (
                  <Button type="dashed" onClick={addOption} style={{ width: 160 }}>
                    {translate('auto.1a74b6f38d')}</Button>
                )}
              </Space>
            </Form.Item>
          )}

          {type === 'true_false' && (
            <Form.Item label={translate('questions.correct_answer')} required>
              <TrueFalseEditor value={answer} onChange={setAnswer} disabled={isView} />
            </Form.Item>
          )}

          {type === 'short_answer' && (
            <Form.Item label={translate('questions.ref_answer')} required>
              <ShortAnswerEditor value={answer} onChange={setAnswer} disabled={isView} />
            </Form.Item>
          )}

          <Form.Item label={translate('aiAssistant.action.explain_question')}>
            <TextArea rows={4} value={explanation} onChange={e => setExplanation(e.target.value)} disabled={isView} />
          </Form.Item>

          <Form.Item label={translate('profile.knowledge_points')}>
            <KnowledgePointsField points={knowledgePoints} onChange={setKnowledgePoints} disabled={isView} />
          </Form.Item>

          <Form.Item label={translate('questions.tags_label')}>
            <TagsField value={tags} all={allTags} onChange={setTags} readonly={isView} />
          </Form.Item>

          <Divider />
          <Row justify="end">
            <Button onClick={() => history.back()} style={{ marginRight: 8 }}>
              {translate('app.back')}</Button>
            {!isView && (
              <Button type="primary" htmlType="submit" loading={loading}>
                {isEdit ? translate('questions.update_btn') : translate('questions.create_btn')}
              </Button>
            )}
          </Row>
        </Form>
      </Card>
    </div>
  )
}
