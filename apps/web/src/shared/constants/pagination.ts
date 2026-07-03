import type { PaginationProps } from 'antd'
import type { TablePaginationConfig } from 'antd/es/table'
import type { ReactNode } from 'react'
import { getLang } from '@/shared/utils/i18n'

export const DEFAULT_PAGE_SIZE = 10
export const STANDARD_PAGE_SIZE_OPTIONS: NonNullable<PaginationProps['pageSizeOptions']> = ['10', '20', '50', '100']
export const STANDARD_QUICK_JUMPER: NonNullable<PaginationProps['showQuickJumper']> = { goButton: '确定' }

export type PaginationTotalRenderer = (total: number, range: [number, number]) => ReactNode

export type PaginationChange = {
  page: number
  pageSize: number
}

export function formatPaginationTotal(total: number, range: [number, number], unit = '条') {
  if (getLang() === 'en-US') {
    if (!total) return 'Total 0'
    return `${range[0]}-${range[1]} of ${total}`
  }
  if (!total) return `共 0 ${unit}`
  return `第 ${range[0]}-${range[1]} ${unit}，共 ${total} ${unit}`
}

export function normalizeQuickJumper(showQuickJumper: PaginationProps['showQuickJumper'] = STANDARD_QUICK_JUMPER) {
  return showQuickJumper === true ? STANDARD_QUICK_JUMPER : showQuickJumper
}

export function resolvePaginationChange(
  page: number,
  pageSize: number | undefined,
  previousPageSize: number,
  options?: { resetPageOnSizeChange?: boolean }
): PaginationChange {
  const nextPageSize = Number.isFinite(Number(pageSize)) && Number(pageSize) > 0 ? Number(pageSize) : previousPageSize
  const resetPageOnSizeChange = options?.resetPageOnSizeChange ?? true
  const nextPage = resetPageOnSizeChange && nextPageSize !== previousPageSize ? 1 : page

  return {
    page: Math.max(1, Math.trunc(nextPage)),
    pageSize: Math.max(1, Math.trunc(nextPageSize)),
  }
}

export type StandardTablePaginationOptions = {
  current: number
  pageSize: number
  total: number
  onChange?: (page: number, pageSize: number) => void
  onShowSizeChange?: (page: number, pageSize: number) => void
  showSizeChanger?: boolean
  showQuickJumper?: PaginationProps['showQuickJumper']
  pageSizeOptions?: NonNullable<PaginationProps['pageSizeOptions']>
  size?: PaginationProps['size']
  unit?: string
  renderTotal?: PaginationTotalRenderer
}

export function createTablePaginationConfig({
  current,
  pageSize,
  total,
  onChange,
  onShowSizeChange,
  showSizeChanger = true,
  showQuickJumper = STANDARD_QUICK_JUMPER,
  pageSizeOptions = STANDARD_PAGE_SIZE_OPTIONS,
  size = 'default',
  unit = '条',
  renderTotal,
}: StandardTablePaginationOptions): TablePaginationConfig {
  return {
    current,
    pageSize,
    total,
    showSizeChanger,
    showQuickJumper: normalizeQuickJumper(showQuickJumper),
    showTotal: renderTotal ?? ((totalNum, range) => formatPaginationTotal(totalNum, range, unit)),
    pageSizeOptions,
    size,
    onChange,
    onShowSizeChange,
  }
}

export const PAGINATION_CONFIG = {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS: STANDARD_PAGE_SIZE_OPTIONS,
  SHOW_TOTAL: formatPaginationTotal,
  DEFAULT_CONFIG: createTablePaginationConfig({
    current: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
  }),
}

export const createPaginationConfig = (overrides?: Partial<TablePaginationConfig>) => ({
  ...PAGINATION_CONFIG.DEFAULT_CONFIG,
  ...overrides,
})
