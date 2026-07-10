// apps/web/src/features/exams/components/ResultDetailView.tsx
import { Card, Descriptions, Space, Tag, Typography, Button, List, Divider, message } from 'antd'
import { useEffect, useState } from 'react'
import type { ResultDetail } from '@/shared/api/endpoints/results'
import { aiApi } from '@/shared/api/endpoints/ai'
import { proctoringApi, type ProctoringList } from '@/shared/api/endpoints/proctoring'
import { translate } from '@/shared/utils/i18n'
import { formatDateTime } from '@/shared/utils/datetime'
import { printHtml, escapeHtml, optionLetter } from '@/shared/utils/print'

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
  if (value == null || value === '') return <Text type="secondary">{translate('auto.1516d7b39e')}</Text>

  if (type === 'true_false') {
    const b = asBool(value)
    return <Text>{b === null ? String(value) : b ? translate('questions.tf_true') : translate('questions.tf_false')}</Text>
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
  const [proctoring, setProctoring] = useState<ProctoringList | null>(null)
  const [proctorLoading, setProctorLoading] = useState(false)
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
      message.error(e?.message || translate('auto.7d6733f5b9'))
    } finally {
      setAiLoading(false)
    }
  }

  useEffect(() => {
    if (!data.exam_id) return
    let alive = true
    setProctorLoading(true)
    proctoringApi
      .listExamEvents(data.exam_id, { limit: 20 })
      .then(res => {
        if (alive) setProctoring(res)
      })
      .catch(() => {
        if (alive) setProctoring(null)
      })
      .finally(() => {
        if (alive) setProctorLoading(false)
      })
    return () => {
      alive = false
    }
  }, [data.exam_id])

  // 打印成绩单：成绩概要表 + 逐题作答与判定
  const handlePrintResult = () => {
    const answerText = (type: string, value: string | null, options: string[] | null): string => {
      if (value == null || value === '') return translate('auto.1516d7b39e')
      if (type === 'true_false') {
        const b = asBool(value)
        return b === null ? String(value) : b ? translate('questions.tf_true') : translate('questions.tf_false')
      }
      if (type === 'multiple_choice' || type === 'single_choice') {
        const letters = type === 'single_choice' ? toArray(value).slice(0, 1) : toArray(value)
        return formatOptionLettersToText(letters, options).join('，') || String(value)
      }
      return String(value)
    }
    const questions = [...(data.questions || [])].sort((a, b) => a.order - b.order)
    const correctCount = questions.filter(q => q.is_correct === 1).length
    const body = [
      `<h1>${escapeHtml(data.paper_title || translate('visible.701efbdcb5'))}</h1>`,
      `<div class="meta">`,
      `<span>${escapeHtml(translate('nav.results'))}：${escapeHtml(scoreLine)}</span>`,
      `<span>${escapeHtml(translate('auto.8dc159502e'))}：${data.percentage != null ? `${data.percentage}%` : '-'}</span>`,
      `<span>${escapeHtml(translate('results.print_correct_count'))}：${correctCount} / ${questions.length}</span>`,
      `</div>`,
      `<table><tbody>`,
      `<tr><th>${escapeHtml(translate('dashboard.start_time'))}</th><td>${escapeHtml(formatDateTime(data.start_time) || '-')}</td>`,
      `<th>${escapeHtml(translate('dashboard.submit_time'))}</th><td>${escapeHtml(formatDateTime(data.end_time) || '-')}</td></tr>`,
      `</tbody></table>`,
      `<div class="sec-title">${escapeHtml(translate('auto.76884ec560'))}</div>`,
      ...questions.map((q, idx) => {
        const ok = q.is_correct === 1
        const judge =
          q.is_correct == null
            ? `<span>${escapeHtml(translate('visible.565b60c565'))}</span>`
            : ok
              ? `<span class="ok">✓ ${escapeHtml(translate('questions.tf_true'))}</span>`
              : `<span class="bad">✗ ${escapeHtml(translate('questions.tf_false'))}</span>`
        const optHtml =
          Array.isArray(q.options) && q.options.length
            ? `<ul class="q-opts">${q.options.map((o, i) => `<li>${optionLetter(i)}. ${escapeHtml(o)}</li>`).join('')}</ul>`
            : ''
        return `<div class="q"><div class="q-head">Q${idx + 1}. (${escapeHtml(String(q.score))}分) ${escapeHtml(q.content || '')} ${judge}</div>${optHtml}<div class="q-ans">${escapeHtml(translate('auto.758722bee9'))}${escapeHtml(answerText(q.type, q.user_answer, q.options))}</div><div class="q-ans">${escapeHtml(translate('auto.b767475397'))}${escapeHtml(answerText(q.type, q.correct_answer, q.options))}</div></div>`
      }),
      `<div class="footer">${escapeHtml(formatDateTime(new Date()))}</div>`,
    ].join('')
    printHtml(data.paper_title || translate('results.print_report'), body)
  }

  const sevColor = (s: string) => (s === 'critical' ? 'error' : s === 'warn' ? 'warning' : 'default')
  const sevLabel = (s: string) => (s === 'critical' ? '严重' : s === 'warn' ? '警告' : '提示')
  const proctorSummary = proctoring?.summary ?? { total: 0, info: 0, warn: 0, critical: 0 }
  const proctorItems = proctoring?.items ?? []

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>
          {data.paper_title || translate('visible.701efbdcb5')}
        </Title>
        <Space>
          <Tag color={tagColor}>
            {uiStatus === 'completed' ? translate('dashboard.status_completed') : uiStatus === 'in_progress' ? translate('dashboard.status_in_progress') : translate('dashboard.status_not_started')}
          </Tag>
          <Button onClick={requestAiSummary} loading={aiLoading}>
            {translate('auto.3c756fd702')}</Button>
          <Button onClick={handlePrintResult}>{translate('results.print_report')}</Button>
          {onBack && <Button onClick={onBack}>{translate('papers.back_to_list')}</Button>}
        </Space>
      </div>

      <Card>
        <Descriptions column={3} bordered size="middle">
          <Descriptions.Item label={translate('nav.results')}>{scoreLine}</Descriptions.Item>
          <Descriptions.Item label={translate('auto.8dc159502e')}>{data.percentage != null ? `${data.percentage}%` : '-'}</Descriptions.Item>
          <Descriptions.Item label={translate('auto.c581cec042')}>{data.duration ?? '-'}</Descriptions.Item>
          <Descriptions.Item label={translate('dashboard.start_time')}>{formatDateTime(data.start_time) || '-'}</Descriptions.Item>
          <Descriptions.Item label={translate('dashboard.submit_time')}>{formatDateTime(data.end_time) || '-'}</Descriptions.Item>
          <Descriptions.Item label={translate('auto.2514f93ebe')}>{data.exam_id ?? '-'}</Descriptions.Item>
          <Descriptions.Item label={translate('auto.5cfe3f239d')} span={2}>
            {data.paper_id ?? '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {aiSummary && (
        <Card title={translate('auto.3c756fd702')}>
          {'summary' in aiSummary && <Paragraph>{aiSummary.summary}</Paragraph>}
          {strengths.length > 0 && (
            <>
              <Text strong>{translate('auto.16f102ba76')}</Text>
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
              <Text strong>{translate('auto.965ee9c852')}</Text>
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
              <Text strong>{translate('auto.025837508a')}</Text>
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

      <Card title={translate('auto.a5311752db')}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Space wrap>
            <Tag>{translate('auto.3af1ac5b4e')}{proctorSummary.total}</Tag>
            <Tag color="warning">{translate('auto.5521e368d8')}{proctorSummary.warn}</Tag>
            <Tag color="error">{translate('auto.81ffc6f5a4')}{proctorSummary.critical}</Tag>
            <Tag color="default">{translate('auto.ab3656a956')}{proctorSummary.info}</Tag>
          </Space>
          {proctorLoading ? (
            <Text type="secondary">{translate('app.loading')}</Text>
          ) : proctorItems.length > 0 ? (
            <List
              size="small"
              dataSource={proctorItems.slice(0, 8)}
              renderItem={item => (
                <List.Item>
                  <Space>
                    <Tag color={sevColor(item.severity)}>{sevLabel(item.severity)}</Tag>
                    <Text>{item.message || item.type}</Text>
                    <Text type="secondary">{formatDateTime(item.created_at)}</Text>
                  </Space>
                </List.Item>
              )}
            />
          ) : (
            <Text type="secondary">{translate('auto.378c7e490d')}</Text>
          )}
        </Space>
      </Card>

      <Card title={translate('auto.76884ec560')}>
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
                    <Tag color={color}>{ok ? translate('questions.tf_true') : q.is_correct == null ? translate('visible.565b60c565') : translate('questions.tf_false')}</Tag>
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
                    <Text type="secondary">{translate('auto.758722bee9')}</Text> {renderAnswerByType(q.type, q.user_answer, q.options)}
                  </div>
                  <div>
                    <Text type="secondary">{translate('auto.b767475397')}</Text> {renderAnswerByType(q.type, q.correct_answer, q.options)}
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
