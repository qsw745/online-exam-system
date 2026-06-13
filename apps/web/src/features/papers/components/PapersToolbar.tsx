import { Button, Card, Input, Select, Space, Tooltip } from 'antd'
import { PlusOutlined, RobotOutlined, SearchOutlined } from '@ant-design/icons'

export default function PapersToolbar({
  search,
  onSearchChange,
  difficulty,
  onDifficultyChange,
  onCreateManual,
  onCreateSmart,
}: {
  search: string
  onSearchChange: (v: string) => void
  difficulty: 'all' | 'easy' | 'medium' | 'hard'
  onDifficultyChange: (v: 'all' | 'easy' | 'medium' | 'hard') => void
  onCreateManual: () => void
  onCreateSmart: () => void
}) {
  return (
    <Card>
      <Space style={{ width: '100%' }} align="start" direction="vertical" size={12}>
        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space wrap>
            <Input
              allowClear
              value={search}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="搜索试卷..."
              prefix={<SearchOutlined />}
              style={{ width: 320 }}
            />

            <Select
              value={difficulty}
              onChange={onDifficultyChange}
              style={{ width: 140 }}
              options={[
                { value: 'all', label: '所有难度' },
                { value: 'easy', label: '简单' },
                { value: 'medium', label: '中等' },
                { value: 'hard', label: '困难' },
              ]}
            />
          </Space>

          <Space wrap>
            <Tooltip title="根据规则一键智能组卷">
              <Button type="primary" icon={<RobotOutlined />} onClick={onCreateSmart}>
                智能组卷
              </Button>
            </Tooltip>
            <Tooltip title="从题库手动选择题目创建试卷">
              <Button icon={<PlusOutlined />} onClick={onCreateManual}>
                手动组卷
              </Button>
            </Tooltip>
          </Space>
        </Space>
      </Space>
    </Card>
  )
}
