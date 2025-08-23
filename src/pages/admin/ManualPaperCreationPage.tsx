import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Textarea } from '../../components/ui/textarea'
import { Label } from '../../components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { api, exams } from '../../lib/api'
import { toast } from '../../components/ui/use-toast'
import LoadingSpinner from '../../components/LoadingSpinner'

interface Question {
  id: string
  content: string
  type: string
  difficulty: string
  score: number
  knowledge_points: string[]
}

export default function ManualPaperCreationPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [questions, setQuestions] = useState<Question[]>([])
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([])
  const [paperTitle, setPaperTitle] = useState('')
  const [paperDescription, setPaperDescription] = useState('')
  const [totalScore, setTotalScore] = useState(0)
  const [duration, setDuration] = useState(60)
  const [difficulty, setDifficulty] = useState('medium')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedType, setSelectedType] = useState('all')
  const [selectedDifficulty, setSelectedDifficulty] = useState('all')
  
  useEffect(() => {
    loadQuestions()
  }, [searchKeyword, selectedType, selectedDifficulty])
  
  const loadQuestions = async () => {
    try {
      setLoading(true)
      const response = await api.questions.list({
        keyword: searchKeyword,
        type: selectedType === 'all' ? undefined : selectedType,
        difficulty: selectedDifficulty === 'all' ? undefined : selectedDifficulty
      })
      setQuestions(response.data)
    } catch (error) {
      console.error('加载题目失败:', error)
      toast({
        variant: 'destructive',
        title: '错误',
        description: '加载题目失败，请重试'
      })
    } finally {
      setLoading(false)
    }
  }
  
  const handleQuestionSelect = (questionId: string) => {
    setSelectedQuestions(prev => {
      if (prev.includes(questionId)) {
        return prev.filter(id => id !== questionId)
      } else {
        return [...prev, questionId]
      }
    })
  }
  
  const calculateTotalScore = () => {
    return questions
      .filter(q => selectedQuestions.includes(q.id))
      .reduce((total, q) => total + q.score, 0)
  }
  
  const handleCreatePaper = async () => {
    if (!paperTitle) {
      toast({
        variant: 'destructive',
        title: '错误',
        description: '请输入试卷标题'
      })
      return
    }
    
    if (selectedQuestions.length === 0) {
      toast({
        variant: 'destructive',
        title: '错误',
        description: '请至少选择一道题目'
      })
      return
    }
    
    try {
      setLoading(true)
      await api.papers.create({
        title: paperTitle,
        description: paperDescription,
        duration,
        difficulty,
        total_score: calculateTotalScore(),
        question_ids: selectedQuestions
      })
      
      toast({
        title: '成功',
        description: '试卷创建成功'
      })
      
      navigate('/admin/papers')
    } catch (error) {
      console.error('创建试卷失败:', error)
      toast({
        variant: 'destructive',
        title: '错误',
        description: '创建试卷失败，请重试'
      })
    } finally {
      setLoading(false)
    }
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">手动组卷</h1>
        <p className="text-gray-500 mt-1">从题库中选择题目创建试卷</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧题目列表 */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>题目列表</CardTitle>
              <CardDescription>从下方选择要添加到试卷的题目</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* 搜索和筛选 */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <Input
                    placeholder="搜索题目..."
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    className="flex-1"
                  />
                  <Select 
                    value={selectedType} 
                    onChange={setSelectedType}
                    placeholder="题目类型"
                    className="w-[180px]"
                    options={[
                      { label: '全部类型', value: 'all' },
                      { label: '单选题', value: 'single' },
                      { label: '多选题', value: 'multiple' },
                      { label: '判断题', value: 'judge' }
                    ]}
                  />
                  <Select 
                    value={selectedDifficulty} 
                    onChange={setSelectedDifficulty}
                    placeholder="难度"
                    className="w-[180px]"
                    options={[
                      { label: '全部难度', value: 'all' },
                      { label: '简单', value: 'easy' },
                      { label: '中等', value: 'medium' },
                      { label: '困难', value: 'hard' }
                    ]}
                  />
                </div>
                
                {/* 题目列表 */}
                <div className="space-y-4">
                  {questions.map((question) => (
                    <div
                      key={question.id}
                      className={`p-4 rounded-lg border ${selectedQuestions.includes(question.id) ? 'border-primary bg-primary/5' : 'border-gray-200'}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium">{question.content}</h3>
                          <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                            <span>类型: {question.type}</span>
                            <span>难度: {question.difficulty}</span>
                            <span>分值: {question.score}分</span>
                          </div>
                          {question.knowledge_points.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {question.knowledge_points.map((point, index) => (
                                <span
                                  key={index}
                                  className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700"
                                >
                                  {point}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <Button
                          variant={selectedQuestions.includes(question.id) ? 'destructive' : 'secondary'}
                          size="sm"
                          onClick={() => handleQuestionSelect(question.id)}
                        >
                          {selectedQuestions.includes(question.id) ? '移除' : '添加'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* 右侧试卷信息 */}
        <Card>
          <CardHeader>
            <CardTitle>试卷信息</CardTitle>
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
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">试卷说明</Label>
                <Textarea
                  id="description"
                  value={paperDescription}
                  onChange={(e) => setPaperDescription(e.target.value)}
                  placeholder="输入试卷说明"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="duration">考试时长（分钟）</Label>
                <Input
                  id="duration"
                  type="number"
                  min={1}
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="difficulty">试卷难度</Label>
                <Select 
                  value={difficulty} 
                  onChange={setDifficulty}
                  placeholder="选择难度"
                  className="w-full"
                  options={[
                    { label: '简单', value: 'easy' },
                    { label: '中等', value: 'medium' },
                    { label: '困难', value: 'hard' }
                  ]}
                />
              </div>
              
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span>已选题目数</span>
                  <span className="font-medium">{selectedQuestions.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span>总分</span>
                  <span className="font-medium">{calculateTotalScore()}分</span>
                </div>
              </div>
              
              <Button
                className="w-full mt-6"
                onClick={handleCreatePaper}
                disabled={loading}
              >
                创建试卷
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}