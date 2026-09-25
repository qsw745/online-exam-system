import { Button, Pagination } from 'antd'
import { ChevronLeft, ChevronRight } from 'lucide-react'
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
import { useIsMobile } from '@/shared/hooks/useMobile'

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
  const isMobile = useIsMobile()
  const handleChange = (page: number, size: number) => {
    const next = resolvePaginationChange(page, size, pageSize, { resetPageOnSizeChange })
    if (next.pageSize !== pageSize) onPageSizeChange?.(next.page, next.pageSize)
    onChange(next.page, next.pageSize)
  }

  const showTotal = renderTotal
    ? (totalNum: number, range: [number, number]) => renderTotal(totalNum, range)
    : (totalNum: number, range: [number, number]) => formatPaginationTotal(totalNum, range, unit)

  if (isMobile) {
    if (total === 0) return null
    const pages = Math.max(1, Math.ceil(total / pageSize))
    const page = Math.min(pages, Math.max(1, current))
    return <div className={cx('global-pagination', 'global-pagination--mobile', className)}>
      <span className="global-pagination__total">{showTotal(total, [(page - 1) * pageSize + 1, Math.min(page * pageSize, total)])}</span>
      {pages > 1 && <div className="global-pagination__controls">
        <Button aria-label="上一页" icon={<ChevronLeft size={18} />} disabled={page === 1} onClick={() => handleChange(page - 1, pageSize)} />
        <span className="global-pagination__page" aria-live="polite">{page} / {pages}</span>
        <Button aria-label="下一页" icon={<ChevronRight size={18} />} disabled={page === pages} onClick={() => handleChange(page + 1, pageSize)} />
      </div>}
    </div>
  }

  return (
    <div className={cx('global-pagination', fullWidth ? 'global-pagination--full' : 'global-pagination--inline', className)}>
      <Pagination
        total={total}
        current={current}
        pageSize={pageSize}
        simple={isMobile ? { readOnly: true } : false}
        showSizeChanger={!isMobile && showSizeChanger}
        showQuickJumper={!isMobile && normalizeQuickJumper(showQuickJumper)}
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
