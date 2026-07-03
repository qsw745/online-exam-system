// features/smart-paper/components/ConfigForm/DifficultyDistributionCard.tsx
import { Card, Form, Input } from 'antd'
import type { SmartPaperConfig } from '../../../../shared/api/endpoints/smartPaper'
import { translate } from '@/shared/utils/i18n'

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
    <Card title={translate('auto.e83c6e4fa8')} className="mb-6">
      <Form layout="vertical">
        <Form.Item label={translate('auto.30c8b103d4')}>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                ['easy', translate('visible.0d2394a737')],
                ['medium', translate('visible.96d0992ffc')],
                ['hard', translate('visible.6da8075929')],
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
          <div className={`text-sm mt-2 ${sum === 100 ? 'text-gray-500' : 'text-red-500'}`}>{translate('auto.a52dd3769c')}{sum}%</div>
        </Form.Item>
      </Form>
    </Card>
  )
}
