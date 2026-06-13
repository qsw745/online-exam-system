// features/questions/pages/QuestionEditorPage.tsx
import { Button, Card, Col, Divider, Form, Input, Row, Select, Typography, Checkbox, Space } from 'antd'
import { useQuestionEditor } from '../../../shared/hooks/useQuestionEditor'
import KnowledgePointsField from '../components/KnowledgePointsField'
import QuestionHeader from '../components/QuestionHeader'
import { ShortAnswerEditor } from '../components/TrueFalseEditor'
import TagsField from '../components/TagsField'
import { TrueFalseEditor } from '../components/TrueFalseEditor'
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
          <span>加载中…</span>
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
              <Form.Item label="题目类型" required>
                <Select value={type} onChange={v => setType(v as any)} disabled={isView}>
                  <Option value="single_choice">单选题</Option>
                  <Option value="multiple_choice">多选题</Option>
                  <Option value="true_false">判断题</Option>
                  <Option value="short_answer">简答题</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="题目内容" required>
            <TextArea rows={4} value={content} onChange={e => setContent(e.target.value)} disabled={isView} />
          </Form.Item>

          {(type === 'single_choice' || type === 'multiple_choice') && (
            <Form.Item label={<Text strong>选项 *</Text>}>
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
                        删除
                      </Button>
                    )}
                  </div>
                ))}
                {!isView && (
                  <Button type="dashed" onClick={addOption} style={{ width: 160 }}>
                    新增选项
                  </Button>
                )}
              </Space>
            </Form.Item>
          )}

          {type === 'true_false' && (
            <Form.Item label="正确答案" required>
              <TrueFalseEditor value={answer} onChange={setAnswer} disabled={isView} />
            </Form.Item>
          )}

          {type === 'short_answer' && (
            <Form.Item label="参考答案" required>
              <ShortAnswerEditor value={answer} onChange={setAnswer} disabled={isView} />
            </Form.Item>
          )}

          <Form.Item label="题目解析">
            <TextArea rows={4} value={explanation} onChange={e => setExplanation(e.target.value)} disabled={isView} />
          </Form.Item>

          <Form.Item label="知识点">
            <KnowledgePointsField points={knowledgePoints} onChange={setKnowledgePoints} disabled={isView} />
          </Form.Item>

          <Form.Item label="标签（可多选/自定义）">
            <TagsField value={tags} all={allTags} onChange={setTags} readonly={isView} />
          </Form.Item>

          <Divider />
          <Row justify="end">
            <Button onClick={() => history.back()} style={{ marginRight: 8 }}>
              返回
            </Button>
            {!isView && (
              <Button type="primary" htmlType="submit" loading={loading}>
                {isEdit ? '更新题目' : '创建题目'}
              </Button>
            )}
          </Row>
        </Form>
      </Card>
    </div>
  )
}
