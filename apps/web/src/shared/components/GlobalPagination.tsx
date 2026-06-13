import { Pagination } from 'antd'
import type { PaginationProps } from 'antd'
import type { ReactNode } from 'react'
import {
  formatPaginationTotal,
  normalizeQuickJumper,
  resolvePaginationChange,
  STANDARD_PAGE_SIZE_OPTIONS,
  STANDARD_QUICK_JUMPER,
} from '@/shared/constants/pagination'
import './GlobalPagination.css'

const cx = (...classes: Array<string | undefined | false>) => classes.filter(Boolean).join(' ')

export type GlobalPaginationProps = {
  total: number
  current: number
  pageSize: number
  onChange: (page: number, pageSize: number) => void
  onPageSizeChange?: (page: number, pageSize: number) => void
  pageSizeOptions?: NonNullable<PaginationProps['pageSizeOptions']>
  showSizeChanger?: boolean
  showQuickJumper?: PaginationProps['showQuickJumper']
  className?: string
  fullWidth?: boolean
  renderTotal?: (total: number, range: [number, number]) => ReactNode
  unit?: string
  resetPageOnSizeChange?: boolean
}

export default function GlobalPagination({
  total,
  current,
  pageSize,
  onChange,
  onPageSizeChange,
  pageSizeOptions = STANDARD_PAGE_SIZE_OPTIONS,
  showSizeChanger = true,
  showQuickJumper = STANDARD_QUICK_JUMPER,
  className,
  fullWidth = true,
  renderTotal,
  unit = '条',
  resetPageOnSizeChange = true,
}: GlobalPaginationProps) {
  const handleChange = (page: number, size: number) => {
    const next = resolvePaginationChange(page, size, pageSize, { resetPageOnSizeChange })
    if (next.pageSize !== pageSize) onPageSizeChange?.(next.page, next.pageSize)
    onChange(next.page, next.pageSize)
  }

  const showTotal = renderTotal
    ? (totalNum: number, range: [number, number]) => renderTotal(totalNum, range)
    : (totalNum: number, range: [number, number]) => formatPaginationTotal(totalNum, range, unit)

  return (
    <div className={cx('global-pagination', fullWidth ? 'global-pagination--full' : 'global-pagination--inline', className)}>
      <Pagination
        total={total}
        current={current}
        pageSize={pageSize}
        showSizeChanger={showSizeChanger}
        showQuickJumper={normalizeQuickJumper(showQuickJumper)}
        pageSizeOptions={pageSizeOptions}
        onChange={handleChange}
        itemRender={(page, type, originalElement) => {
          if (type === 'prev') return <span className="gp-nav">{'<'}</span>
          if (type === 'next') return <span className="gp-nav">{'>'}</span>
          return originalElement
        }}
        showTotal={showTotal}
      />
    </div>
  )
}
