import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, 
  Settings, 
  Shuffle, 
  CheckCircle, 
  AlertCircle,
  Eye,
  Save
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Textarea } from '../../components/ui/textarea'
import { Select } from 'antd'
import LoadingSpinner from '../../components/LoadingSpinner'
import toast from 'react-hot-toast'
import { api } from '../../lib/api'

interface Question {
  id: number
  content: string
  question_type: string
  difficulty: string
  score: number
  knowledge_points?: string[]
}

interface SmartPaperConfig {
  title: string
  description: string
  duration: number
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed'
  totalQuestions: number
  questionTypes: {
    single_choice: number
    multiple_choice: number
    true_false: number
    fill_blank: number
    essay: number
  }
  difficultyDistribution: {
    easy: number
    medium: number
    hard: number
  }
  knowledgePoints: string[]
  totalScore: number
}

const SmartPaperCreatePage: React.FC = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [step, setStep] = useState<'config' | 'preview' | 'result'>('config')
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([])
  const [availableKnowledgePoints, setAvailableKnowledgePoints] = useState<string[]>([])
  
  const [config, setConfig] = useState<SmartPaperConfig>({
    title: '',
    description: '',
    duration: 60,
    difficulty: 'mixed',
    totalQuestions: 20,
    questionTypes: {
      single_choice: 10,
      multiple_choice: 5,
      true_false: 3,
      fill_blank: 2,
      essay: 0
    },
    difficultyDistribution: {
      easy: 30,
      medium: 50,
      hard: 20
    },
    knowledgePoints: [],
    totalScore: 100
  })

  useEffect(() => {
    loadKnowledgePoints()
  }, [])

// 1) 加载知识点
const loadKnowledgePoints = async () => {
  try {
    const response = await api.get('/questions/knowledge-points')
    if (response.success) {
      setAvailableKnowledgePoints(response.data || [])
    }
  } catch (error) {
    console.error('加载知识点失败:', error)
  }
}

  const handleConfigChange = (field: keyof SmartPaperConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }))
  }

  const handleQuestionTypeChange = (type: keyof SmartPaperConfig['questionTypes'], value: number) => {
    setConfig(prev => ({
      ...prev,
      questionTypes: {
        ...prev.questionTypes,
        [type]: value
      }
    }))
  }

  const handleDifficultyDistributionChange = (difficulty: keyof SmartPaperConfig['difficultyDistribution'], value: number) => {
    setConfig(prev => ({
      ...prev,
      difficultyDistribution: {
        ...prev.difficultyDistribution,
        [difficulty]: value
      }
    }))
  }

  const validateConfig = (): string | null => {
    if (!config.title.trim()) return '请输入试卷标题'
    if (config.totalQuestions <= 0) return '题目总数必须大于0'
    if (config.totalScore <= 0) return '总分必须大于0'
    
    const totalTypeQuestions = Object.values(config.questionTypes).reduce((sum, count) => sum + count, 0)
    if (totalTypeQuestions !== config.totalQuestions) {
      return `题型分布总数(${totalTypeQuestions})与题目总数(${config.totalQuestions})不匹配`
    }
    
    const totalDifficultyPercent = Object.values(config.difficultyDistribution).reduce((sum, percent) => sum + percent, 0)
    if (Math.abs(totalDifficultyPercent - 100) > 0.1) {
      return `难度分布总和必须为100%(当前为${totalDifficultyPercent}%)`
    }
    
    return null
  }

