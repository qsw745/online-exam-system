// features/smart-paper/components/ConfigForm/index.tsx
import type { SmartPaperConfig } from '../../../../shared/api/endpoints/smartPaper'
import BasicInfoCard from './BasicInfoCard'
import DifficultyDistributionCard from './DifficultyDistributionCard'
import KnowledgePointsCard from './KnowledgePointsCard'
import QuestionTypesCard from './QuestionTypesCard'

export default function ConfigForm({
  config,
  setField,
  setQType,
  setDiffPct,
  knowledgePoints,
}: {
  config: SmartPaperConfig
  setField: <K extends keyof SmartPaperConfig>(k: K, v: SmartPaperConfig[K]) => void
  setQType: (k: keyof SmartPaperConfig['questionTypes'], v: number) => void
  setDiffPct: (k: keyof SmartPaperConfig['difficultyDistribution'], v: number) => void
  knowledgePoints: string[]
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <BasicInfoCard config={config} setField={setField} />
      <QuestionTypesCard config={config} setQType={setQType} />
      <DifficultyDistributionCard config={config} setDiffPct={setDiffPct} />
      <KnowledgePointsCard
        value={config.knowledgePoints}
        options={knowledgePoints}
        onChange={vals => setField('knowledgePoints', vals)}
      />
    </div>
  )
}
