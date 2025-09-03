// 统一分页配置常量
export const PAGINATION_CONFIG = {
  // 默认页面大小
  DEFAULT_PAGE_SIZE: 10,
  
  // 页面大小选项
  PAGE_SIZE_OPTIONS: ['10', '20', '50', '100'],
  
  // 显示总数的格式化函数
  SHOW_TOTAL: (total: number, range: [number, number]) => 
    `显示第 ${range[0]} - ${range[1]} 条，共 ${total} 条记录`,
  
  // 默认分页配置
  DEFAULT_CONFIG: {
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total: number, range: [number, number]) => 
      `显示第 ${range[0]} - ${range[1]} 条，共 ${total} 条记录`,
    pageSizeOptions: ['10', '20', '50', '100'],
    size: 'default' as const
  }
}

// 创建标准分页配置的辅助函数
export const createPaginationConfig = (overrides?: Partial<typeof PAGINATION_CONFIG.DEFAULT_CONFIG>) => {
  return {
    ...PAGINATION_CONFIG.DEFAULT_CONFIG,
    ...overrides
  }
}