// apps/web/src/features/analytics/components/ResultDetailContent.tsx
import React from 'react'
import { Alert, Descriptions, Divider, List, Skeleton, Space, Tag, Typography } from 'antd'
import { translate } from '@/shared/utils/i18n'
import { formatDateTime } from '@/shared/utils/datetime'


const { Text, Paragraph, Title } = Typography

const toUiStatus = (s: string) => (s === 'submitted' || s === 'graded' ? 'completed' : s)

function renderAnswer(type: string, val: string | null, options?: string[] | null) {
  if (!val) return <Text type="secondary">{translate('auto.1516d7b39e')}</Text>
  const t = String(type).toLowerCase()
  if (t === 'true_false') {
    return <Text>{val === 'true' ? translate('questions.tf_true') : val === 'false' ? translate('questions.tf_false') : val}</Text>
  }
  // 多选 "A,B" / 单选 "A"
  const mapChoice = (code: string) => {
    const idx = code.trim().charCodeAt(0) - 65
    if (!options || idx < 0 || idx >= options.length) return code
    return `${code}. ${options[idx]}`
  }
  if (val.includes(',')) return <Text>{val.split(',').map(mapChoice).join('、')}</Text>
  if (/^[A-Z]$/.test(val)) return <Text>{mapChoice(val)}</Text>
  return <Text>{val}</Text>
}

const ResultDetailContent: React.FC<{ loading: boolean; data: any | null }> = ({ loading, data }) => {
  if (loading) return <Skeleton active paragraph={{ rows: 6 }} />
  if (!data) return <Alert type="warning" message={translate('auto.602c040cc7')} />

  const uiStatus = toUiStatus(String(data.status))
  const tagColor = uiStatus === 'completed' ? 'success' : uiStatus === 'in_progress' ? 'warning' : 'default'

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
        <Title level={4} style={{ margin: 0 }}>
          {data.paper_title || translate('visible.701efbdcb5')}
        </Title>
        <Tag color={tagColor}>
          {uiStatus === 'completed' ? translate('dashboard.status_completed') : uiStatus === 'in_progress' ? translate('dashboard.status_in_progress') : translate('dashboard.status_not_started')}
        </Tag>
      </Space>

      <Descriptions column={3} bordered size="middle">
        <Descriptions.Item label={translate('nav.results')} span={1}>
          {data.score} / {data.total_score}
        </Descriptions.Item>
        <Descriptions.Item label={translate('auto.8dc159502e')} span={1}>
          {data.percentage != null ? `${data.percentage}%` : '-'}
        </Descriptions.Item>
        <Descriptions.Item label={translate('auto.c581cec042')} span={1}>
          {data.duration ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label={translate('dashboard.start_time')} span={1}>
          {formatDateTime(data.start_time) || '-'}
        </Descriptions.Item>
        <Descriptions.Item label={translate('dashboard.submit_time')} span={1}>
          {formatDateTime(data.end_time) || '-'}
        </Descriptions.Item>
        <Descriptions.Item label={translate('auto.2514f93ebe')} span={1}>
          {data.exam_id ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label={translate('auto.5cfe3f239d')} span={3}>
          {data.paper_id ?? '-'}
        </Descriptions.Item>
      </Descriptions>

      <Divider />

      <List
        header={translate('auto.76884ec560')}
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
                    {q.options.map((opt:any, i:number) => (
                      <div key={i}>
                        <Text type="secondary">{String.fromCharCode(65 + i)}.</Text> {opt}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">{translate('auto.758722bee9')}</Text> {renderAnswer(q.type, q.user_answer, q.options)}
                </div>
                <div>
                  <Text type="secondary">{translate('auto.b767475397')}</Text> {renderAnswer(q.type, q.correct_answer, q.options)}
                </div>
              </Space>
            </List.Item>
          )
        }}
      />
    </Space>
  )
}

export default ResultDetailContent
