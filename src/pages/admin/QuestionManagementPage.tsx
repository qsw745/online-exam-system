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
  Upload,
  Download,
  FileText
} from 'lucide-react'
import Pagination from '../../components/ui/Pagination'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import toast from 'react-hot-toast'
import { api, questions as questionsApi } from '../../lib/api'
import { parseFile, ParsedQuestion } from '../../utils/fileParser'

interface Question {
  id: string
  content: string
  question_type: string
  knowledge_points: string[]
  options?: {
    content: string
    is_correct: boolean
  }[]
  answer?: string
  explanation?: string
  created_at: string
  updated_at: string
}

const QuestionManagementPage: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [questions, setQuestions] = useState<Question[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  // 选择状态
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([])
  const [selectAll, setSelectAll] = useState(false)
  const [isBatchDelete, setIsBatchDelete] = useState(false)

  useEffect(() => {
    loadQuestions()
  }, [currentPage, searchTerm, filterType, pageSize])

  const loadQuestions = async () => {
    try {
      setLoading(true)
      const params = {
        page: currentPage,
        limit: pageSize,
        search: searchTerm || undefined,
        type: filterType === 'all' ? undefined : filterType
      }
      const response = await questionsApi.getAll(params)
      setQuestions(response.data.questions || [])
      
      // 处理分页信息
      if (response.data.pagination) {
        setTotalPages(response.data.pagination.totalPages)
        setTotalQuestions(response.data.pagination.total)
      }
    } catch (error: any) {
      console.error('加载题目错误:', error)
      toast.error(error.response?.data?.message || '加载题目失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (questionId: string) => {
    try {
      await questionsApi.delete(questionId)
      toast.success('题目删除成功')
      loadQuestions()
      setShowDeleteModal(false)
      setSelectedQuestion(null)
    } catch (error: any) {
      console.error('删除题目错误:', error)
      toast.error(error.response?.data?.message || '删除题目失败')
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const allowedTypes = ['.xlsx', '.xls', '.csv']
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
      
      if (!allowedTypes.includes(fileExtension)) {
        toast.error('请选择Excel文件(.xlsx, .xls)或CSV文件(.csv)')
        return
      }
      
      if (file.size > 10 * 1024 * 1024) { // 10MB限制
        toast.error('文件大小不能超过10MB')
        return
      }
      
      setImportFile(file)
    }
  }

  const handleImport = async () => {
    if (!importFile) {
      toast.error('请先选择要导入的文件')
      return
    }

    setImporting(true)
    setImportProgress(10)

    try {
      // 解析文件
      toast('正在解析文件...', { icon: 'ℹ️' })
      const parseResult = await parseFile(importFile)
      setImportProgress(30)

      if (!parseResult.success || !parseResult.data) {
        throw new Error(parseResult.errors?.join('; ') || '文件解析失败')
      }

      const questions = parseResult.data
      if (questions.length === 0) {
        throw new Error('文件中没有有效的题目数据')
      }

      // 显示解析结果
      if (parseResult.errors && parseResult.errors.length > 0) {
        toast(`解析完成，但有 ${parseResult.errors.length} 个错误：\n${parseResult.errors.slice(0, 3).join('\n')}${parseResult.errors.length > 3 ? '\n...' : ''}`, { icon: '⚠️' })
      }

      toast(`解析成功，共 ${questions.length} 道题目，开始导入...`, { icon: 'ℹ️' })
      setImportProgress(50)

      // 准备批量导入数据
      const questionsData = questions.map(q => ({
        content: q.content,
        question_type: q.question_type,
        options: q.options,
        answer: q.answer,
        knowledge_points: q.knowledge_points || [],
        explanation: q.explanation || ''
      }))

      setImportProgress(70)

      // 调用批量导入API
      const importResult = await questionsApi.bulkImport(questionsData)
      setImportProgress(90)

      // 处理导入结果
      const { success_count, fail_count, errors } = importResult.data
      
      if (success_count > 0) {
        toast.success(`导入完成！成功导入 ${success_count} 道题目${fail_count > 0 ? `，失败 ${fail_count} 道` : ''}`)
        loadQuestions() // 刷新题目列表
      }

      if (fail_count > 0 && errors && errors.length > 0) {
        console.error('导入错误详情:', errors)
        toast.error(`部分题目导入失败：\n${errors.slice(0, 3).join('\n')}${errors.length > 3 ? '\n...' : ''}`)
      }

    } catch (error: any) {
      console.error('批量导入错误:', error)
      toast.error(error.message || '批量导入失败')
    } finally {
      setImporting(false)
      setImportProgress(0)
      setShowImportModal(false)
      setImportFile(null)
    }
  }

  const downloadTemplate = () => {
    try {
      // 创建示例CSV内容
      const csvContent = `题目内容,题目类型,选项A,选项B,选项C,选项D,正确答案,知识点,解析
"以下哪个是JavaScript的数据类型？","single_choice","string","number","boolean","以上都是","D","JavaScript基础,数据类型","JavaScript有多种基本数据类型"
"JavaScript中var和let的区别是什么？","multiple_choice","var有函数作用域","let有块级作用域","var可以重复声明","let不可以重复声明","A,C","JavaScript基础,变量声明","var和let在作用域和声明方面有区别"`
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', '题目导入模板.csv')
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast.success('模板下载成功')
    } catch (error) {
      console.error('模板下载失败:', error)
      toast.error('模板下载失败，请稍后重试')
    }
  }

  // 搜索和筛选处理
  const handleSearch = (value: string) => {
    setSearchTerm(value)
    setCurrentPage(1) // 重置到第一页
  }

  const handleFilterChange = (value: string) => {
    setFilterType(value)
    setCurrentPage(1) // 重置到第一页
  }

  // 分页控制
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

  // 由于现在使用服务端分页，不需要客户端过滤
  const filteredQuestions = questions

  // 选择功能
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedQuestions([])
    } else {
      setSelectedQuestions(questions.map(q => q.id))
    }
    setSelectAll(!selectAll)
  }

  const handleSelectQuestion = (questionId: string) => {
    if (selectedQuestions.includes(questionId)) {
      setSelectedQuestions(selectedQuestions.filter(id => id !== questionId))
    } else {
      setSelectedQuestions([...selectedQuestions, questionId])
    }
  }

  // 批量删除
  const handleBatchDelete = () => {
    if (selectedQuestions.length === 0) {
      toast.error('请先选择要删除的题目')
      return
    }
    setIsBatchDelete(true)
    setShowDeleteModal(true)
  }

  const executeBatchDelete = async () => {
    try {
      // 批量删除API调用
      await Promise.all(selectedQuestions.map(id => questionsApi.delete(id)))
      toast.success(`成功删除 ${selectedQuestions.length} 道题目`)
      setSelectedQuestions([])
      setSelectAll(false)
      setShowDeleteModal(false)
      setIsBatchDelete(false)
      loadQuestions()
    } catch (error: any) {
      console.error('批量删除错误:', error)
      toast.error('批量删除失败')
    }
  }

  // 更新全选状态
  useEffect(() => {
    if (questions.length > 0) {
      setSelectAll(selectedQuestions.length === questions.length)
    }
  }, [selectedQuestions, questions])



  const getTypeLabel = (type: string) => {
    const typeMap = {
      'single_choice': '单选题',
      'multiple_choice': '多选题',
      'true_false': '判断题',
      'short_answer': '简答题'
    }
    return typeMap[type as keyof typeof typeMap] || type
  }

  if (loading) {
    return <LoadingSpinner text="加载题目列表..." />
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">题目管理</h1>
        <p className="text-gray-600 mt-1">管理考试题库中的所有题目</p>
      </div>

      {/* 操作栏 */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="flex flex-1 gap-4">
          {/* 搜索框 */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="搜索题目..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* 筛选器 */}
          <div className="flex gap-2">
            <select
              value={filterType}
              onChange={(e) => handleFilterChange(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">所有类型</option>
              <option value="single_choice">单选题</option>
              <option value="multiple_choice">多选题</option>
              <option value="true_false">判断题</option>
              <option value="short_answer">简答题</option>
            </select>


          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-2">
          {selectedQuestions.length > 0 && (
            <button
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
              onClick={handleBatchDelete}
            >
              <Trash2 className="w-5 h-5" />
              批量删除 ({selectedQuestions.length})
            </button>
          )}
          <button
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            onClick={() => setShowImportModal(true)}
          >
            <Upload className="w-5 h-5" />
            批量导入
          </button>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            onClick={() => navigate('/admin/question-create')}
          >
            <Plus className="w-5 h-5" />
            添加题目
          </button>
        </div>
      </div>

      {/* 题目列表 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">题目</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">类型</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">知识点</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建时间</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredQuestions.map((question) => (
                <tr key={question.id} className={`hover:bg-gray-50 ${selectedQuestions.includes(question.id) ? 'bg-blue-50' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <input
                      type="checkbox"
                      checked={selectedQuestions.includes(question.id)}
                      onChange={() => handleSelectQuestion(question.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {question.content}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {getTypeLabel(question.question_type)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {question.knowledge_points ? question.knowledge_points.join(', ') : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(question.created_at).toLocaleString('zh-CN')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button
                      className="text-blue-600 hover:text-blue-900"
                      onClick={() => navigate(`/admin/question-detail/${question.id}`)}
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <button
                      className="text-green-600 hover:text-green-900"
                      onClick={() => navigate(`/admin/question-edit/${question.id}`)}
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      className="text-red-600 hover:text-red-900"
                      onClick={() => {
                        setSelectedQuestion(question)
                        setShowDeleteModal(true)
                      }}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}

              {filteredQuestions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    <BookOpen className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    暂无题目
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
          totalItems={totalQuestions}
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
      {showDeleteModal && (isBatchDelete || selectedQuestion) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">确认删除</h3>
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setIsBatchDelete(false)
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-600 mb-4">
              {isBatchDelete 
                ? `确定要删除选中的 ${selectedQuestions.length} 道题目吗？此操作无法撤销。`
                : `确定要删除题目 ${selectedQuestion?.content}？此操作无法撤销。`
              }
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setIsBatchDelete(false)
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (isBatchDelete) {
                    executeBatchDelete()
                  } else if (selectedQuestion) {
                    handleDelete(selectedQuestion.id)
                  }
                }}
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 批量导入对话框 */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">批量导入题目</h3>
              <button
                onClick={() => {
                  setShowImportModal(false)
                  setImportFile(null)
                  setImportProgress(0)
                }}
                className="text-gray-400 hover:text-gray-500"
                disabled={importing}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* 导入说明 */}
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="text-sm font-medium text-blue-900 mb-2">导入说明</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• 支持Excel文件(.xlsx, .xls)和CSV文件(.csv)</li>
                <li>• 文件大小不能超过10MB</li>
                <li>• 请按照模板格式准备数据</li>
                <li>• 题目类型支持：single_choice(单选)、multiple_choice(多选)、true_false(判断)、short_answer(简答)</li>
              </ul>
            </div>

            {/* 下载模板 */}
            <div className="mb-6">
              <button
                onClick={downloadTemplate}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                下载导入模板
              </button>
            </div>

            {/* 文件选择 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                选择文件
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="import-file"
                  disabled={importing}
                />
                <label
                  htmlFor="import-file"
                  className="cursor-pointer flex flex-col items-center"
                >
                  <FileText className="w-12 h-12 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-600">
                    {importFile ? importFile.name : '点击选择文件或拖拽文件到此处'}
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    支持 .xlsx, .xls, .csv 格式
                  </span>
                </label>
              </div>
            </div>

            {/* 导入进度 */}
            {importing && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">导入进度</span>
                  <span className="text-sm text-gray-500">{importProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${importProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowImportModal(false)
                  setImportFile(null)
                  setImportProgress(0)
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={importing}
              >
                取消
              </button>
              <button
                onClick={handleImport}
                className="px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                disabled={!importFile || importing}
              >
                {importing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    导入中...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    开始导入
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default QuestionManagementPage