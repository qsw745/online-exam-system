import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { Search, Filter, Heart, Eye, Clock, BookmarkPlus, Play, Plus, Upload } from 'lucide-react'
import { Spin, Card, Input, Select, Button, Space, Row, Col, Tag, Empty, Typography, Pagination, Modal, Form, Radio, Progress, Divider } from 'antd'
import { Link, useLocation } from 'react-router-dom'
import { message } from 'antd'
import * as apiModule from '../lib/api'
import { createPaginationConfig } from '../constants/pagination'
import * as XLSX from 'xlsx'

const { questions, favorites: favoritesApi } = apiModule
const { Title, Text } = Typography

interface Question {
  id: string
  content: string
  type: string
  difficulty: string
  knowledge_point: string
  created_at: string
  updated_at: string
}

interface State {
  questions: Question[]
  loading: boolean
  searchTerm: string
  filterType: string
  filterDifficulty: string
}

interface PaginationState {
  currentPage: number
  totalPages: number
  totalQuestions: number
  pageSize: number
}

const QuestionsPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth()
  const { t, language } = useLanguage()
  const location = useLocation()
  const [state, setState] = useState<State>({
    questions: [],
    loading: true,
    searchTerm: '',
    filterType: 'all',
    filterDifficulty: 'all'
  })
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    totalPages: 1,
    totalQuestions: 0,
    pageSize: 12
  })
  const [favorites, setFavorites] = useState<Set<string>>(new Set())

  // 新增题目相关状态
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm] = Form.useForm()
  const [addLoading, setAddLoading] = useState(false)
  const [questionType, setQuestionType] = useState('single_choice')
  const [optionCount, setOptionCount] = useState(4)

  // 批量导入相关状态
  const [showImportModal, setShowImportModal] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importProgress, setImportProgress] = useState(0)

  // 根据路由确定当前视图类型
  const getViewType = () => {
    const path = location.pathname
    if (path.includes('/favorites')) return 'favorites'
    if (path.includes('/wrong')) return 'wrong'
    if (path.includes('/browse')) return 'browse'
    if (path.includes('/manage')) return 'manage'
    return 'all'
  }

  const viewType = getViewType()

  useEffect(() => {
    // 调试信息
    console.log('QuestionsPage useEffect - 认证状态:', {
      authLoading,
      user: user ? { id: user.id, email: user.email, role: user.role } : null,
      localStorage_token: localStorage.getItem('token') ? 'exists' : 'missing',
      sessionStorage_token: sessionStorage.getItem('token') ? 'exists' : 'missing'
    });
    
    // 只有在认证状态确定且用户已登录时才加载数据
    if (!authLoading && user) {
      loadQuestions()
      loadFavorites()
    } else if (!authLoading && !user) {
      // 认证状态确定但用户未登录，清除加载状态
      setState(prev => ({ ...prev, loading: false }))
    }
  }, [viewType, pagination.currentPage, pagination.pageSize, state.filterType, state.filterDifficulty, state.searchTerm, user, authLoading])

  const loadQuestions = async () => {
    // 检查认证状态是否还在加载中
    if (authLoading) {
      return
    }
    
    // 检查用户是否已登录
    if (!user) {
      setState(prev => ({ ...prev, loading: false }))
      // 不显示错误提示，因为页面会显示登录提示
      return
    }
    
    try {
      setState(prev => ({ ...prev, loading: true }))
      let response
      
      if (viewType === 'favorites') {
        // 加载收藏的题目
        response = await favoritesApi.list()
        const favoriteQuestions = response.data.favorites?.map(f => f.question).filter(q => q && q.id) || []
        setState(prev => ({
          ...prev,
          questions: favoriteQuestions,
          loading: false
        }))
        // 收藏题目暂时不支持分页
        setPagination(prev => ({
          ...prev,
          totalQuestions: favoriteQuestions.length,
          totalPages: 1
        }))
      } else if (viewType === 'wrong') {
        // 加载错题（暂时显示空列表，后续可以添加错题API）
        setState(prev => ({
          ...prev,
          questions: [],
          loading: false
        }))
        setPagination(prev => ({
          ...prev,
          totalQuestions: 0,
          totalPages: 1
        }))
        message.info('错题本功能正在开发中')
      } else {
        // 加载全部题目
        response = await questions.list({
          type: state.filterType === 'all' ? undefined : state.filterType,
          difficulty: state.filterDifficulty === 'all' ? undefined : state.filterDifficulty,
          search: state.searchTerm || undefined,
          page: pagination.currentPage,
          limit: pagination.pageSize
        })
        
        setState(prev => ({
          ...prev,
          questions: response.data.questions || [],
          loading: false
        }))
        
        // 更新分页信息
        if (response.data.pagination) {
          setPagination(prev => ({
            ...prev,
            totalPages: response.data.pagination.totalPages,
            totalQuestions: response.data.pagination.total
          }))
        }
      }
    } catch (error: any) {
      console.error('加载题目错误:', error)
      
      // 检查是否是认证错误
      if (error.message === 'AUTHENTICATION_REQUIRED' || error.response?.status === 401) {
        message.error('登录已过期，请重新登录')
        // 清除本地认证状态
        localStorage.removeItem('token')
        sessionStorage.removeItem('token')
        localStorage.removeItem('userRole')
        sessionStorage.removeItem('userRole')
        // 刷新页面以触发AuthContext重新检查认证状态
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      } else {
        const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || '获取题目列表失败'
        message.error(errorMessage)
      }
      
      setState(prev => ({ ...prev, loading: false }))
    }
  }

  const loadFavorites = async () => {
    if (!user) return
    
    try {
      const response = await favoritesApi.list()
      const favoriteIds = new Set(response.data.favorites?.map(f => f.question_id) || [])
      setFavorites(favoriteIds)
    } catch (error: any) {
      console.error('加载收藏错误:', error)
      // 如果收藏表不存在，使用空集合
      setFavorites(new Set())
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPagination(prev => ({ ...prev, currentPage: 1 }))
  }

  const handleFilterChange = (type: string, value: string) => {
    setState(prev => ({
      ...prev,
      [type === 'type' ? 'filterType' : 'filterDifficulty']: value
    }))
    setPagination(prev => ({ ...prev, currentPage: 1 }))
  }

  // 分页处理函数
  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, currentPage: page }))
  }

  const handlePageSizeChange = (pageSize: number) => {
    setPagination(prev => ({ ...prev, pageSize, currentPage: 1 }))
  }

  const handleFavorite = async (questionId: string) => {
    if (!user) {
      message.error(t('app.login_required'))
      return
    }

    try {
      if (favorites.has(questionId)) {
        await favoritesApi.remove(questionId)
        favorites.delete(questionId)
      } else {
        await favoritesApi.add(questionId)
        favorites.add(questionId)
      }
      setFavorites(new Set(favorites))
    } catch (error: any) {
      console.error('收藏操作错误:', error)
      message.error(error.response?.data?.message || t('app.operation_failed'))
    }
  }

  // 新增题目处理函数
  const handleAddQuestion = async (values: any) => {
    try {
      setAddLoading(true)
      
      // 构建题目数据
      const questionData: any = {
        title: values.title || '',
        content: values.content,
        type: questionType,
        difficulty: values.difficulty,
        knowledge_point: values.knowledge_point || '',
        score: values.score || 10,
        explanation: values.explanation || ''
      }

      // 根据题目类型处理选项和答案
      if (questionType === 'single_choice' || questionType === 'multiple_choice') {
        const options = []
        for (let i = 0; i < optionCount; i++) {
          const optionValue = values[`option_${String.fromCharCode(65 + i)}`]
          if (optionValue) {
            options.push(optionValue)
          }
        }
        questionData.options = options
        questionData.correct_answer = values.correct_answer
      } else if (questionType === 'true_false') {
        questionData.options = ['正确', '错误']
        questionData.correct_answer = values.correct_answer
      } else {
        questionData.correct_answer = values.correct_answer
      }

      await questions.create(questionData)
      message.success('题目创建成功')
      setShowAddModal(false)
      addForm.resetFields()
      setQuestionType('single_choice')
      setOptionCount(4)
      loadQuestions() // 刷新题目列表
    } catch (error: any) {
      console.error('创建题目失败:', error)
      message.error(error.response?.data?.message || '创建题目失败')
    } finally {
      setAddLoading(false)
    }
  }

  // 题目类型变化处理
  const handleQuestionTypeChange = (type: string) => {
    setQuestionType(type)
    if (type === 'true_false') {
      setOptionCount(2)
    } else if (type === 'single_choice' || type === 'multiple_choice') {
      setOptionCount(4)
    }
  }

  // 选项数量变化处理
  const handleOptionCountChange = (count: number) => {
    setOptionCount(count)
  }

  // 文件选择处理
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // 检查文件类型
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ]
    
    if (!allowedTypes.includes(file.type)) {
      message.error('请选择Excel文件(.xlsx, .xls)或CSV文件')
      return
    }

    // 检查文件大小 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      message.error('文件大小不能超过10MB')
      return
    }

    setImportFile(file)
  }

  // 批量导入处理
  const handleImport = async () => {
    if (!importFile) {
      message.error('请先选择文件')
      return
    }

    try {
      setImportLoading(true)
      setImportProgress(0)

      // 解析文件
      const data = await new Promise<any[]>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            const data = e.target?.result
            let workbook: XLSX.WorkBook
            
            if (importFile.type === 'text/csv') {
              workbook = XLSX.read(data, { type: 'binary' })
            } else {
              workbook = XLSX.read(data, { type: 'array' })
            }
            
            const sheetName = workbook.SheetNames[0]
            const worksheet = workbook.Sheets[sheetName]
            const jsonData = XLSX.utils.sheet_to_json(worksheet)
            resolve(jsonData)
          } catch (error) {
            reject(error)
          }
        }
        reader.onerror = reject
        
        if (importFile.type === 'text/csv') {
          reader.readAsBinaryString(importFile)
        } else {
          reader.readAsArrayBuffer(importFile)
        }
      })

      setImportProgress(30)

      // 处理解析结果
      if (!data || data.length === 0) {
        message.error('文件中没有找到有效数据')
        return
      }

      // 转换数据格式
      const questionsData = data.map((row: any) => ({
        title: row['题目标题'] || row['title'] || '',
        content: row['题目内容'] || row['content'] || '',
        type: row['题目类型'] || row['type'] || 'single_choice',
        options: row['选项'] ? row['选项'].split('|') : [],
        correct_answer: row['正确答案'] || row['correct_answer'] || '',
        difficulty: row['难度等级'] || row['difficulty'] || 'medium',
        knowledge_point: row['知识点'] || row['knowledge_point'] || '',
        score: parseInt(row['分值'] || row['score']) || 10,
        explanation: row['解析'] || row['explanation'] || ''
      }))

      setImportProgress(60)

      // 调用批量导入API
      const response = await questions.bulkImport(questionsData)
      
      setImportProgress(100)
      
      // 处理导入结果
      const { success_count, failed_count, errors } = response.data
      
      if (failed_count > 0) {
        message.warning(`导入完成：成功 ${success_count} 条，失败 ${failed_count} 条`)
        if (errors && errors.length > 0) {
          console.error('导入错误详情:', errors)
        }
      } else {
        message.success(`成功导入 ${success_count} 道题目`)
      }
      
      setShowImportModal(false)
      setImportFile(null)
      setImportProgress(0)
      loadQuestions() // 刷新题目列表
    } catch (error: any) {
      console.error('批量导入失败:', error)
      message.error(error.response?.data?.message || '批量导入失败')
    } finally {
      setImportLoading(false)
    }
  }

  // 下载模板
  const downloadTemplate = () => {
    const templateData = [
      {
        '题目标题': '示例单选题',
        '题目内容': '以下哪个是正确的？',
        '题目类型': 'single_choice',
        '选项': 'A选项|B选项|C选项|D选项',
        '正确答案': 'A',
        '难度等级': 'easy',
        '知识点': '基础知识',
        '分值': 10,
        '解析': '这是解析内容'
      },
      {
        '题目标题': '示例多选题',
        '题目内容': '以下哪些是正确的？（多选）',
        '题目类型': 'multiple_choice',
        '选项': 'A选项|B选项|C选项|D选项',
        '正确答案': 'A,C',
        '难度等级': 'medium',
        '知识点': '综合知识',
        '分值': 15,
        '解析': '多选题解析'
      },
      {
        '题目标题': '示例判断题',
        '题目内容': '这个说法是正确的。',
        '题目类型': 'true_false',
        '选项': '正确|错误',
        '正确答案': '正确',
        '难度等级': 'easy',
        '知识点': '基础概念',
        '分值': 5,
        '解析': '判断题解析'
      },
      {
        '题目标题': '示例简答题',
        '题目内容': '请简述相关概念。',
        '题目类型': 'short_answer',
        '选项': '',
        '正确答案': '参考答案内容',
        '难度等级': 'hard',
        '知识点': '高级概念',
        '分值': 20,
        '解析': '简答题解析'
      }
    ]

    const worksheet = XLSX.utils.json_to_sheet(templateData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, '题目模板')
    XLSX.writeFile(workbook, '题目导入模板.xlsx')
  }

  // 如果认证状态还在加载中，显示加载状态
  if (authLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Spin size="large" tip="正在验证登录状态...">
          <div style={{ minHeight: '200px' }} />
        </Spin>
      </div>
    )
  }

  // 如果用户未登录，显示登录提示
  if (!user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <Space direction="vertical" align="center" size="large">
          <Title level={2}>请先登录</Title>
          <Text type="secondary">您需要登录后才能查看题目列表</Text>
          <Link to="/auth/login">
            <Button type="primary" size="large">
              前往登录
            </Button>
          </Link>
        </Space>
      </div>
    )
  }

  // 如果题目数据还在加载中，显示加载状态
  if (state.loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Spin size="large" tip={t('app.loading_questions')}>
          <div style={{ minHeight: '200px',minWidth:"200px" }} />
        </Spin>
      </div>
    )
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* 页面标题 */}
      <Card>
        <Space style={{ width: '100%' }} align="start">
          <div style={{ flex: 1 }}>
            <Title level={2} style={{ margin: 0 }}>
              {viewType === 'favorites'
                ? '收藏题目'
                : viewType === 'wrong'
                ? '错题本'
                : viewType === 'browse'
                ? '题目浏览'
                : viewType === 'manage'
                ? '题目管理'
                : t('questions.title')}
            </Title>
            <Text type="secondary">
              {viewType === 'favorites'
                ? '查看您收藏的题目'
                : viewType === 'wrong'
                ? '查看您做错的题目'
                : viewType === 'browse'
                ? '浏览和练习题目'
                : viewType === 'manage'
                ? '管理和维护题目'
                : t('questions.description')}
            </Text>
          </div>
          <Space>
            {/* 管理员功能按钮 */}
            {user?.role === 'admin' && viewType === 'manage' && (
              <>
                <Button
                  type="primary"
                  icon={<Plus style={{ width: 16, height: 16 }} />}
                  onClick={() => setAddModalVisible(true)}
                >
                  新增题目
                </Button>
                <Button icon={<Upload style={{ width: 16, height: 16 }} />} onClick={() => setImportModalVisible(true)}>
                  批量导入
                </Button>
              </>
            )}

            {/* 新增题目对话框 */}
            <Modal
              title="新增题目"
              open={showAddModal}
              onCancel={() => {
                setShowAddModal(false)
                addForm.resetFields()
                setQuestionType('single_choice')
                setOptionCount(4)
              }}
              onOk={() => addForm.submit()}
              confirmLoading={addLoading}
              width={800}
              destroyOnHidden
            >
              <Form
                form={addForm}
                layout="vertical"
                onFinish={handleAddQuestion}
                initialValues={{
                  difficulty: 'medium',
                  score: 10,
                }}
              >
                <Form.Item label="题目标题" name="title" rules={[{ required: true, message: '请输入题目标题' }]}>
                  <Input placeholder="请输入题目标题" />
                </Form.Item>

                <Form.Item label="题目内容" name="content" rules={[{ required: true, message: '请输入题目内容' }]}>
                  <Input.TextArea rows={3} placeholder="请输入题目内容" />
                </Form.Item>

                <Form.Item label="题目类型" name="type" rules={[{ required: true, message: '请选择题目类型' }]}>
                  <Radio.Group value={questionType} onChange={e => handleQuestionTypeChange(e.target.value)}>
                    <Radio value="single_choice">单选题</Radio>
                    <Radio value="multiple_choice">多选题</Radio>
                    <Radio value="true_false">判断题</Radio>
                    <Radio value="short_answer">简答题</Radio>
                  </Radio.Group>
                </Form.Item>

                {/* 选择题和判断题的选项设置 */}
                {(questionType === 'single_choice' || questionType === 'multiple_choice') && (
                  <>
                    <Form.Item label="选项数量">
                      <Radio.Group value={optionCount} onChange={e => handleOptionCountChange(e.target.value)}>
                        <Radio value={2}>2个选项</Radio>
                        <Radio value={3}>3个选项</Radio>
                        <Radio value={4}>4个选项</Radio>
                        <Radio value={5}>5个选项</Radio>
                        <Radio value={6}>6个选项</Radio>
                      </Radio.Group>
                    </Form.Item>

                    {Array.from({ length: optionCount }, (_, index) => (
                      <Form.Item
                        key={index}
                        label={`选项${String.fromCharCode(65 + index)}`}
                        name={`option_${String.fromCharCode(65 + index)}`}
                        rules={[{ required: true, message: `请输入选项${String.fromCharCode(65 + index)}` }]}
                      >
                        <Input placeholder={`请输入选项${String.fromCharCode(65 + index)}内容`} />
                      </Form.Item>
                    ))}

                    <Form.Item
                      label="正确答案"
                      name="correct_answer"
                      rules={[{ required: true, message: '请选择正确答案' }]}
                    >
                      {questionType === 'single_choice' ? (
                        <Radio.Group>
                          {Array.from({ length: optionCount }, (_, index) => (
                            <Radio key={index} value={String.fromCharCode(65 + index)}>
                              选项{String.fromCharCode(65 + index)}
                            </Radio>
                          ))}
                        </Radio.Group>
                      ) : (
                        <Select mode="multiple" placeholder="请选择正确答案（可多选）" style={{ width: '100%' }}>
                          {Array.from({ length: optionCount }, (_, index) => (
                            <Select.Option key={index} value={String.fromCharCode(65 + index)}>
                              选项{String.fromCharCode(65 + index)}
                            </Select.Option>
                          ))}
                        </Select>
                      )}
                    </Form.Item>
                  </>
                )}

                {/* 判断题的答案设置 */}
                {questionType === 'true_false' && (
                  <Form.Item
                    label="正确答案"
                    name="correct_answer"
                    rules={[{ required: true, message: '请选择正确答案' }]}
                  >
                    <Radio.Group>
                      <Radio value="正确">正确</Radio>
                      <Radio value="错误">错误</Radio>
                    </Radio.Group>
                  </Form.Item>
                )}

                {/* 简答题的答案设置 */}
                {questionType === 'short_answer' && (
                  <Form.Item
                    label="参考答案"
                    name="correct_answer"
                    rules={[{ required: true, message: '请输入参考答案' }]}
                  >
                    <Input.TextArea rows={3} placeholder="请输入参考答案" />
                  </Form.Item>
                )}

                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item
                      label="难度等级"
                      name="difficulty"
                      rules={[{ required: true, message: '请选择难度等级' }]}
                    >
                      <Select>
                        <Select.Option value="easy">简单</Select.Option>
                        <Select.Option value="medium">中等</Select.Option>
                        <Select.Option value="hard">困难</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="知识点" name="knowledge_point">
                      <Input placeholder="请输入知识点" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="分值" name="score" rules={[{ required: true, message: '请输入分值' }]}>
                      <Input type="number" min={1} placeholder="请输入分值" />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item label="解析" name="explanation">
                  <Input.TextArea rows={2} placeholder="请输入题目解析（可选）" />
                </Form.Item>
              </Form>
            </Modal>

            {/* 批量导入对话框 */}
            <Modal
              title="批量导入题目"
              open={showImportModal}
              onCancel={() => {
                setShowImportModal(false)
                setImportFile(null)
                setImportProgress(0)
              }}
              footer={[
                <Button
                  key="cancel"
                  onClick={() => {
                    setShowImportModal(false)
                    setImportFile(null)
                    setImportProgress(0)
                  }}
                >
                  取消
                </Button>,
                <Button key="template" onClick={downloadTemplate}>
                  下载模板
                </Button>,
                <Button
                  key="import"
                  type="primary"
                  loading={importLoading}
                  disabled={!importFile}
                  onClick={handleImport}
                >
                  开始导入
                </Button>,
              ]}
              width={600}
              destroyOnHidden
            >
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                <div>
                  <Text strong>选择文件</Text>
                  <div style={{ marginTop: 8 }}>
                    <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} style={{ width: '100%' }} />
                  </div>
                  {importFile && (
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      已选择文件：{importFile.name} ({(importFile.size / 1024 / 1024).toFixed(2)} MB)
                    </Text>
                  )}
                </div>

                {importLoading && (
                  <div>
                    <Text strong>导入进度</Text>
                    <Progress percent={importProgress} status="active" />
                  </div>
                )}

                <Divider />

                <div>
                  <Text strong>导入说明</Text>
                  <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                    <li>支持Excel文件(.xlsx, .xls)和CSV文件</li>
                    <li>单次最多导入1000道题目</li>
                    <li>文件大小不能超过10MB</li>
                    <li>必填字段：题目标题、题目内容、题目类型、难度等级</li>
                    <li>题目类型：single_choice(单选)、multiple_choice(多选)、true_false(判断)、short_answer(简答)</li>
                    <li>难度等级：easy(简单)、medium(中等)、hard(困难)</li>
                    <li>选择题选项用"|"分隔，如：A选项|B选项|C选项|D选项</li>
                    <li>多选题正确答案用","分隔，如：A,C</li>
                  </ul>
                </div>
              </Space>
            </Modal>
            {/* 连续练习按钮 */}
            {viewType === 'all' && state.questions.length > 0 && state.questions[0]?.id && (
              <Link
                to={`/questions/${state.questions[0].id}/practice?mode=continuous&${new URLSearchParams({
                  ...(state.filterType !== 'all' && { type: state.filterType }),
                  ...(state.filterDifficulty !== 'all' && { difficulty: state.filterDifficulty }),
                  ...(state.searchTerm && { search: state.searchTerm }),
                }).toString()}`}
              >
                <Button type="primary" icon={<Play style={{ width: 16, height: 16 }} />}>
                  开始连续练习
                </Button>
              </Link>
            )}
          </Space>
        </Space>
      </Card>

      {/* 搜索和筛选 - 只在全部题目视图中显示 */}
      {viewType === 'all' && (
        <Card>
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} md={12}>
              <form onSubmit={handleSearch}>
                <Input
                  prefix={<Search style={{ width: 16, height: 16, color: '#999' }} />}
                  value={state.searchTerm}
                  onChange={e => setState(prev => ({ ...prev, searchTerm: e.target.value }))}
                  placeholder={t('questions.search_placeholder')}
                  allowClear
                />
              </form>
            </Col>
            <Col xs={24} md={12}>
              <Space>
                <Space>
                  <Filter style={{ width: 16, height: 16, color: '#999' }} />
                  <Select
                    value={state.filterType}
                    onChange={value => handleFilterChange('type', value)}
                    style={{ width: 150 }}
                  >
                    <Select.Option value="all">{t('questions.all_types')}</Select.Option>
                    <Select.Option value="single_choice">{t('questions.single_choice')}</Select.Option>
                    <Select.Option value="multiple_choice">{t('questions.multiple_choice')}</Select.Option>
                    <Select.Option value="true_false">{t('questions.judge')}</Select.Option>
                    <Select.Option value="short_answer">{t('questions.fill_blank')}</Select.Option>
                  </Select>
                </Space>
                <Select
                  value={state.filterDifficulty}
                  onChange={value => handleFilterChange('difficulty', value)}
                  style={{ width: 120 }}
                >
                  <Select.Option value="all">{t('questions.all_difficulties')}</Select.Option>
                  <Select.Option value="easy">{t('questions.easy')}</Select.Option>
                  <Select.Option value="medium">{t('questions.medium')}</Select.Option>
                  <Select.Option value="hard">{t('questions.hard')}</Select.Option>
                </Select>
              </Space>
            </Col>
          </Row>
        </Card>
      )}

      {/* 题目列表 */}
      <Row gutter={[16, 16]}>
        {state.questions
          .filter(question => question && question.id)
          .map(question => (
            <Col key={question.id} xs={24} md={12} lg={8}>
              <Card
                hoverable
                actions={[
                  <Link to={`/questions/${question.id}`} key="view">
                    <Space>
                      <Eye style={{ width: 16, height: 16 }} />
                      <span>查看</span>
                    </Space>
                  </Link>,
                ]}
              >
                <Space style={{ width: '100%' }} align="start">
                  <div style={{ flex: 1 }}>
                    <Title level={4} style={{ margin: 0, marginBottom: 8 }}>
                      <Link to={`/questions/${question.id}`} style={{ color: 'inherit' }}>
                        {question.content}
                      </Link>
                    </Title>
                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                      <Space>
                        <BookmarkPlus style={{ width: 16, height: 16 }} />
                        <Text type="secondary">{question.knowledge_point}</Text>
                      </Space>
                      <Space>
                        <Clock style={{ width: 16, height: 16 }} />
                        <Text type="secondary">
                          {new Date(question.created_at).toLocaleString(language === 'zh-CN' ? 'zh-CN' : 'en-US')}
                        </Text>
                      </Space>
                    </Space>
                  </div>
                  <Button
                    type="text"
                    icon={
                      <Heart
                        style={{
                          width: 20,
                          height: 20,
                          color: favorites.has(question.id) ? '#ff4d4f' : '#d9d9d9',
                        }}
                        fill={favorites.has(question.id) ? 'currentColor' : 'none'}
                      />
                    }
                    onClick={() => handleFavorite(question.id)}
                  />
                </Space>
                <div style={{ marginTop: 16 }}>
                  <Space>
                    <Tag
                      color={
                        {
                          single: 'blue',
                          multiple: 'purple',
                          judge: 'green',
                          fill: 'orange',
                          essay: 'red',
                        }[question.type] || 'default'
                      }
                    >
                      {{
                        single: '单选题',
                        multiple: '多选题',
                        judge: '判断题',
                        fill: '填空题',
                        essay: '问答题',
                      }[question.type] || question.type}
                    </Tag>
                    <Tag
                      color={
                        {
                          easy: 'success',
                          medium: 'warning',
                          hard: 'error',
                        }[question.difficulty] || 'default'
                      }
                    >
                      {{
                        easy: '简单',
                        medium: '中等',
                        hard: '困难',
                      }[question.difficulty] || question.difficulty}
                    </Tag>
                  </Space>
                </div>
              </Card>
            </Col>
          ))}
      </Row>

      {/* 空状态 */}
      {state.questions.length === 0 && (
        <Empty
          image={<BookmarkPlus style={{ width: 48, height: 48, color: '#d9d9d9' }} />}
          description={
            <Space direction="vertical">
              <Text strong>暂无题目</Text>
              <Text type="secondary">当前筛选条件下没有找到任何题目</Text>
            </Space>
          }
        />
      )}

      {/* 分页组件 - 只在全部题目视图且有题目时显示 */}
      {viewType === 'all' && state.questions.length > 0 && (
        <Card>
          <Pagination
            current={pagination.currentPage}
            total={pagination.totalQuestions}
            pageSize={pagination.pageSize}
            onChange={handlePageChange}
            onShowSizeChange={handlePageSizeChange}
            {...createPaginationConfig({
              pageSizeOptions: ['10', '15', '20', '30', '40', '50'],
            })}
          />
        </Card>
      )}
    </Space>
  )
}

export default QuestionsPage
