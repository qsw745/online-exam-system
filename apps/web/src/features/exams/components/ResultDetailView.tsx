// apps/web/src/features/exams/components/ResultDetailView.tsx
import { Card, Descriptions, Space, Tag, Typography, Button, List, Divider, message } from 'antd'
import { useState } from 'react'
import type { ResultDetail } from '@/shared/api/endpoints/results'
import { aiApi } from '@/shared/api/endpoints/ai'

const { Title, Text, Paragraph } = Typography

// ---- helpers ----
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

function toArray(val?: string | null): string[] {
  if (!val) return []
  // "A,B" / "A, B" / '["A","C"]'
  try {
    const parsed = JSON.parse(val)
    if (Array.isArray(parsed)) return parsed.map(String)
  } catch {}
  return String(val)
    .split(/[,\s]+/g)
    .map(s => s.trim())
    .filter(Boolean)
}

function asBool(val: any): boolean | null {
  if (val === true) return true
  if (val === false) return false
  const s = String(val ?? '')
    .trim()
    .toLowerCase()
  if (!s) return null
  if (['true', 't', 'yes', 'y', '1', '是', '对', '正确'].includes(s)) return true
  if (['false', 'f', 'no', 'n', '0', '否', '错', '错误'].includes(s)) return false
  return null
}

function formatOptionLettersToText(letters: string[], options: string[] | null): string[] {
  if (!options?.length) return letters.map(l => l.toUpperCase())
  return letters.map(l => {
    const idx = LETTERS.indexOf(l.toUpperCase())
    const txt = options[idx]
    return txt ? `${l.toUpperCase()}. ${txt}` : l.toUpperCase()
  })
}

function renderAnswerByType(type: string, value: string | null, options: string[] | null) {
  if (value == null || value === '') return <Text type="secondary">未作答</Text>

  if (type === 'true_false') {
    const b = asBool(value)
    return <Text>{b === null ? String(value) : b ? '正确' : '错误'}</Text>
  }

  if (type === 'multiple_choice') {
    const letters = toArray(value)
    const shown = formatOptionLettersToText(letters, options)
    return <Text>{shown.join('，')}</Text>
  }

  if (type === 'single_choice') {
    const letters = toArray(value).slice(0, 1)
    const shown = formatOptionLettersToText(letters, options)
    return <Text>{shown[0] ?? String(value)}</Text>
  }

  // short_answer / fill_blank / other
  return <Text>{String(value)}</Text>
}

// ---- UI 状态 ----
type UiStatus = 'completed' | 'in_progress' | 'not_started'
const toUiStatus = (s: string): UiStatus => (s === 'submitted' || s === 'graded' ? 'completed' : (s as UiStatus))

type Props = { data: ResultDetail; onBack?: () => void }

