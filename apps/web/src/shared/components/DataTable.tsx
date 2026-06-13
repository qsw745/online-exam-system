import React, { ReactNode, useMemo } from 'react'
import { Table, Space } from 'antd'
import type { ColumnsType, TableProps, TablePaginationConfig, ColumnType } from 'antd/es/table'
import { createTablePaginationConfig } from '@/shared/constants/pagination'
import type { PaginationTotalRenderer } from '@/shared/constants/pagination'

export type ServerPagination = {
  /** 当前页（1 开始） */
  current: number
  /** 页大小 */
  pageSize: number
  /** 总条数 */
  total: number
  /** 变更回调（页码或条数变化） */
  onChange?: (page: number, pageSize: number) => void
  /** 是否允许修改 pageSize，默认 true */
  showSizeChanger?: boolean
  /** 是否显示快速跳转，默认 true */
  showQuickJumper?: boolean
  /** pageSize 选项 */
  pageSizeOptions?: TablePaginationConfig['pageSizeOptions']
  /** 总数单位，默认“条” */
  unit?: string
  /** 自定义总数展示 */
  renderTotal?: PaginationTotalRenderer
}

export interface DataTableProps<T extends object> {
  /** 列定义（Antd ColumnsType） */
  columns: ColumnsType<T>
  /** 数据（客户端分页模式） */
  data?: T[]
  /** 远端/受控分页；传入 false 则不展示分页 */
  pagination?: false | ServerPagination
  /** 行主键，默认 'id' | (record)=>key */
  rowKey?: TableProps<T>['rowKey']
  /** 加载中 */
  loading?: boolean
  /** 是否边框表格，默认 true */
  bordered?: boolean
  /** sticky 表头或滚动 */
  scroll?: TableProps<T>['scroll']
  /** 表格尺寸 */
  size?: TableProps<T>['size']
  /** 选择框配置（透传给 antd） */
  rowSelection?: TableProps<T>['rowSelection']
  /** 行点击 */
  onRowClick?: (record: T) => void
  /** 左侧工具栏（通常放筛选条等） */
  toolbar?: ReactNode
  /** 右侧动作区（导出、新建按钮等） */
  extra?: ReactNode
  /** 空状态文案/节点 */
  emptyText?: ReactNode
  /** 显示序号列（根据分页自动计算） */
  showIndex?: boolean
  /** 其他 antd Table 属性（最后兜底合并） */
  tableProps?: Omit<
    TableProps<T>,
    'columns' | 'dataSource' | 'pagination' | 'rowKey' | 'loading' | 'rowSelection' | 'scroll' | 'size'
  >
}

/** 默认分页组件（服务端模式优先） */
function usePagination(pagination: DataTableProps<any>['pagination']): TablePaginationConfig | false {
  if (pagination === false) return false
  const current = pagination?.current ?? 1
  const pageSize = pagination?.pageSize ?? 10
  const total = pagination?.total ?? 0
  const showSizeChanger = pagination?.showSizeChanger ?? true

  return createTablePaginationConfig({
    current,
    pageSize,
    total,
    showSizeChanger,
    showQuickJumper: pagination?.showQuickJumper,
    pageSizeOptions: pagination?.pageSizeOptions,
    unit: pagination?.unit,
    renderTotal: pagination?.renderTotal,
    onChange: (p, ps) => pagination?.onChange?.(p, ps),
  })
}

function addIndexColumn<T extends object>(
  columns: ColumnsType<T>,
  showIndex: boolean | undefined,
  pagination: TablePaginationConfig | false
): ColumnsType<T> {
  if (!showIndex) return columns
  const start =
    pagination && typeof pagination.current === 'number' && typeof pagination.pageSize === 'number'
      ? (pagination.current - 1) * pagination.pageSize
      : 0

  const indexCol: ColumnType<T> = {
    title: '#',
    width: 64,
    dataIndex: '__index__',
    align: 'right',
    render: (_: any, __: T, i: number) => start + i + 1,
  }
  return [indexCol, ...columns]
}

function HeaderBar({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  if (!left && !right) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
      <Space wrap align="center">
        {left}
      </Space>
      <Space wrap align="center">
        {right}
      </Space>
    </div>
  )
}

function DataTable<T extends object>(props: DataTableProps<T>) {
  const {
    columns,
    data,
    pagination: p,
    rowKey = 'id',
    loading,
    bordered = true,
    scroll,
    size = 'middle',
    rowSelection,
    onRowClick,
    toolbar,
    extra,
    emptyText,
    showIndex,
    tableProps,
  } = props

  const pagination = usePagination(p)

  const mergedColumns = useMemo(
    () => addIndexColumn<T>(columns, showIndex, pagination),
    [columns, showIndex, pagination]
  )

  return (
    <>
      <HeaderBar left={toolbar} right={extra} />
      <Table<T>
        rowKey={rowKey as any}
        columns={mergedColumns}
        dataSource={data}
        loading={loading}
        bordered={bordered}
        scroll={scroll}
        size={size}
        pagination={pagination}
        rowSelection={rowSelection as any}
        onRow={record => ({
          onClick: () => onRowClick?.(record),
        })}
        locale={{ emptyText: emptyText ?? 'No Data' }}
        {...tableProps}
      />
    </>
  )
}

export default DataTable
