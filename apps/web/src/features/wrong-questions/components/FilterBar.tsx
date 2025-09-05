// features/wrong-questions/components/FilterBar.tsx
import { Button, Card, Space, Typography } from 'antd'
import { Filter } from 'lucide-react'
import type { WQFilter } from '../services/wq.service'
const { Text } = Typography

export const FilterBar: React.FC<{ value: WQFilter; onChange: (f: WQFilter) => void }> = ({ value, onChange }) => (
  <Card>
    <Space align="center">
      <Filter style={{ width: 20, height: 20, color: '#8c8c8c' }} />
      <Text strong>筛选:</Text>
      <Space>
        <Button
          type={value === 'unmastered' ? 'primary' : 'default'}
          danger={value === 'unmastered'}
          onClick={() => onChange('unmastered')}
        >
          未掌握
        </Button>
        <Button
          type={value === 'mastered' ? 'primary' : 'default'}
          style={value === 'mastered' ? { backgroundColor: '#52c41a', borderColor: '#52c41a' } : {}}
          onClick={() => onChange('mastered')}
        >
          已掌握
        </Button>
        <Button type={value === 'all' ? 'primary' : 'default'} onClick={() => onChange('all')}>
          全部
        </Button>
      </Space>
    </Space>
  </Card>
)
