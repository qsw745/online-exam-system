import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Plus, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { questions as questionsApi } from '../../lib/api'
import LoadingSpinner from '../../components/LoadingSpinner'

interface Option {
  content: string
  is_correct: boolean
}

const QuestionCreatePage: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(false)
  const [content, setContent] = useState('')
  const [type, setType] = useState('single_choice')
  const [options, setOptions] = useState<Option[]>([
    { content: '', is_correct: false },
    { content: '', is_correct: false },
    { content: '', is_correct: false },
    { content: '', is_correct: false }
  ])
  const [answer, setAnswer] = useState('')
  const [explanation, setExplanation] = useState('')
  const [knowledgePoints, setKnowledgePoints] = useState<string[]>([])
  const [knowledgePointInput, setKnowledgePointInput] = useState('')
  const [isViewMode, setIsViewMode] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  
  // 根据路由判断当前模式
  useEffect(() => {
    if (id) {
      const path = window.location.pathname
      if (path.includes('question-detail')) {
        setIsViewMode(true)
      } else if (path.includes('question-edit')) {
        setIsEditMode(true)
      }
      
      // 获取题目详情
      fetchQuestionDetail(id)
    }
  }, [id])
  
  // 获取题目详情
  const fetchQuestionDetail = async (questionId: string) => {
    try {
      setInitialLoading(true)
      const response = await questionsApi.getById(questionId)
      const question = response.data.question
      
      if (question) {
        setContent(question.content || '')
        setType(question.question_type || 'single_choice')
        setExplanation(question.explanation || '')
        setKnowledgePoints(question.knowledge_points || [])
        
        // 处理选项和答案
        if (question.options && Array.isArray(question.options)) {
          setOptions(question.options)
        }
        
        if (question.question_type === 'true_false') {
          // 判断题答案处理
          if (question.correct_answer && Array.isArray(question.correct_answer)) {
            setAnswer(question.correct_answer[0] === 0 ? 'true' : 'false')
          }
        } else if (question.question_type === 'short_answer') {
          // 简答题答案处理
          setAnswer(question.answer || '')
        }
      }
    } catch (error: any) {
      console.error('获取题目详情错误:', error)
      toast.error(error.message || '获取题目详情失败')
    } finally {
      setInitialLoading(false)
    }
  }

  const handleOptionChange = (index: number, field: keyof Option, value: string | boolean) => {
    const newOptions = [...options]
    newOptions[index] = { ...newOptions[index], [field]: value }
    
    // 如果是单选题，确保只有一个选项被标记为正确
    if (type === 'single_choice' && field === 'is_correct' && value === true) {
      newOptions.forEach((option, i) => {
        if (i !== index) {
          newOptions[i] = { ...option, is_correct: false }
        }
      })
    }
    
    setOptions(newOptions)
  }

  const addOption = () => {
    setOptions([...options, { content: '', is_correct: false }])
  }

  const removeOption = (index: number) => {
    if (options.length <= 2) {
      toast.error('至少需要两个选项')
      return
    }
    const newOptions = [...options]
    newOptions.splice(index, 1)
    setOptions(newOptions)
  }

  const addKnowledgePoint = () => {
    if (!knowledgePointInput.trim()) return
    if (knowledgePoints.includes(knowledgePointInput.trim())) {
      toast.error('知识点已存在')
      return
    }
    setKnowledgePoints([...knowledgePoints, knowledgePointInput.trim()])
    setKnowledgePointInput('')
  }

  const removeKnowledgePoint = (index: number) => {
    const newPoints = [...knowledgePoints]
    newPoints.splice(index, 1)
    setKnowledgePoints(newPoints)
  }

  // 表单提交处理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) {
      toast.error('请输入题目内容')
      return
    }
    
    // 选择题验证
    if (type === 'single_choice' || type === 'multiple_choice') {
      // 检查是否有空选项
      const hasEmptyOption = options.some(option => !option.content.trim())
      if (hasEmptyOption) {
        toast.error('选项内容不能为空')
        return
      }
      
      // 检查是否有正确选项
      const hasCorrectOption = options.some(option => option.is_correct)
      if (!hasCorrectOption) {
        toast.error('请至少选择一个正确选项')
        return
      }
    }
    
    // 判断题验证
    if (type === 'true_false' && !answer) {
      toast.error('请选择正确答案')
      return
    }
    
    // 简答题验证
    if (type === 'short_answer' && !answer.trim()) {
      toast.error('请输入参考答案')
      return
    }
    
    try {
      setLoading(true)
      
      // 准备提交数据
      const questionData: any = {
        content,
        question_type: type, // 映射为后端字段名
        knowledge_points: knowledgePoints,
        explanation,
        exam_id: 1, // 默认使用ID为1的考试
        score: 10 // 默认分值
      }
      
      // 根据题目类型设置答案
      if (type === 'single_choice' || type === 'multiple_choice') {
        questionData.options = JSON.stringify(options)
        questionData.correct_answer = JSON.stringify(
          options
            .map((option, index) => option.is_correct ? index : null)
            .filter(index => index !== null)
        )
      } else if (type === 'true_false') {
        questionData.options = JSON.stringify([{ content: '正确' }, { content: '错误' }])
        questionData.correct_answer = JSON.stringify([answer === 'true' ? 0 : 1])
      } else if (type === 'short_answer') {
        questionData.options = JSON.stringify([])
        questionData.correct_answer = JSON.stringify(answer)
      }
      
      if (isEditMode && id) {
        // 提交更新请求
        await questionsApi.update(id, questionData)
        toast.success('题目更新成功')
      } else {
        // 提交创建请求
        await questionsApi.create(questionData)
        toast.success('题目创建成功')
      }
      
      navigate('/admin/questions')
    } catch (error: any) {
      console.error(isEditMode ? '更新题目错误:' : '创建题目错误:', error)
      toast.error(error.message || (isEditMode ? '更新题目失败' : '创建题目失败'))
    } finally {
      setLoading(false)
    }
  }

  // 获取页面标题
  const getPageTitle = () => {
    if (isViewMode) return '查看题目'
    if (isEditMode) return '编辑题目'
    return '创建新题目'
  }

  // 获取页面描述
  const getPageDescription = () => {
    if (isViewMode) return '查看题目详细信息'
    if (isEditMode) return '修改现有题目信息'
    return '添加新的考试题目到题库'
  }

  if (initialLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="flex justify-center items-center min-h-[300px]">
          <LoadingSpinner size={40} />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{getPageTitle()}</h1>
          <p className="text-gray-600 mt-1">{getPageDescription()}</p>
        </div>
        <button
          onClick={() => navigate('/admin/questions')}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          返回题目列表
        </button>
      </div>

      {/* 创建表单 */}
      <form onSubmit={isViewMode ? (e) => e.preventDefault() : handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="space-y-6">
          {/* 基本信息 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="type" className="block text-sm font-medium text-gray-700">题目类型 *</label>
                <select
                  id="type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isViewMode}
                >
                  <option value="single_choice">单选题</option>
                  <option value="multiple_choice">多选题</option>
                  <option value="true_false">判断题</option>
                  <option value="short_answer">简答题</option>
                </select>
              </div>


            </div>
          </div>

          {/* 题目内容 */}
          <div className="space-y-2">
            <label htmlFor="content" className="block text-sm font-medium text-gray-700">题目内容</label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[100px]"
              placeholder="输入题目内容"
              required
              disabled={isViewMode}
              readOnly={isViewMode}
            />
          </div>

          {/* 选择题选项 */}
          {(type === 'single_choice' || type === 'multiple_choice') && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">选项 *</label>
                <button
                  type="button"
                  onClick={addOption}
                  className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                  disabled={isViewMode}
                >
                  <Plus className="w-4 h-4" />
                  添加选项
                </button>
              </div>
              
              <div className="space-y-3">
                {options.map((option, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex-1 flex items-center gap-3">
                      <input
                    type={type === 'single_choice' ? 'radio' : 'checkbox'}
                    checked={option.is_correct}
                    onChange={(e) => handleOptionChange(index, 'is_correct', e.target.checked)}
                    className="w-5 h-5 text-blue-600 focus:ring-blue-500"
                    disabled={isViewMode}
                  />
                      <input
                    type="text"
                    value={option.content}
                    onChange={(e) => handleOptionChange(index, 'content', e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={`选项 ${index + 1}`}
                    disabled={isViewMode}
                    readOnly={isViewMode}
                  />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      className="p-2 text-red-500 hover:text-red-700 transition-colors"
                      disabled={isViewMode}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 判断题答案 */}
          {type === 'true_false' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">正确答案 *</label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="true_false"
                    value="true"
                    checked={answer === 'true'}
                    onChange={() => setAnswer('true')}
                    className="w-5 h-5 text-blue-600 focus:ring-blue-500"
                    disabled={isViewMode}
                  />
                  <span>正确</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="true_false"
                    value="false"
                    checked={answer === 'false'}
                    onChange={() => setAnswer('false')}
                    className="w-5 h-5 text-blue-600 focus:ring-blue-500"
                    disabled={isViewMode}
                  />
                  <span>错误</span>
                </label>
              </div>
            </div>
          )}

          {/* 简答题答案 */}
          {type === 'short_answer' && (
            <div className="space-y-2">
              <label htmlFor="answer" className="block text-sm font-medium text-gray-700">参考答案 *</label>
              <textarea
                id="answer"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[100px]"
                placeholder="输入参考答案"
                disabled={isViewMode}
                readOnly={isViewMode}
              />
            </div>
          )}

          {/* 解析 */}
          <div className="space-y-2">
            <label htmlFor="explanation" className="block text-sm font-medium text-gray-700">题目解析</label>
            <textarea
              id="explanation"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[100px]"
              placeholder="输入题目解析（可选）"
              disabled={isViewMode}
              readOnly={isViewMode}
            />
          </div>

          {/* 知识点 */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">知识点</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={knowledgePointInput}
                onChange={(e) => setKnowledgePointInput(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="输入知识点"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKnowledgePoint())}
                disabled={isViewMode}
              />
              <button
                type="button"
                onClick={addKnowledgePoint}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                disabled={isViewMode}
              >
                添加
              </button>
            </div>
            
            {knowledgePoints.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {knowledgePoints.map((point, index) => (
                  <div key={index} className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full">
                    <span>{point}</span>
                    <button
                      type="button"
                      onClick={() => removeKnowledgePoint(index)}
                      className="text-blue-500 hover:text-blue-700"
                      disabled={isViewMode}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 提交按钮 */}
          <div className="flex justify-end pt-4 border-t border-gray-200">
            {!isViewMode && (
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-5 h-5" />
                {loading ? '保存中...' : isEditMode ? '更新题目' : '保存题目'}
              </button>
            )}
            {isViewMode && (
              <button
                type="button"
                onClick={() => navigate('/admin/questions')}
                className="flex items-center gap-2 px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                返回列表
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}

export default QuestionCreatePage