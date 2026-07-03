// features/smart-paper/pages/SmartPaperCreatePage.tsx

import LoadingSpinner from '@/shared/components/LoadingSpinner'
import { useSmartPaper } from '@/shared/hooks/useSmartPaper'
import { Button, Spin } from 'antd'
import { ArrowLeft, Save, Shuffle } from 'lucide-react'
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import ConfigForm from '../components/ConfigForm'
import PreviewList from '../components/PreviewList'
import { translate } from '@/shared/utils/i18n'
export default function SmartPaperCreatePage() {
  const nav = useNavigate()
  const h = useSmartPaper()

  const onBackToList = useCallback(() => nav('/admin/papers'), [nav])

  // 点击“开始组卷”时，等待结果；若后端已创建 → 立刻跳转详情
  const onGenerate = useCallback(async () => {
    const r = await h.generate()
    if (r?.status === 'ok' && r.mode === 'created' && r.paperId) {
      nav(`/admin/paper-detail/${r.paperId}`)
    }
  }, [h, nav])

  // 预览页的“重新生成”也可能直接创建，保持一致处理
  const onRegenerate = useCallback(async () => {
    const r = await h.generate()
    if (r?.status === 'ok' && r.mode === 'created' && r.paperId) {
      nav(`/admin/paper-detail/${r.paperId}`)
    }
  }, [h, nav])

  if (h.step === 'config') {
    return (
      <div className="space-y-6">
  
        <div className="flex items-center gap-4">
          <Button type="text" onClick={onBackToList} className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> {translate('app.back')}</Button>
          <div>
            <h1 className="text-2xl font-bold">{translate('menus.admin-papers-smart')}</h1>
            <p className="text-gray-500 mt-1">{translate('auto.de0ba72e31')}</p>
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
          <Button onClick={onBackToList}>{translate('app.cancel')}</Button>
          <Button
            type="primary"
            onClick={onGenerate}
            loading={h.generating}
            disabled={!!h.validationError}
            icon={!h.generating ? <Shuffle className="w-4 h-4" /> : undefined}
          >
            {h.validationError ? translate('visible.782d627e6e') : translate('visible.7b0ed697d4')}
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
              <ArrowLeft className="w-4 h-4" /> {translate('auto.8e1559df1e')}</Button>
            <div>
              <h1 className="text-2xl font-bold">{translate('auto.688391a6c4')}</h1>
              <p className="text-gray-500 mt-1">{translate('auto.7687b9e21b')}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="default" onClick={onRegenerate} disabled={h.generating} className="flex items-center gap-2">
              {h.generating ? <Spin size="small" /> : <Shuffle className="w-4 h-4" />}{' '}
              {h.generating ? translate('visible.7038c8e182') : translate('visible.2e19057052')}
            </Button>
            <Button
              type="primary"
              onClick={() => h.save(onBackToList)}
              loading={h.loading}
              icon={!h.loading ? <Save className="w-4 h-4" /> : undefined}
            >
              {translate('auto.ff7f570df2')}</Button>
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
