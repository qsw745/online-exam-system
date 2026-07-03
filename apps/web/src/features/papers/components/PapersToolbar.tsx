import { Button, Card, Input, Select, Space, Tooltip } from 'antd'
import { PlusOutlined, RobotOutlined, SearchOutlined } from '@ant-design/icons'
import { useLanguage } from '@/shared/contexts/LanguageContext'

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
  const { t } = useLanguage()
  return (
    <Card>
      <Space style={{ width: '100%' }} align="start" direction="vertical" size={12}>
        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space wrap>
            <Input
              allowClear
              value={search}
              onChange={e => onSearchChange(e.target.value)}
              placeholder={t('papers.search_ph')}
              prefix={<SearchOutlined />}
              style={{ width: 320 }}
            />

            <Select
              value={difficulty}
              onChange={onDifficultyChange}
              style={{ width: 140 }}
              options={[
                { value: 'all', label: t('papers.diff_all') },
                { value: 'easy', label: t('papers.diff_easy') },
                { value: 'medium', label: t('papers.diff_medium') },
                { value: 'hard', label: t('papers.diff_hard') },
              ]}
            />
          </Space>

          <Space wrap>
            <Tooltip title={t('papers.smart_tooltip')}>
              <Button type="primary" icon={<RobotOutlined />} onClick={onCreateSmart}>
                {t('papers.smart_create')}
              </Button>
            </Tooltip>
            <Tooltip title={t('papers.manual_tooltip')}>
              <Button icon={<PlusOutlined />} onClick={onCreateManual}>
                {t('papers.manual_create2')}
              </Button>
            </Tooltip>
          </Space>
        </Space>
      </Space>
    </Card>
  )
}
