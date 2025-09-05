// features/users/components/UserFilterBar.tsx
import { FilterOutlined, SearchOutlined, UserAddOutlined } from '@ant-design/icons'
import { Button, Input, Select, Space, Switch, Typography } from 'antd'
const { Option } = Select
const { Text } = Typography
export const UserFilterBar: React.FC<{
  keyword: string
  setKeyword: (v: string) => void
  role: string
  setRole: (v: string) => void
  includeChildren: boolean
  setIncludeChildren: (v: boolean) => void
  canBind: boolean
  onBindClick: () => void
}> = ({ keyword, setKeyword, role, setRole, includeChildren, setIncludeChildren, canBind, onBindClick }) => (
  <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
    <Input
      placeholder="搜索用户邮箱或昵称..."
      value={keyword}
      onChange={e => setKeyword(e.target.value)}
      prefix={<SearchOutlined />}
      allowClear
      size="large"
      style={{ width: 360 }}
    />
    <Space align="center" wrap>
      <FilterOutlined style={{ color: '#8c8c8c' }} />
      <Select value={role} onChange={setRole} style={{ width: 140 }} size="large" placeholder="选择角色">
        <Option value="">所有角色</Option>
        <Option value="student">学生</Option>
        <Option value="teacher">教师</Option>
        <Option value="admin">管理员</Option>
      </Select>
      {canBind && (
        <Space>
          <Text type="secondary">含子部门</Text>
          <Switch checked={includeChildren} onChange={setIncludeChildren} />
        </Space>
      )}
      <Button type="primary" icon={<UserAddOutlined />} disabled={!canBind} onClick={onBindClick}>
        新增用户到该机构
      </Button>
    </Space>
  </Space>
)
