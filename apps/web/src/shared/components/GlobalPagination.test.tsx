import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import GlobalPagination from './GlobalPagination'

vi.mock('@/shared/hooks/useMobile', () => ({ useIsMobile: () => true }))

describe('手机列表分页', () => {
  it('空列表不显示不存在的页码与翻页操作', () => {
    const { container } = render(<GlobalPagination total={0} current={1} pageSize={10} onChange={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('只有一页时只显示数量，不提供无效翻页按钮', () => {
    render(<GlobalPagination total={3} current={1} pageSize={10} onChange={vi.fn()} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText(/3/)).toBeInTheDocument()
  })

  it('翻页按钮可访问，首页不能往前翻，下一页保留每页条数', () => {
    const onChange = vi.fn()
    render(<GlobalPagination total={25} current={1} pageSize={10} onChange={onChange} />)
    expect(screen.getByRole('button', { name: '上一页' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '下一页' }))
    expect(onChange).toHaveBeenCalledWith(2, 10)
  })
})