export default function ResultDetailView({ data, onBack }: Props) {
  const uiStatus = toUiStatus(String(data.status))
  const tagColor = uiStatus === 'completed' ? 'success' : uiStatus === 'in_progress' ? 'warning' : 'default'
  const scoreLine = `${data.score} / ${data.total_score}`
  const [aiSummary, setAiSummary] = useState<any | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const strengths = Array.isArray(aiSummary?.strengths) ? aiSummary.strengths.map(String) : []
  const weaknesses = Array.isArray(aiSummary?.weaknesses) ? aiSummary.weaknesses.map(String) : []
  const nextSteps = Array.isArray(aiSummary?.next_steps) ? aiSummary.next_steps.map(String) : []

  const requestAiSummary = async () => {
    if (aiLoading) return
    setAiLoading(true)
    try {
      const questions = (data.questions || []).map(q => ({
        type: q.type,
        score: q.score,
        is_correct: q.is_correct,
      }))
      const wrong = (data.questions || [])
        .filter(q => q.is_correct === 0)
        .slice(0, 5)
        .map(q => ({
          type: q.type,
          content: String(q.content || '').slice(0, 200),
          correct_answer: q.correct_answer,
          user_answer: q.user_answer,
        }))
      const payload = {
        exam: {
          title: data.paper_title,
          exam_id: data.exam_id,
          paper_id: data.paper_id,
        },
        result: {
          score: data.score,
          total_score: data.total_score,
          percentage: data.percentage,
          duration: data.duration,
          status: data.status,
        },
        questions,
        wrong_questions: wrong,
      }
      const res: any = await aiApi.examSummary(payload)
      if (!res?.success) throw new Error(res?.error || 'AI 总结失败')
      const root = res?.data ?? {}
      const parsed = root?.data ?? root
      setAiSummary(parsed)
    } catch (e: any) {
      message.error(e?.message || 'AI 总结失败')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>
          {data.paper_title || '考试成绩详情'}
        </Title>
        <Space>
          <Tag color={tagColor}>
            {uiStatus === 'completed' ? '已完成' : uiStatus === 'in_progress' ? '进行中' : '未开始'}
          </Tag>
          <Button onClick={requestAiSummary} loading={aiLoading}>
            AI总结
          </Button>
          {onBack && <Button onClick={onBack}>返回列表</Button>}
        </Space>
      </div>

      <Card>
        <Descriptions column={3} bordered size="middle">
          <Descriptions.Item label="成绩">{scoreLine}</Descriptions.Item>
          <Descriptions.Item label="正确率">{data.percentage != null ? `${data.percentage}%` : '-'}</Descriptions.Item>
          <Descriptions.Item label="用时（秒）">{data.duration ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="开始时间">{data.start_time || '-'}</Descriptions.Item>
          <Descriptions.Item label="提交时间">{data.end_time || '-'}</Descriptions.Item>
          <Descriptions.Item label="考试ID">{data.exam_id ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="试卷ID" span={2}>
            {data.paper_id ?? '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {aiSummary && (
        <Card title="AI总结">
          {'summary' in aiSummary && <Paragraph>{aiSummary.summary}</Paragraph>}
          {strengths.length > 0 && (
            <>
              <Text strong>优势：</Text>
              <List<string>
                size="small"
                dataSource={strengths}
                renderItem={item => <List.Item>{item}</List.Item>}
              />
            </>
          )}
          {weaknesses.length > 0 && (
            <>
              <Divider style={{ margin: '12px 0' }} />
              <Text strong>薄弱点：</Text>
              <List<string>
                size="small"
                dataSource={weaknesses}
                renderItem={item => <List.Item>{item}</List.Item>}
              />
            </>
          )}
          {nextSteps.length > 0 && (
            <>
              <Divider style={{ margin: '12px 0' }} />
              <Text strong>建议：</Text>
              <List<string>
                size="small"
                dataSource={nextSteps}
                renderItem={item => <List.Item>{item}</List.Item>}
              />
            </>
          )}
          {!aiSummary?.summary && typeof aiSummary?.raw === 'string' && <Paragraph>{aiSummary.raw}</Paragraph>}
        </Card>
      )}

      <Card title="题目明细">
        <List
          itemLayout="vertical"
          dataSource={[...(data.questions || [])].sort((a, b) => a.order - b.order)}
          renderItem={(q, idx) => {
            const ok = q.is_correct === 1
            const color = q.is_correct == null ? 'default' : ok ? 'success' : 'error'
            return (
              <List.Item key={q.id}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Space align="start">
                    <Tag color={color}>{ok ? '正确' : q.is_correct == null ? '未判定' : '错误'}</Tag>
                    <Text strong>{`Q${idx + 1}. (${q.score}分) [${q.type}]`}</Text>
                  </Space>

                  <Paragraph style={{ marginBottom: 8 }}>{q.content}</Paragraph>

                  {Array.isArray(q.options) && q.options.length > 0 && (
                    <div style={{ paddingLeft: 12 }}>
                      {q.options.map((opt, i) => (
                        <div key={i}>
                          <Text type="secondary">{String.fromCharCode(65 + i)}.</Text> {opt}
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary">你的答案：</Text> {renderAnswerByType(q.type, q.user_answer, q.options)}
                  </div>
                  <div>
                    <Text type="secondary">正确答案：</Text> {renderAnswerByType(q.type, q.correct_answer, q.options)}
                  </div>

                  <Divider style={{ margin: '12px 0' }} />
                </Space>
              </List.Item>
            )
          }}
        />
      </Card>
    </Space>
  )
}
