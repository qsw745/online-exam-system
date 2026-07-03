import React, { useMemo, useState } from 'react'
import { Modal, Radio, Space, message, Select } from 'antd'
import { exportToCsv, exportToXlsx, buildRowsForExport, buildExportHeaders } from '@/shared/utils/q-helpers'
import { useLanguage } from '@/shared/contexts/LanguageContext'

export default function ExportModal({
  open,
  onClose,
  itemsOnPage,
  selectedIds,
  total,
  pageSize,
  fetchPage,
}: {
  open: boolean
  onClose: () => void
  itemsOnPage: any[]
  selectedIds: string[]
  total: number
  pageSize: number
  fetchPage: (page: number, limit: number) => Promise<{ items: any[]; total: number }>
}) {
  const { t } = useLanguage()
  const [scope, setScope] = useState<'selected' | 'page' | 'all'>(selectedIds.length ? 'selected' : 'page')
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx')
  const headers = useMemo(() => buildExportHeaders(), [])

  const doExport = async () => {
    try {
      let data: any[] = []
      if (scope === 'selected' && selectedIds.length) {
        const set = new Set(selectedIds)
        data = itemsOnPage.filter(x => set.has(String(x.id)))
      } else if (scope === 'page') {
        data = itemsOnPage
      } else {
        // all：循环分页取数（按当前筛选参数，父组件已封装在 fetchPage）
        let page = 1
        let acc: any[] = []
        // 至多导出 50 页防止意外（可按需调大）
        for (let i = 0; i < 50; i++) {
          const r = await fetchPage(page, pageSize)
          acc = acc.concat(r.items || [])
          if (acc.length >= (r.total || 0)) break
          page++
        }
        data = acc
      }

      if (!data.length) return message.info(t('questions.no_export_data'))

      const rows = buildRowsForExport(data)
      const filename = `${t('questions.export_filename')}_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${format}`
      if (format === 'xlsx') await exportToXlsx(rows, filename, headers)
      else await exportToCsv(rows, filename, headers)
      onClose()
    } catch (e: any) {
      message.error(e?.message || t('questions.export_failed'))
    }
  }

  return (
    <Modal
      title={t('questions.export_title')}
      maskClosable={false}
      open={open}
      onCancel={onClose}
      onOk={doExport}
      okText={t('questions.export')}
      destroyOnHidden
    >
      <Space direction="vertical" size="middle">
        <div>
          {t('questions.export_range')}
          <Radio.Group value={scope} onChange={e => setScope(e.target.value)} optionType="button" buttonStyle="solid">
            <Radio.Button value="selected" disabled={!selectedIds.length}>
              {t('questions.export_selected').replace('{n}', String(selectedIds.length))}
            </Radio.Button>
            <Radio.Button value="page">{t('questions.export_page').replace('{n}', String(itemsOnPage.length))}</Radio.Button>
            <Radio.Button value="all">{t('questions.export_all').replace('{n}', String(total))}</Radio.Button>
          </Radio.Group>
        </div>
        <div>
          {t('questions.export_format')}
          <Select
            value={format}
            onChange={v => setFormat(v)}
            options={[
              { label: 'Excel（.xlsx）', value: 'xlsx' },
              { label: 'CSV（.csv）', value: 'csv' },
            ]}
            style={{ width: 180 }}
          />
        </div>
      </Space>
    </Modal>
  )
}
