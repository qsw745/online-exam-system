import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Textarea } from '../../components/ui/textarea'
import { Label } from '../../components/ui/label'
import { Select } from 'antd'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { api, papers } from '../../lib/api'
import { toast } from 'react-hot-toast'
import LoadingSpinner from '../../components/LoadingSpinner'

interface Paper {
  id: string
  title: string
  description: string
  total_score: number
  difficulty: 'easy' | 'medium' | 'hard'
  duration: number
  created_at: string
  updated_at: string
  questions?: any[]
}

export default function PaperCreatePage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [isViewMode, setIsViewMode] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  
  const [paperTitle, setPaperTitle] = useState('')
  const [paperDescription, setPaperDescription] = useState('')
  const [totalScore, setTotalScore] = useState(100)
  const [duration, setDuration] = useState(60)
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [questions, setQuestions] = useState<any[]>([])
  
  useEffect(() => {
    // 检查是否已登录
    const token = localStorage.getItem('token')
    
    if (!token) {
      toast.error('请先登录')
      navigate('/login')
      return
    }
    
    if (id) {
      // 如果有ID参数，判断是查看模式还是编辑模式
      const path = window.location.pathname
      if (path.includes('/paper-detail/')) {
        setIsViewMode(true)
        setIsEditMode(false)
      } else if (path.includes('/paper-edit/')) {
        setIsViewMode(false)
        setIsEditMode(true)
      }
      
      // 加载试卷详情
      fetchPaperDetail(id)
    } else {
      // 创建模式
      setIsViewMode(false)
      setIsEditMode(false)
      setLoading(false)
    }
  }, [id])
  
  const fetchPaperDetail = async (paperId: string) => {
    try {
      setLoading(true)
      const response = await papers.getById(paperId)
      
      if (response.success && response.data) {
        // 处理接口返回的数据结构，考虑到可能有paper这一层嵌套
        const paperData = response.data.paper || response.data
        setPaperTitle(paperData.title || '')
        setPaperDescription(paperData.description || '')
        setTotalScore(paperData.total_score || 100)
        setDuration(paperData.duration || 60)
        setDifficulty(paperData.difficulty || 'medium')
        
        // 如果有题目数据，加载题目
          if (paperData.questions) {
            setQuestions(paperData.questions)
          } else {
            // 如果没有题目数据，尝试获取题目
            try { 
            // 不再使用测试题目数据，直接从API获取
            
            // 尝试从API获取真实题目
              const questionsResponse = await papers.getQuestions(paperId)
            if (questionsResponse && questionsResponse.success && questionsResponse.data) {  
              // 确保正确处理返回的数据结构
              if (Array.isArray(questionsResponse.data)) {
                setQuestions(questionsResponse.data)
              } else if (questionsResponse.data.questions && Array.isArray(questionsResponse.data.questions)) {
                setQuestions(questionsResponse.data.questions)
              } else if (typeof questionsResponse.data === 'object') {
                // 如果数据是对象但不是预期的格式，尝试将其转换为数组
                const questionsArray = Object.values(questionsResponse.data)
                if (questionsArray.length > 0 && typeof questionsArray[0] === 'object') {
                  setQuestions(questionsArray)
                } else {
                  // 无法将对象转换为有效的题目数组
                }
              }
            }
          } catch (error) {
            console.error('获取试卷题目失败:', error)
            toast.error('获取试卷题目失败')
          }
        }
      } else {
        toast.error('获取试卷详情失败')
        navigate('/admin/papers')
      }
    } catch (error) {
      console.error('获取试卷详情错误:', error)
      toast.error('获取试卷详情失败')
      navigate('/admin/papers')
    } finally {
      setLoading(false)
    }
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 查看模式下不允许提交
    if (isViewMode) {
      return
    }
    
    // 表单验证
    if (!paperTitle.trim()) {
      toast.error('请输入试卷标题')
      return
    }
    
    const paperData = {
      title: paperTitle,
      description: paperDescription,
      total_score: totalScore,
      duration: duration,
      difficulty: difficulty,
    }
    
    try {
      setSubmitting(true)
      
      if (isEditMode) {
        // 编辑模式
        await papers.update(id!, paperData)
        toast.success('试卷更新成功')
      } else {
        // 创建模式
        await papers.create(paperData)
        toast.success('试卷创建成功')
      }
      
      // 返回试卷列表页
      navigate('/admin/papers')
    } catch (error) {
      console.error('保存试卷失败:', error)
      toast.error('保存试卷失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }
  
  const getPageTitle = () => {
    if (isViewMode) return '查看试卷'
    if (isEditMode) return '编辑试卷'
    return '创建试卷'
  }
  
  const getPageDescription = () => {
    if (isViewMode) return '查看试卷详细信息'
    if (isEditMode) return '编辑试卷信息'
    return '创建一个新的试卷'
  }
  
  if (loading) {
    return <LoadingSpinner text="加载试卷信息..." />
  }
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{getPageTitle()}</h1>
        <p className="text-gray-500 mt-1">{getPageDescription()}</p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
            <CardDescription>设置试卷的基本信息</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">试卷标题</Label>
                <Input
                  id="title"
                  value={paperTitle}
                  onChange={(e) => setPaperTitle(e.target.value)}
                  placeholder="输入试卷标题"
                  disabled={isViewMode}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">试卷说明</Label>
                <Textarea
                  id="description"
                  value={paperDescription}
                  onChange={(e) => setPaperDescription(e.target.value)}
                  placeholder="输入试卷说明"
                  disabled={isViewMode}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="duration">考试时长（分钟）</Label>
                  <Input
                    id="duration"
                    type="number"
                    min={1}
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value))}
                    disabled={isViewMode}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="total_score">总分值</Label>
                  <Input
                    id="total_score"
                    type="number"
                    min={1}
                    value={totalScore}
                    onChange={(e) => setTotalScore(parseInt(e.target.value))}
                    disabled={isViewMode}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="difficulty">试卷难度</Label>
                  <Select 
                    value={difficulty} 
                    onChange={(value: 'easy' | 'medium' | 'hard') => setDifficulty(value)}
                    disabled={isViewMode}
                    placeholder="选择难度"
                    className="w-full"
                    options={[
                      { label: '简单', value: 'easy' },
                      { label: '中等', value: 'medium' },
                      { label: '困难', value: 'hard' }
                    ]}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* 始终显示题目列表区域，无论是否有题目 */}
        <Card>
          <CardHeader>
            <CardTitle>试卷题目</CardTitle>
            <CardDescription>试卷包含的题目列表</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
                {questions.map((question, index) => (
                  <div key={question.id} className="p-4 rounded-lg border border-gray-200">
                    <div className="flex items-start">
                      <div className="mr-2 font-medium">{index + 1}.</div>
                      <div className="flex-1">
                        <h3 className="font-medium">{question.question_content}</h3>
                        <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                          <span>类型: {question.question_type}</span>
                          <span>分值: {question.score}分</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        
        <div className="flex justify-end space-x-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => navigate('/admin/papers')}
          >
            {isViewMode ? '返回列表' : '取消'}
          </Button>
          
          {!isViewMode && (
            <Button type="submit" disabled={submitting}>
              {submitting ? '保存中...' : isEditMode ? '更新试卷' : '创建试卷'}
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}