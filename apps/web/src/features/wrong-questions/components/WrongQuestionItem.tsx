// features/wrong-questions/components/WrongQuestionItem.tsx
import { Button, Card, Space, Tag, Typography } from 'antd'
import { CheckCircle, Eye, Trash2 } from 'lucide-react'
import type { WrongQuestion } from '../services/wq.service'
const { Text } = Typography

const getLabel = (type: string) =>
  (({ single_choice: '单选题', multiple_choice: '多选题', true_false: '判断题', short_answer: '简答题' } as any)[
    type
  ] || type)

export const WrongQuestionItem: React.FC<{
  item: WrongQuestion
  onView: (id: number) => void
  onMark: (id: number) => void
  onRemove: (id: number) => void
}> = ({ item, onView, onMark, onRemove }) => (
  <Card>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div style={{ flex: 1 }}>
        <Space style={{ marginBottom: 12 }}>
          <Tag color="blue">{getLabel(item.question_type)}</Tag>
          <Tag color={item.is_mastered ? 'green' : 'red'}>{item.is_mastered ? '已掌握' : '未掌握'}</Tag>
        </Space>
        <div style={{ marginBottom: 12, color: '#262626', lineHeight: 1.5 }}>{item.content}</div>
        <Space size="large">
          <Text type="secondary">错误次数: {item.wrong_count}</Text>
          <Text type="secondary">正确次数: {item.correct_count}</Text>
          <Text type="secondary">最后练习: {new Date(item.last_practice_time).toLocaleDateString()}</Text>
        </Space>
      </div>
      <Space style={{ marginLeft: 16 }}>
        <Button
          type="text"
          icon={<Eye style={{ width: 20, height: 20 }} />}
          onClick={() => onView(item.question_id)}
          title="查看题目"
        />
        {!item.is_mastered && (
          <Button
            type="text"
            icon={<CheckCircle style={{ width: 20, height: 20, color: '#52c41a' }} />}
            onClick={() => onMark(item.question_id)}
            title="标记为已掌握"
          />
        )}
        <Button
          type="text"
          danger
          icon={<Trash2 style={{ width: 20, height: 20 }} />}
          onClick={() => onRemove(item.question_id)}
          title="从错题本移除"
        />
      </Space>
    </div>
  </Card>
)
