import { Button, Select, Space, Spin } from 'antd'
import type { SelectProps } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { mailApi, type RecipientOption } from '@/shared/api/endpoints/mail'
import OrgUserPickerDrawer from '@/features/mail/components/OrgUserPickerDrawer'
import { translate } from '@/shared/utils/i18n'

type Props = {
  value?: number[]
  onChange?: (ids: number[]) => void
  placeholder?: string
}

export default function RecipientSelect({ value, onChange, placeholder }: Props) {
  const [options, setOptions] = useState<SelectProps['options']>([])
  const [fetching, setFetching] = useState(false)
  const optionMapRef = useRef<Map<number, { label: string; value: number }>>(new Map())
  const fetchRef = useRef<number | null>(null)
  const [orgPickerOpen, setOrgPickerOpen] = useState(false)

  const mergeOptions = useCallback((list: RecipientOption[]) => {
    const current = new Map(optionMapRef.current)
    list.forEach(item => {
      current.set(item.id, {
        value: item.id,
        label: item.name || `用户${item.id}`,
      })
    })
    optionMapRef.current = current
    setOptions(Array.from(current.values()))
  }, [])

  const fetch = async (keyword: string) => {
    if (fetchRef.current) window.clearTimeout(fetchRef.current)
    fetchRef.current = window.setTimeout(async () => {
      setFetching(true)
      try {
        const list = await mailApi.recipientOptions(keyword)
        mergeOptions(list)
      } finally {
        setFetching(false)
      }
    }, 200)
  }

  useEffect(() => {
    fetch('')
    return () => {
      if (fetchRef.current) window.clearTimeout(fetchRef.current)
    }
  }, [])

  const mergedValue = useMemo(() => value ?? [], [value])

  const handleOrgPick = (picked: RecipientOption[]) => {
    if (!picked.length) return
    mergeOptions(picked)
    const ids = Array.from(new Set([...(value || []), ...picked.map(item => item.id)]))
    onChange?.(ids)
  }

  return (
    <>
      <Space style={{ width: '100%' }} align="start">
        <Select
          style={{ flex: 1, minWidth: 360 }}
          mode="multiple"
          showSearch
          filterOption={false}
          placeholder={placeholder}
          options={options}
          value={mergedValue}
          notFoundContent={fetching ? <Spin size="small" /> : null}
          onSearch={fetch}
          onChange={ids => onChange?.(ids as number[])}
        />
        <Button onClick={() => setOrgPickerOpen(true)}>{translate('auto.cee6af3089')}</Button>
      </Space>
      <OrgUserPickerDrawer
        open={orgPickerOpen}
        onClose={() => setOrgPickerOpen(false)}
        selectedIds={mergedValue}
        onSelect={handleOrgPick}
      />
    </>
  )
}
