import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Eye, 
  BookOpen,
  AlertCircle,
  CheckCircle,
  X,
  FileText
} from 'lucide-react'
import Pagination from '../../components/ui/Pagination'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import toast from 'react-hot-toast'
import { api } from '../../lib/api'

// 使用 api.ts 中导出的 papers 对象

interface Paper {
  id: string
  title: string
  description: string
  total_score: number
  difficulty: 'easy' | 'medium' | 'hard'
  created_at: string
  updated_at: string
}

const PaperManagementPage: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [papers, setPapers] = useState<Paper[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDifficulty, setFilterDifficulty] = useState('all')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null)
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalPapers, setTotalPapers] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    loadPapers()
  }, [currentPage, searchTerm, filterDifficulty, pageSize])

  const loadPapers = async () => {
    try {
      setLoading(true)
      const params = {
        page: currentPage,
        limit: pageSize,
        search: searchTerm || undefined,
        difficulty: filterDifficulty === 'all' ? undefined : filterDifficulty
      }
      const response = await api.get('/papers', { params })
      
      // 处理响应数据
      if (response.data && response.data.papers) {
        setPapers(response.data.papers)
        // 处理分页信息
        if (response.data.pagination) {
          setTotalPages(response.data.pagination.totalPages)
          setTotalPapers(response.data.pagination.total)
        }
      } else if (response.data && response.data.data && response.data.data.papers) {
        setPapers(response.data.data.papers)
        // 处理分页信息
        if (response.data.data.pagination) {
          setTotalPages(response.data.data.pagination.totalPages)
          setTotalPapers(response.data.data.pagination.total)
        }
      } else {
        setPapers([])
      }
    } catch (error: any) {
      console.error('加载试卷错误:', error)
      toast.error(error.response?.data?.message || '加载试卷失败')
      setPapers([]) // 出错时设置为空数组
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (paperId: string) => {
    try {
      await api.delete(`/papers/${paperId}`)
      toast.success('试卷删除成功')
      loadPapers()
      setShowDeleteModal(false)
      setSelectedPaper(null)
    } catch (error: any) {
      console.error('删除试卷错误:', error)
      toast.error(error.response?.data?.message || '删除试卷失败')
    }
  }

  // 分页控制函数
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }

  // 搜索和筛选的防抖处理
  const handleSearch = (value: string) => {
    setSearchTerm(value)
    setCurrentPage(1) // 重置到第一页
  }

  const handleFilterChange = (value: string) => {
    setFilterDifficulty(value)
    setCurrentPage(1) // 重置到第一页
  }

  // 移除客户端过滤逻辑，现在使用服务端分页

  const getDifficultyLabel = (difficulty: string) => {
    const difficultyMap = {
      'easy': '简单',
      'medium': '中等',
      'hard': '困难'
    }
    return difficultyMap[difficulty as keyof typeof difficultyMap] || difficulty
  }

  const getDifficultyColor = (difficulty: string) => {
    const colorMap = {
      'easy': 'bg-green-100 text-green-800',
      'medium': 'bg-yellow-100 text-yellow-800',
      'hard': 'bg-red-100 text-red-800'
    }
    return colorMap[difficulty as keyof typeof colorMap] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return <LoadingSpinner text="加载试卷列表..." />
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">试卷管理</h1>
        <p className="text-gray-600 mt-1">管理所有考试试卷</p>
      </div>

      {/* 操作栏 */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="flex flex-1 gap-4">
          {/* 搜索框 */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="搜索试卷..."
              value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* 筛选器 */}
          <select
            value={filterDifficulty}
                onChange={(e) => handleFilterChange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">所有难度</option>
            <option value="easy">简单</option>
            <option value="medium">中等</option>
            <option value="hard">困难</option>
          </select>
        </div>

        {/* 添加按钮 */}
        <div className="flex gap-2">
          <button
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            onClick={() => navigate('/admin/smart-paper-create')}
          >
            <BookOpen className="w-5 h-5" />
            智能组卷
          </button>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            onClick={() => navigate('/admin/paper-create')}
          >
            <Plus className="w-5 h-5" />
            手动组卷
          </button>
        </div>
      </div>

      {/* 试卷列表 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">试卷</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">难度</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">总分</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建时间</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {papers.map((paper) => (
                <tr key={paper.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 font-medium">{paper.title}</div>
                    <div className="text-sm text-gray-500">{paper.description}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getDifficultyColor(paper.difficulty)}`}>
                      {getDifficultyLabel(paper.difficulty)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {paper.total_score} 分
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(paper.created_at).toLocaleString('zh-CN')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button
                      className="text-blue-600 hover:text-blue-900"
                      onClick={() => navigate(`/admin/paper-detail/${paper.id}`)}
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <button
                      className="text-green-600 hover:text-green-900"
                      onClick={() => navigate(`/admin/paper-edit/${paper.id}`)}
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      className="text-red-600 hover:text-red-900"
                      onClick={() => {
                        setSelectedPaper(paper)
                        setShowDeleteModal(true)
                      }}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}

              {papers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    暂无试卷
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* 增强版分页组件 */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalPapers}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newPageSize) => {
            setPageSize(newPageSize)
            setCurrentPage(1) // 重置到第一页
          }}
          showSizeChanger={true}
          showQuickJumper={true}
          showTotal={true}
          pageSizeOptions={[10, 20, 50, 100]}
          size="default"
        />
      </div>

      {/* 删除确认对话框 */}
      {showDeleteModal && selectedPaper && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">确认删除</h3>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-600 mb-4">
              确定要删除试卷 {selectedPaper.title}？此操作无法撤销。
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(selectedPaper.id)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PaperManagementPage