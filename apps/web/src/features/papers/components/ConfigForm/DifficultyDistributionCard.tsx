// features/smart-paper/components/ConfigForm/DifficultyDistributionCard.tsx
import { Card, Form, Input } from 'antd'
import type { SmartPaperConfig } from '../../endpoints/smartPaper'

export default function DifficultyDistributionCard({
  config,
  setDiffPct,
}: {
  config: SmartPaperConfig
  setDiffPct: (k: keyof SmartPaperConfig['difficultyDistribution'], v: number) => void
}) {
  const d = config.difficultyDistribution
  const sum = d.easy + d.medium + d.hard
  return (
    <Card title="难度分布" className="mb-6">
      <Form layout="vertical">
        <Form.Item label="设置各难度题目百分比（总和需为100%）">
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                ['easy', '简单 (%)'],
                ['medium', '中等 (%)'],
                ['hard', '困难 (%)'],
              ] as const
            ).map(([k, label]) => (
              <div key={k}>
                <div className="text-sm mb-1">{label}</div>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={d[k]}
                  onChange={e => setDiffPct(k, parseInt(e.target.value) || 0)}
                />
              </div>
            ))}
          </div>
          <div className={`text-sm mt-2 ${sum === 100 ? 'text-gray-500' : 'text-red-500'}`}>当前总和: {sum}%</div>
        </Form.Item>
      </Form>
    </Card>
  )
}