const generatePaper = async () => {
  const validationError = validateConfig()
  if (validationError) {
    toast.error(validationError)
    return
  }

  setGenerating(true)
  try {
    const response = await api.post('/papers/smart-generate', config)
    // 拦截器已把返回值规范化为 { success, data }
    if (response.success) {
      setGeneratedQuestions(response.data.questions || [])
      setStep('preview')
      toast.success('智能组卷成功！')
    } else {
      // 一般不会进这个分支（失败时拦截器会 reject），留兜底即可
      toast.error(response.error || '组卷失败')
    }
  } catch (error: any) {
    console.error('智能组卷错误:', error)
    toast.error(error.response?.data?.error || error.message || '智能组卷失败')
  } finally {
    setGenerating(false)
  }
}


  const savePaper = async () => {
    setLoading(true)
    try {
      const paperData = {
        title: config.title,
        description: config.description,
        duration: config.duration,
        difficulty: config.difficulty === 'mixed' ? 'medium' : config.difficulty,
        total_score: config.totalScore,
        questions: generatedQuestions.map((q, index) => ({
          question_id: q.id,
          score: q.score,
          order: index + 1
        }))
      }
      
      const response = await api.post('/papers/create-with-questions', paperData)
      if (response.success) {
        toast.success('试卷创建成功！')
        navigate('/admin/papers')
      } else {
        toast.error('创建试卷失败')
      }
    } catch (error: any) {
      console.error('创建试卷错误:', error)
      toast.error(error.response?.data?.error || '创建试卷失败')
    } finally {
      setLoading(false)
    }
  }

  const regenerateQuestions = () => {
    generatePaper()
  }

  if (step === 'config') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/admin/papers')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            返回
          </Button>
          <div>
            <h1 className="text-2xl font-bold">智能组卷</h1>
            <p className="text-gray-500 mt-1">根据配置自动从题库中选择题目组成试卷</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 基本信息 */}
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
              <CardDescription>设置试卷的基本信息</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">试卷标题</Label>
                <Input
                  id="title"
                  value={config.title}
                  onChange={(e) => handleConfigChange('title', e.target.value)}
                  placeholder="输入试卷标题"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">试卷说明</Label>
                <Textarea
                  id="description"
                  value={config.description}
                  onChange={(e) => handleConfigChange('description', e.target.value)}
                  placeholder="输入试卷说明"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="duration">考试时长（分钟）</Label>
                  <Input
                    id="duration"
                    type="number"
                    min={1}
                    value={config.duration}
                    onChange={(e) => handleConfigChange('duration', parseInt(e.target.value))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="totalScore">总分值</Label>
                  <Input
                    id="totalScore"
                    type="number"
                    min={1}
                    value={config.totalScore}
                    onChange={(e) => handleConfigChange('totalScore', parseInt(e.target.value))}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="difficulty">整体难度</Label>
                <Select
                  id="difficulty"
                  value={config.difficulty}
                  onChange={(value) => handleConfigChange('difficulty', value)}
                  placeholder="选择难度"
                  className="w-full"
                  options={[
                    { label: '简单', value: 'easy' },
                    { label: '中等', value: 'medium' },
                    { label: '困难', value: 'hard' },
                    { label: '混合难度', value: 'mixed' }
                  ]}
                />
              </div>
            </CardContent>
          </Card>

          {/* 题目配置 */}
          <Card>
            <CardHeader>
              <CardTitle>题目配置</CardTitle>
              <CardDescription>设置题目数量和类型分布</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="totalQuestions">题目总数</Label>
                <Input
                  id="totalQuestions"
                  type="number"
                  min={1}
                  value={config.totalQuestions}
                  onChange={(e) => handleConfigChange('totalQuestions', parseInt(e.target.value))}
                />
              </div>
              
              <div className="space-y-3">
                <Label>题型分布</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm">单选题</Label>
                    <Input
                      type="number"
                      min={0}
                      value={config.questionTypes.single_choice}
                      onChange={(e) => handleQuestionTypeChange('single_choice', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">多选题</Label>
                    <Input
                      type="number"
                      min={0}
                      value={config.questionTypes.multiple_choice}
                      onChange={(e) => handleQuestionTypeChange('multiple_choice', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">判断题</Label>
                    <Input
                      type="number"
                      min={0}
                      value={config.questionTypes.true_false}
                      onChange={(e) => handleQuestionTypeChange('true_false', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">填空题</Label>
                    <Input
                      type="number"
                      min={0}
                      value={config.questionTypes.fill_blank}
                      onChange={(e) => handleQuestionTypeChange('fill_blank', parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 难度分布 */}
          <Card>
            <CardHeader>
              <CardTitle>难度分布</CardTitle>
              <CardDescription>设置各难度题目的百分比（总和应为100%）</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm">简单 (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={config.difficultyDistribution.easy}
                    onChange={(e) => handleDifficultyDistributionChange('easy', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">中等 (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={config.difficultyDistribution.medium}
                    onChange={(e) => handleDifficultyDistributionChange('medium', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">困难 (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={config.difficultyDistribution.hard}
                    onChange={(e) => handleDifficultyDistributionChange('hard', parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div className="text-sm text-gray-500">
                当前总和: {Object.values(config.difficultyDistribution).reduce((sum, val) => sum + val, 0)}%
              </div>
            </CardContent>
          </Card>

          {/* 知识点选择 */}
          <Card>
            <CardHeader>
              <CardTitle>知识点筛选</CardTitle>
              <CardDescription>选择要包含的知识点（可选）</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>可选知识点</Label>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {availableKnowledgePoints.map((point) => (
                    <label key={point} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={config.knowledgePoints.includes(point)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            handleConfigChange('knowledgePoints', [...config.knowledgePoints, point])
                          } else {
                            handleConfigChange('knowledgePoints', config.knowledgePoints.filter(p => p !== point))
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{point}</span>
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end space-x-4">
          <Button
            variant="outline"
            onClick={() => navigate('/admin/papers')}
          >
            取消
          </Button>
          <Button
            onClick={generatePaper}
            disabled={generating}
            className="flex items-center gap-2"
          >
            {generating ? (
              <LoadingSpinner />
            ) : (
              <Shuffle className="w-4 h-4" />
            )}
            {generating ? '生成中...' : '开始组卷'}
          </Button>
        </div>
      </div>
    )
  }

  if (step === 'preview') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => setStep('config')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              返回配置
            </Button>
            <div>
              <h1 className="text-2xl font-bold">试卷预览</h1>
              <p className="text-gray-500 mt-1">检查生成的试卷内容</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={regenerateQuestions}
              disabled={generating}
              className="flex items-center gap-2"
            >
              {generating ? (
                <LoadingSpinner />
              ) : (
                <Shuffle className="w-4 h-4" />
              )}
              {generating ? '重新生成中...' : '重新生成'}
            </Button>
            <Button
              onClick={savePaper}
              disabled={loading}
              className="flex items-center gap-2"
            >
              {loading ? (
                <LoadingSpinner />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {loading ? '保存中...' : '保存试卷'}
            </Button>
          </div>
        </div>

        {/* 试卷信息概览 */}
        <Card>
          <CardHeader>
            <CardTitle>{config.title}</CardTitle>
            <CardDescription>{config.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">考试时长:</span>
                <span className="ml-2 font-medium">{config.duration}分钟</span>
              </div>
              <div>
                <span className="text-gray-500">题目总数:</span>
                <span className="ml-2 font-medium">{generatedQuestions.length}题</span>
              </div>
              <div>
                <span className="text-gray-500">总分:</span>
                <span className="ml-2 font-medium">{config.totalScore}分</span>
              </div>
              <div>
                <span className="text-gray-500">平均分值:</span>
                <span className="ml-2 font-medium">{(config.totalScore / generatedQuestions.length).toFixed(1)}分/题</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 题目列表 */}
        <Card>
          <CardHeader>
            <CardTitle>题目列表</CardTitle>
            <CardDescription>共 {generatedQuestions.length} 道题目</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {generatedQuestions.map((question, index) => (
                <div key={question.id} className="p-4 rounded-lg border border-gray-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium">第{index + 1}题</span>
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                          {question.question_type}
                        </span>
                        <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">
                          {question.difficulty}
                        </span>
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                          {question.score}分
                        </span>
                      </div>
                      <div className="text-gray-900">
                        {question.content}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}

export default SmartPaperCreatePage