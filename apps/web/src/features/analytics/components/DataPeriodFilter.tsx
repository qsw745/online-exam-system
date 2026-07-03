import React from 'react'
import type { Period } from '@/shared/hooks/useDataAnalytics'
import { Filter } from 'lucide-react'
import { translate } from '@/shared/utils/i18n'

type Props = {
  period: Period
  onChange: (p: Period) => void
}

export const DataPeriodFilter: React.FC<Props> = ({ period, onChange }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Filter className="w-5 h-5 text-gray-500" />
          <span className="text-gray-700">{translate('auto.2be9040878')}</span>
        </div>
        <select
          value={period}
          onChange={e => onChange(e.target.value as Period)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="7d">{translate('auto.fc11847b90')}</option>
          <option value="30d">{translate('auto.cb892bd406')}</option>
          <option value="90d">{translate('auto.98292018a0')}</option>
          <option value="all">{translate('auto.2d25878062')}</option>
        </select>
      </div>
    </div>
  )
}
