import { Pagination } from 'antd'
import type { PaginationProps } from 'antd'
import type { ReactNode } from 'react'
import './GlobalPagination.css'

const cx = (...classes: Array<string | undefined | false>) => classes.filter(Boolean).join(' ')

type GlobalPaginationProps = {
  total: number
  current: number
  pageSize: number
  onChange: (page: number, pageSize: number) => void
  onPageSizeChange?: (page: number, pageSize: number) => void
  pageSizeOptions?: NonNullable<PaginationProps['pageSizeOptions']>
  showSizeChanger?: boolean
  showQuickJumper?: boolean
  className?: string
  fullWidth?: boolean
  renderTotal?: (total: number, range: [number, number]) => ReactNode
}

export default function GlobalPagination({
  total,
  current,
  pageSize,
  onChange,
  onPageSizeChange,
  pageSizeOptions = ['10', '20', '30', '40', '50', '100'],
  showSizeChanger = true,
  showQuickJumper = true,
  className,
  fullWidth = true,
  renderTotal,
}: GlobalPaginationProps) {
  const handleChange = (page: number, size: number) => {
    onChange(page, size)
  }

  const handleShowSizeChange = (page: number, size: number) => {
    onPageSizeChange?.(page, size)
    onChange(page, size)
  }

  const showTotal = renderTotal
    ? (totalNum: number, range: [number, number]) => renderTotal(totalNum, range)
    : (totalNum: number) => `共 ${totalNum} 条`

  return (
    <div className={cx('global-pagination', fullWidth ? 'global-pagination--full' : 'global-pagination--inline', className)}>
      <Pagination
        total={total}
        current={current}
        pageSize={pageSize}
        showSizeChanger={showSizeChanger}
        showQuickJumper={showQuickJumper}
        pageSizeOptions={pageSizeOptions}
        onChange={handleChange}
        onShowSizeChange={handleShowSizeChange}
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
