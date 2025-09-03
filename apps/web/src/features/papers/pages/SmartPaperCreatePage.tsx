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
import { Card, Button, Input, Select, Form, Checkbox, message } from 'antd'
import LoadingSpinner from '../../components/LoadingSpinner'
import { api } from '../../lib/api'

const { TextArea } = Input

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
    message.error(validationError)
    return
  }

  setGenerating(true)
  try {
    const response = await api.post('/papers/smart-generate', config)
    // 拦截器已把返回值规范化为 { success, data }
    if (response.success) {
      setGeneratedQuestions(response.data.questions || [])
      setStep('preview')
      message.success('智能组卷成功！')
    } else {
      // 一般不会进这个分支（失败时拦截器会 reject），留兜底即可
      message.error(response.error || '组卷失败')
    }
  } catch (error: any) {
    console.error('智能组卷错误:', error)
    message.error(error.response?.data?.error || error.message || '智能组卷失败')
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
        message.success('试卷创建成功！')
        navigate('/admin/papers')
      } else {
        message.error('创建试卷失败')
      }
    } catch (error: any) {
      console.error('创建试卷错误:', error)
      message.error(error.response?.data?.error || '创建试卷失败')
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
          <Card title="基本信息" className="mb-6">
            <Form layout="vertical">
              <Form.Item label="试卷标题" required>
                <Input
                  value={config.title}
                  onChange={(e) => handleConfigChange('title', e.target.value)}
                  placeholder="输入试卷标题"
                />
              </Form.Item>
              
              <Form.Item label="试卷说明">
                <TextArea
                  value={config.description}
                  onChange={(e) => handleConfigChange('description', e.target.value)}
                  placeholder="输入试卷说明"
                  rows={3}
                />
              </Form.Item>
              
              <div className="grid grid-cols-2 gap-4">
                <Form.Item label="考试时长（分钟）">
                  <Input
                    type="number"
                    min={1}
                    value={config.duration}
                    onChange={(e) => handleConfigChange('duration', parseInt(e.target.value))}
                  />
                </Form.Item>
                
                <Form.Item label="总分值">
                  <Input
                    type="number"
                    min={1}
                    value={config.totalScore}
                    onChange={(e) => handleConfigChange('totalScore', parseInt(e.target.value))}
                  />
                </Form.Item>
              </div>
              
              <Form.Item label="整体难度">
                <Select
                  value={config.difficulty}
                  onChange={(value) => handleConfigChange('difficulty', value)}
                  placeholder="选择难度"
                  style={{ width: '100%' }}
                  options={[
                    { label: '简单', value: 'easy' },
                    { label: '中等', value: 'medium' },
                    { label: '困难', value: 'hard' },
                    { label: '混合难度', value: 'mixed' }
                  ]}
                />
              </Form.Item>
            </Form>
          </Card>

          {/* 题目配置 */}
          <Card title="题目配置" className="mb-6">
            <Form layout="vertical">
              <Form.Item label="题目总数">
                <Input
                  type="number"
                  min={1}
                  value={config.totalQuestions}
                  onChange={(e) => handleConfigChange('totalQuestions', parseInt(e.target.value))}
                />
              </Form.Item>
              
              <Form.Item label="题型分布">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-sm mb-1">单选题</div>
                    <Input
                      type="number"
                      min={0}
                      value={config.questionTypes.single_choice}
                      onChange={(e) => handleQuestionTypeChange('single_choice', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <div className="text-sm mb-1">多选题</div>
                    <Input
                      type="number"
                      min={0}
                      value={config.questionTypes.multiple_choice}
                      onChange={(e) => handleQuestionTypeChange('multiple_choice', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <div className="text-sm mb-1">判断题</div>
                    <Input
                      type="number"
                      min={0}
                      value={config.questionTypes.true_false}
                      onChange={(e) => handleQuestionTypeChange('true_false', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <div className="text-sm mb-1">填空题</div>
                    <Input
                      type="number"
                      min={0}
                      value={config.questionTypes.fill_blank}
                      onChange={(e) => handleQuestionTypeChange('fill_blank', parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </Form.Item>
            </Form>
          </Card>

          {/* 难度分布 */}
          <Card title="难度分布" className="mb-6">
            <Form layout="vertical">
              <Form.Item label="设置各难度题目的百分比（总和应为100%）">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-sm mb-1">简单 (%)</div>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={config.difficultyDistribution.easy}
                      onChange={(e) => handleDifficultyDistributionChange('easy', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <div className="text-sm mb-1">中等 (%)</div>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={config.difficultyDistribution.medium}
                      onChange={(e) => handleDifficultyDistributionChange('medium', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <div className="text-sm mb-1">困难 (%)</div>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={config.difficultyDistribution.hard}
                      onChange={(e) => handleDifficultyDistributionChange('hard', parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>
                <div className="text-sm text-gray-500 mt-2">
                  当前总和: {Object.values(config.difficultyDistribution).reduce((sum, val) => sum + val, 0)}%
                </div>
              </Form.Item>
            </Form>
          </Card>

          {/* 知识点选择 */}
          <Card title="知识点筛选" className="mb-6">
            <Form layout="vertical">
              <Form.Item label="选择要包含的知识点（可选）">
                <div className="max-h-40 overflow-y-auto">
                  <Checkbox.Group
                    value={config.knowledgePoints}
                    onChange={(checkedValues) => handleConfigChange('knowledgePoints', checkedValues as string[])}
                  >
                    <div className="space-y-2">
                      {availableKnowledgePoints.map((point) => (
                        <div key={point}>
                          <Checkbox value={point}>{point}</Checkbox>
                        </div>
                      ))}
                    </div>
                  </Checkbox.Group>
                </div>
              </Form.Item>
            </Form>
          </Card>
        </div>

        <div className="flex justify-end space-x-4">
          <Button
            onClick={() => navigate('/admin/papers')}
          >
            取消
          </Button>
          <Button
            type="primary"
            onClick={generatePaper}
            loading={generating}
            icon={!generating ? <Shuffle className="w-4 h-4" /> : undefined}
          >
            开始组卷
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
              type="primary"
              onClick={handleSavePaper}
              loading={loading}
              icon={!loading ? <Save className="w-4 h-4" /> : undefined}
            >
              保存试卷
            </Button>
          </div>
        </div>

        {/* 试卷信息概览 */}
        <Card title={config.title} className="mb-6">
          <div className="mb-4 text-gray-600">{config.description}</div>
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
        </Card>

        {/* 题目列表 */}
        <Card title="题目列表" extra={`共 ${generatedQuestions.length} 道题目`} className="mb-6">
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
        </Card>
      </div>
    )
  }

  return null
}

export default SmartPaperCreatePage