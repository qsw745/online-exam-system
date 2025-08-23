import React, { useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, MoreHorizontal } from 'lucide-react'
import { Button } from './button'

interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  showSizeChanger?: boolean
  showQuickJumper?: boolean
  showTotal?: boolean
  pageSizeOptions?: number[]
  className?: string
  size?: 'small' | 'default' | 'large'
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  showSizeChanger = true,
  showQuickJumper = true,
  showTotal = true,
  pageSizeOptions = [10, 20, 50, 100],
  className = '',
  size = 'default'
}) => {
  const [jumpPage, setJumpPage] = useState('')

  // 尺寸样式配置
  const sizeConfig = {
    small: {
      button: 'h-8 w-8 text-xs',
      input: 'h-8 text-xs',
      text: 'text-xs',
      spacing: 'space-x-1'
    },
    default: {
      button: 'h-9 w-9 text-sm',
      input: 'h-9 text-sm',
      text: 'text-sm',
      spacing: 'space-x-1'
    },
    large: {
      button: 'h-10 w-10 text-base',
      input: 'h-10 text-base',
      text: 'text-base',
      spacing: 'space-x-2'
    }
  }

  const config = sizeConfig[size]

  // 生成页码数组
  const generatePageNumbers = () => {
    const pages: (number | 'ellipsis')[] = []
    const delta = 2 // 当前页前后显示的页数

    if (totalPages <= 7) {
      // 总页数少于等于7页，显示所有页码
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // 总页数大于7页，使用省略号
      pages.push(1)

      if (currentPage <= 4) {
        // 当前页在前面
        for (let i = 2; i <= 5; i++) {
          pages.push(i)
        }
        pages.push('ellipsis')
        pages.push(totalPages)
      } else if (currentPage >= totalPages - 3) {
        // 当前页在后面
        pages.push('ellipsis')
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i)
        }
      } else {
        // 当前页在中间
        pages.push('ellipsis')
        for (let i = currentPage - delta; i <= currentPage + delta; i++) {
          pages.push(i)
        }
        pages.push('ellipsis')
        pages.push(totalPages)
      }
    }

    return pages
  }

  // 处理页面跳转
  const handleJumpToPage = () => {
    const page = parseInt(jumpPage)
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange(page)
    }
    setJumpPage('')
  }

  // 处理键盘事件
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleJumpToPage()
    }
  }

  // 计算显示范围
  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  if (totalPages <= 1) {
    return null
  }

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-white border-t border-gray-200 ${className}`}>
      {/* 总数信息 */}
      {showTotal && (
        <div className={`${config.text} text-gray-700 order-2 sm:order-1`}>
          <span className="hidden sm:inline">
            显示第 <span className="font-semibold text-gray-900">{startItem}</span> 至{' '}
            <span className="font-semibold text-gray-900">{endItem}</span> 条，共{' '}
            <span className="font-semibold text-gray-900">{totalItems}</span> 条记录
          </span>
          <span className="sm:hidden">
            {startItem}-{endItem} / {totalItems}
          </span>
        </div>
      )}

      {/* 分页控件 */}
      <div className="flex items-center gap-4 order-1 sm:order-2">
        {/* 每页条数选择器 */}
        {showSizeChanger && onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className={`${config.text} text-gray-700 hidden sm:inline`}>每页</span>
            <select
              value={pageSize.toString()}
              onChange={(e) => onPageSizeChange(parseInt(e.target.value))}
              className={`w-20 ${config.input} px-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            >
              {pageSizeOptions.map(option => (
                <option key={option} value={option.toString()}>
                  {option}
                </option>
              ))}
            </select>
            <span className={`${config.text} text-gray-700 hidden sm:inline`}>条</span>
          </div>
        )}

        {/* 分页按钮组 */}
        <div className={`flex items-center ${config.spacing}`}>
          {/* 首页按钮 */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            className={`${config.button} hover:bg-blue-50 hover:border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200`}
            title="首页"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>

          {/* 上一页按钮 */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={`${config.button} hover:bg-blue-50 hover:border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200`}
            title="上一页"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {/* 页码按钮 */}
          <div className={`flex items-center ${config.spacing}`}>
            {generatePageNumbers().map((page, index) => {
              if (page === 'ellipsis') {
                return (
                  <div
                    key={`ellipsis-${index}`}
                    className={`${config.button} flex items-center justify-center text-gray-400`}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </div>
                )
              }

              const isActive = page === currentPage
              return (
                <Button
                  key={page}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => onPageChange(page)}
                  className={`
                    ${config.button}
                    ${isActive 
                      ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-md' 
                      : 'hover:bg-blue-50 hover:border-blue-300'
                    }
                    transition-all duration-200 font-medium
                  `}
                >
                  {page}
                </Button>
              )
            })}
          </div>

          {/* 下一页按钮 */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={`${config.button} hover:bg-blue-50 hover:border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200`}
            title="下一页"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          {/* 末页按钮 */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            className={`${config.button} hover:bg-blue-50 hover:border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200`}
            title="末页"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>

        {/* 快速跳转 */}
        {showQuickJumper && (
          <div className="flex items-center gap-2">
            <span className={`${config.text} text-gray-700 hidden sm:inline`}>跳至</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={jumpPage}
              onChange={(e) => setJumpPage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="页码"
              className={`w-16 ${config.input} text-center px-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            />
            <span className={`${config.text} text-gray-700 hidden sm:inline`}>页</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleJumpToPage}
              disabled={!jumpPage || parseInt(jumpPage) < 1 || parseInt(jumpPage) > totalPages}
              className={`${config.button} px-3 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200`}
            >
              跳转
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Pagination