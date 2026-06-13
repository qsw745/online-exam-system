// apps/web/src/features/analytics/components/ResultDetailContent.tsx
import React from 'react'
import { Alert, Descriptions, Divider, List, Skeleton, Space, Tag, Typography } from 'antd'


const { Text, Paragraph, Title } = Typography

const toUiStatus = (s: string) => (s === 'submitted' || s === 'graded' ? 'completed' : s)

function renderAnswer(type: string, val: string | null, options?: string[] | null) {
  if (!val) return <Text type="secondary">未作答</Text>
  const t = String(type).toLowerCase()
  if (t === 'true_false') {
    return <Text>{val === 'true' ? '正确' : val === 'false' ? '错误' : val}</Text>
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
  if (!data) return <Alert type="warning" message="未找到该考试结果" />

  const uiStatus = toUiStatus(String(data.status))
  const tagColor = uiStatus === 'completed' ? 'success' : uiStatus === 'in_progress' ? 'warning' : 'default'

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
        <Title level={4} style={{ margin: 0 }}>
          {data.paper_title || '考试成绩详情'}
        </Title>
        <Tag color={tagColor}>
          {uiStatus === 'completed' ? '已完成' : uiStatus === 'in_progress' ? '进行中' : '未开始'}
        </Tag>
      </Space>

      <Descriptions column={3} bordered size="middle">
        <Descriptions.Item label="成绩" span={1}>
          {data.score} / {data.total_score}
        </Descriptions.Item>
        <Descriptions.Item label="正确率" span={1}>
          {data.percentage != null ? `${data.percentage}%` : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="用时（秒）" span={1}>
          {data.duration ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label="开始时间" span={1}>
          {data.start_time || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="提交时间" span={1}>
          {data.end_time || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="考试ID" span={1}>
          {data.exam_id ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label="试卷ID" span={3}>
          {data.paper_id ?? '-'}
        </Descriptions.Item>
      </Descriptions>

      <Divider />

      <List
        header="题目明细"
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
                    {q.options.map((opt:any, i:number) => (
                      <div key={i}>
                        <Text type="secondary">{String.fromCharCode(65 + i)}.</Text> {opt}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">你的答案：</Text> {renderAnswer(q.type, q.user_answer, q.options)}
                </div>
                <div>
                  <Text type="secondary">正确答案：</Text> {renderAnswer(q.type, q.correct_answer, q.options)}
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
