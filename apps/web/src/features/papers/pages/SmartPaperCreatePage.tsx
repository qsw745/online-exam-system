// features/smart-paper/pages/SmartPaperCreatePage.tsx
import LoadingSpinner from '@/shared/components/LoadingSpinner'
import { Button } from 'antd'
import { ArrowLeft, Save, Shuffle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSmartPaper } from '@/shared/hooks/useSmartPaper'
import ConfigForm from '../components/ConfigForm'
import PreviewList from '../components/PreviewList'

export default function SmartPaperCreatePage() {
  const nav = useNavigate()
  const h = useSmartPaper()

  if (h.step === 'config') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button type="text" onClick={() => nav('/admin/papers')} className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> 返回
          </Button>
          <div>
            <h1 className="text-2xl font-bold">智能组卷</h1>
            <p className="text-gray-500 mt-1">根据配置自动从题库中选择题目组成试卷</p>
          </div>
        </div>

        <ConfigForm
          config={h.config}
          setField={h.setField}
          setQType={h.setQType}
          setDiffPct={h.setDiffPct}
          knowledgePoints={h.knowledgePoints}
        />

        <div className="flex justify-end space-x-4">
          <Button onClick={() => nav('/admin/papers')}>取消</Button>
          <Button
            type="primary"
            onClick={h.generate}
            loading={h.generating}
            disabled={!!h.validationError}
            icon={!h.generating ? <Shuffle className="w-4 h-4" /> : undefined}
          >
            {h.validationError ? '请先修正配置' : '开始组卷'}
          </Button>
        </div>
      </div>
    )
  }

  if (h.step === 'preview') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button type="text" onClick={() => h.setStep('config')} className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> 返回配置
            </Button>
            <div>
              <h1 className="text-2xl font-bold">试卷预览</h1>
              <p className="text-gray-500 mt-1">检查生成的试卷内容</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="default" onClick={h.generate} disabled={h.generating} className="flex items-center gap-2">
              {h.generating ? <LoadingSpinner /> : <Shuffle className="w-4 h-4" />}{' '}
              {h.generating ? '重新生成中...' : '重新生成'}
            </Button>
            <Button
              type="primary"
              onClick={() => h.save(() => nav('/admin/papers'))}
              loading={h.loading}
              icon={!h.loading ? <Save className="w-4 h-4" /> : undefined}
            >
              保存试卷
            </Button>
          </div>
        </div>

        <PreviewList
          title={h.config.title}
          desc={h.config.description}
          duration={h.config.duration}
          totalScore={h.config.totalScore}
          questions={h.questions}
        />
      </div>
    )
  }

  return <LoadingSpinner />
}
