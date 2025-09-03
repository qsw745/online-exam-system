import * as apiModule from '@shared/api/http'
import { createPaginationConfig } from '@shared/constants/pagination'
import { useAuth } from '@shared/contexts/AuthContext'
import { useLanguage } from '@shared/contexts/LanguageContext'
import {
  Button,
  Card,
  Col,
  Divider,
  Empty,
  Form,
  Input,
  message,
  Modal,
  Pagination,
  Progress,
  Radio,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd'
import { BookmarkPlus, Clock, Eye, Filter, Heart, Play, Plus, Search, Upload } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import * as XLSX from 'xlsx'

const { questions, favorites: favoritesApi } = apiModule
const { Title, Text } = Typography

// ---- ApiResult 工具 ----
type ApiSuccess<T = any> = { success: true; data: T }
type ApiFailure = { success: false; error?: string; message?: string }
type ApiResult<T = any> = ApiSuccess<T> | ApiFailure
const isSuccess = <T,>(r: ApiResult<T>): r is ApiSuccess<T> => !!r && (r as any).success === true
const getErr = (r: ApiResult<any>, fallback = '请求失败') =>
  (!isSuccess(r) && ((r as any).error || (r as any).message)) || fallback

// ---- 类型 ----
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
    filterDifficulty: 'all',
  })
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    totalPages: 1,
    totalQuestions: 0,
    pageSize: 12,
  })
  const [favorites, setFavorites] = useState<Set<string>>(new Set())

  // 新增题目
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm] = Form.useForm()
  const [addLoading, setAddLoading] = useState(false)
  const [questionType, setQuestionType] = useState<'single_choice' | 'multiple_choice' | 'true_false' | 'short_answer'>(
    'single_choice'
  )
  const [optionCount, setOptionCount] = useState(4)

  // 批量导入
  const [showImportModal, setShowImportModal] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importProgress, setImportProgress] = useState(0)

  // 路由视图类型
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
    // 只有在认证状态确定且用户已登录时才加载数据
    if (!authLoading && user) {
      loadQuestions()
      loadFavorites()
    } else if (!authLoading && !user) {
      setState(prev => ({ ...prev, loading: false }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    viewType,
    pagination.currentPage,
    pagination.pageSize,
    state.filterType,
    state.filterDifficulty,
    state.searchTerm,
    user,
    authLoading,
  ])

  const loadQuestions = async () => {
    if (authLoading) return

    if (!user) {
      setState(prev => ({ ...prev, loading: false }))
      return
    }

    try {
      setState(prev => ({ ...prev, loading: true }))

      if (viewType === 'favorites') {
        const resFav: ApiResult<any> = await favoritesApi.list()
        if (!isSuccess(resFav)) {
          message.error(getErr(resFav, '获取收藏失败'))
          setState(prev => ({ ...prev, loading: false }))
          return
        }
        const favoriteQuestions: Question[] =
          resFav.data?.favorites?.map((f: any) => f.question).filter((q: any) => q && q.id) ?? []

        setState(prev => ({
          ...prev,
          questions: favoriteQuestions,
          loading: false,
        }))
        setPagination(prev => ({
          ...prev,
          totalQuestions: favoriteQuestions.length,
          totalPages: 1,
        }))
      } else if (viewType === 'wrong') {
        setState(prev => ({ ...prev, questions: [], loading: false }))
        setPagination(prev => ({ ...prev, totalQuestions: 0, totalPages: 1 }))
        message.info('错题本功能正在开发中')
      } else {
        const res: ApiResult<any> = await questions.list({
          type: state.filterType === 'all' ? undefined : state.filterType,
          difficulty: state.filterDifficulty === 'all' ? undefined : state.filterDifficulty,
          search: state.searchTerm || undefined,
          page: pagination.currentPage,
          limit: pagination.pageSize,
        })
        if (!isSuccess(res)) {
          message.error(getErr(res, '获取题目列表失败'))
          setState(prev => ({ ...prev, loading: false }))
          return
        }

        const payload = res.data
        const list: Question[] = Array.isArray(payload) ? payload : payload?.questions ?? []
        setState(prev => ({ ...prev, questions: list, loading: false }))

        const p = (payload && payload.pagination) || null
        if (p) {
          setPagination(prev => ({
            ...prev,
            totalPages: p.totalPages,
            totalQuestions: p.total,
          }))
        }
      }
    } catch (error: any) {
      console.error('加载题目错误:', error)

      if (error.message === 'AUTHENTICATION_REQUIRED' || error.response?.status === 401) {
        message.error('登录已过期，请重新登录')
        localStorage.removeItem('token')
        sessionStorage.removeItem('token')
        localStorage.removeItem('userRole')
        sessionStorage.removeItem('userRole')
        setTimeout(() => window.location.reload(), 1500)
      } else {
        const errorMessage =
          error.response?.data?.error || error.response?.data?.message || error.message || '获取题目列表失败'
        message.error(errorMessage)
      }
      setState(prev => ({ ...prev, loading: false }))
    }
  }

  const loadFavorites = async () => {
    if (!user) return
    try {
      const resFav: ApiResult<any> = await favoritesApi.list()
      if (!isSuccess(resFav)) {
        setFavorites(new Set<string>())
        return
      }
      const favoriteIds = new Set<string>(
        (resFav.data?.favorites?.map((f: any) => String(f.question_id)) ?? []) as string[]
      )
      setFavorites(favoriteIds)
    } catch (error) {
      console.error('加载收藏错误:', error)
      setFavorites(new Set<string>())
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPagination(prev => ({ ...prev, currentPage: 1 }))
  }

  const handleFilterChange = (type: 'type' | 'difficulty', value: string) => {
    setState(prev => ({
      ...prev,
      [type === 'type' ? 'filterType' : 'filterDifficulty']: value,
    }))
    setPagination(prev => ({ ...prev, currentPage: 1 }))
  }

  const handlePageChange = (page: number) => setPagination(prev => ({ ...prev, currentPage: page }))
  const handlePageSizeChange = (_: number, size: number) =>
    setPagination(prev => ({ ...prev, pageSize: size, currentPage: 1 }))

  const handleFavorite = async (questionId: string) => {
    if (!user) return message.error(t('app.login_required'))

    try {
      if (favorites.has(questionId)) {
        const res: ApiResult<any> = await favoritesApi.remove(questionId)
        if (!isSuccess(res)) throw new Error(getErr(res, '取消收藏失败'))
        const next = new Set(favorites)
        next.delete(questionId)
        setFavorites(next)
      } else {
        const res: ApiResult<any> = await favoritesApi.add(questionId)
        if (!isSuccess(res)) throw new Error(getErr(res, '收藏失败'))
        const next = new Set(favorites)
        next.add(questionId)
        setFavorites(next)
      }
    } catch (error: any) {
      console.error('收藏操作错误:', error)
      message.error(error.response?.data?.message || t('app.operation_failed'))
    }
  }

  // 新增题目
  const handleAddQuestion = async (values: any) => {
    try {
      setAddLoading(true)

      const questionData: any = {
        title: values.title || '',
        content: values.content,
        type: questionType,
        difficulty: values.difficulty,
        knowledge_point: values.knowledge_point || '',
        score: values.score || 10,
        explanation: values.explanation || '',
      }

      if (questionType === 'single_choice' || questionType === 'multiple_choice') {
        const options: string[] = []
        for (let i = 0; i < optionCount; i++) {
          const v = values[`option_${String.fromCharCode(65 + i)}`]
          if (v) options.push(v)
        }
        questionData.options = options
        questionData.correct_answer = values.correct_answer
      } else if (questionType === 'true_false') {
        questionData.options = ['正确', '错误']
        questionData.correct_answer = values.correct_answer
      } else {
        questionData.correct_answer = values.correct_answer
      }

      const res: ApiResult<any> = await questions.create(questionData)
      if (!isSuccess(res)) throw new Error(getErr(res, '创建题目失败'))
      message.success('题目创建成功')

      setShowAddModal(false)
      addForm.resetFields()
      setQuestionType('single_choice')
      setOptionCount(4)
      loadQuestions()
    } catch (error: any) {
      console.error('创建题目失败:', error)
      message.error(error.response?.data?.message || error.message || '创建题目失败')
    } finally {
      setAddLoading(false)
    }
  }

  const handleQuestionTypeChange = (type: any) => {
    setQuestionType(type)
    if (type === 'true_false') setOptionCount(2)
    else if (type === 'single_choice' || type === 'multiple_choice') setOptionCount(4)
  }
  const handleOptionCountChange = (count: number) => setOptionCount(count)

  // 导入
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ]
    if (!allowedTypes.includes(file.type)) {
      message.error('请选择Excel文件(.xlsx, .xls)或CSV文件')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      message.error('文件大小不能超过10MB')
      return
    }
    setImportFile(file)
  }

  const handleImport = async () => {
    if (!importFile) return message.error('请先选择文件')

    try {
      setImportLoading(true)
      setImportProgress(0)

      const data = await new Promise<any[]>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = e => {
          try {
            const buf = e.target?.result as ArrayBuffer
            let workbook: XLSX.WorkBook
            if (importFile.type === 'text/csv') {
              workbook = XLSX.read(buf as any, { type: 'binary' })
            } else {
              workbook = XLSX.read(buf, { type: 'array' })
            }
            const sheetName = workbook.SheetNames[0]
            const worksheet = workbook.Sheets[sheetName]
            const jsonData = XLSX.utils.sheet_to_json(worksheet)
            resolve(jsonData)
          } catch (err) {
            reject(err)
          }
        }
        reader.onerror = reject
        if (importFile.type === 'text/csv') reader.readAsBinaryString(importFile)
        else reader.readAsArrayBuffer(importFile)
      })

      setImportProgress(30)

      if (!data || data.length === 0) {
        message.error('文件中没有找到有效数据')
        return
      }

      const questionsData = data.map((row: any) => ({
        title: row['题目标题'] || row['title'] || '',
        content: row['题目内容'] || row['content'] || '',
        type: row['题目类型'] || row['type'] || 'single_choice',
        options: row['选项'] ? String(row['选项']).split('|') : [],
        correct_answer: row['正确答案'] || row['correct_answer'] || '',
        difficulty: row['难度等级'] || row['difficulty'] || 'medium',
        knowledge_point: row['知识点'] || row['knowledge_point'] || '',
        score: parseInt(row['分值'] || row['score']) || 10,
        explanation: row['解析'] || row['explanation'] || '',
      }))

      setImportProgress(60)

      const resImport: ApiResult<any> = await questions.bulkImport(questionsData)
      if (!isSuccess(resImport)) throw new Error(getErr(resImport, '批量导入失败'))

      setImportProgress(100)

      const { success_count = 0, failed_count = 0, errors = [] } = resImport.data || {}
      if (failed_count > 0) {
        message.warning(`导入完成：成功 ${success_count} 条，失败 ${failed_count} 条`)
        if (errors.length) console.error('导入错误详情:', errors)
      } else {
        message.success(`成功导入 ${success_count} 道题目`)
      }

      setShowImportModal(false)
      setImportFile(null)
      setImportProgress(0)
      loadQuestions()
    } catch (error: any) {
      console.error('批量导入失败:', error)
      message.error(error.response?.data?.message || error.message || '批量导入失败')
    } finally {
      setImportLoading(false)
    }
  }

  // 下载模板
  const downloadTemplate = () => {
    const templateData = [
      {
        题目标题: '示例单选题',
        题目内容: '以下哪个是正确的？',
        题目类型: 'single_choice',
        选项: 'A选项|B选项|C选项|D选项',
        正确答案: 'A',
        难度等级: 'easy',
        知识点: '基础知识',
        分值: 10,
        解析: '这是解析内容',
      },
      {
        题目标题: '示例多选题',
        题目内容: '以下哪些是正确的？（多选）',
        题目类型: 'multiple_choice',
        选项: 'A选项|B选项|C选项|D选项',
        正确答案: 'A,C',
        难度等级: 'medium',
        知识点: '综合知识',
        分值: 15,
        解析: '多选题解析',
      },
      {
        题目标题: '示例判断题',
        题目内容: '这个说法是正确的。',
        题目类型: 'true_false',
        选项: '正确|错误',
        正确答案: '正确',
        难度等级: 'easy',
        知识点: '基础概念',
        分值: 5,
        解析: '判断题解析',
      },
      {
        题目标题: '示例简答题',
        题目内容: '请简述相关概念。',
        题目类型: 'short_answer',
        选项: '',
        正确答案: '参考答案内容',
        难度等级: 'hard',
        知识点: '高级概念',
        分值: 20,
        解析: '简答题解析',
      },
    ]

    const worksheet = XLSX.utils.json_to_sheet(templateData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, '题目模板')
    XLSX.writeFile(workbook, '题目导入模板.xlsx')
  }

  // ---- Loading / 未登录 ----
  if (authLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Spin size="large" tip="正在验证登录状态...">
          <div style={{ minHeight: '200px' }} />
        </Spin>
      </div>
    )
  }

  if (!user) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
        }}
      >
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

  if (state.loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Spin size="large" tip={t('app.loading_questions')}>
          <div style={{ minHeight: '200px', minWidth: '200px' }} />
        </Spin>
      </div>
    )
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* 顶部 */}
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
                  onClick={() => setShowAddModal(true)}
                >
                  新增题目
                </Button>
                <Button icon={<Upload style={{ width: 16, height: 16 }} />} onClick={() => setShowImportModal(true)}>
                  批量导入
                </Button>
              </>
            )}

            {/* 新增题目 Modal */}
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
                initialValues={{ difficulty: 'medium', score: 10 }}
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

                    {Array.from({ length: optionCount }, (_, i) => (
                      <Form.Item
                        key={i}
                        label={`选项${String.fromCharCode(65 + i)}`}
                        name={`option_${String.fromCharCode(65 + i)}`}
                        rules={[{ required: true, message: `请输入选项${String.fromCharCode(65 + i)}` }]}
                      >
                        <Input placeholder={`请输入选项${String.fromCharCode(65 + i)}内容`} />
                      </Form.Item>
                    ))}

                    <Form.Item
                      label="正确答案"
                      name="correct_answer"
                      rules={[{ required: true, message: '请选择正确答案' }]}
                    >
                      {questionType === 'single_choice' ? (
                        <Radio.Group>
                          {Array.from({ length: optionCount }, (_, i) => (
                            <Radio key={i} value={String.fromCharCode(65 + i)}>
                              选项{String.fromCharCode(65 + i)}
                            </Radio>
                          ))}
                        </Radio.Group>
                      ) : (
                        <Select mode="multiple" placeholder="请选择正确答案（可多选）" style={{ width: '100%' }}>
                          {Array.from({ length: optionCount }, (_, i) => (
                            <Select.Option key={i} value={String.fromCharCode(65 + i)}>
                              选项{String.fromCharCode(65 + i)}
                            </Select.Option>
                          ))}
                        </Select>
                      )}
                    </Form.Item>
                  </>
                )}

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

            {/* 批量导入 Modal */}
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
                    <Text type="secondary" style={{ fontSize: 12 }}>
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
                    <li>选择题选项用“|”分隔，如：A选项|B选项|C选项|D选项</li>
                    <li>多选题正确答案用“,”分隔，如：A,C</li>
                  </ul>
                </div>
              </Space>
            </Modal>

            {/* 连续练习入口 */}
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

      {/* 搜索和筛选（仅全部题目） */}
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
                  <Select value={state.filterType} onChange={v => handleFilterChange('type', v)} style={{ width: 150 }}>
                    <Select.Option value="all">{t('questions.all_types')}</Select.Option>
                    <Select.Option value="single_choice">{t('questions.single_choice')}</Select.Option>
                    <Select.Option value="multiple_choice">{t('questions.multiple_choice')}</Select.Option>
                    <Select.Option value="true_false">{t('questions.judge')}</Select.Option>
                    <Select.Option value="short_answer">{t('questions.fill_blank')}</Select.Option>
                  </Select>
                </Space>
                <Select
                  value={state.filterDifficulty}
                  onChange={v => handleFilterChange('difficulty', v)}
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

      {/* 列表 */}
      <Row gutter={[16, 16]}>
        {state.questions
          .filter(q => q && q.id)
          .map(q => (
            <Col key={q.id} xs={24} md={12} lg={8}>
              <Card
                hoverable
                style={{ height: '100%' }} // 让卡片充满列高
                actions={[
                  <Link to={`/questions/${q.id}/practice`} key="view">
                    <Space>
                      <Eye style={{ width: 16, height: 16 }} />
                      <span>查看</span>
                    </Space>
                  </Link>,
                ]}
              >
                <Space style={{ width: '100%' }} align="start">
                  <div style={{ flex: 1 }}>
                    <div style={{ minHeight: 48, marginBottom: 8 }}>
                      <Typography.Paragraph
                        style={{ margin: 0, fontSize: 16, fontWeight: 600, lineHeight: 1.4 }}
                        ellipsis={{ rows: 2 }}
                      >
                        <Link to={`/questions/${q.id}/practice`} style={{ color: 'inherit' }}>
                          {q.content}
                        </Link>
                      </Typography.Paragraph>
                    </div>
                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                      <Space>
                        <BookmarkPlus style={{ width: 16, height: 16 }} />
                        <Text type="secondary">{q.knowledge_point}</Text>
                      </Space>
                      <Space>
                        <Clock style={{ width: 16, height: 16 }} />
                        <Text type="secondary">
                          {new Date(q.created_at).toLocaleString(language === 'zh-CN' ? 'zh-CN' : 'en-US')}
                        </Text>
                      </Space>
                    </Space>
                  </div>
                  <Button
                    type="text"
                    icon={
                      <Heart
                        style={{ width: 20, height: 20, color: favorites.has(q.id) ? '#ff4d4f' : '#d9d9d9' }}
                        fill={favorites.has(q.id) ? 'currentColor' : 'none'}
                      />
                    }
                    onClick={() => handleFavorite(q.id)}
                  />
                </Space>

                <div style={{ marginTop: 16 }}>
                  <Space>
                    {/* 如果你的后端返回 single_choice 等，可按需调整这里的映射 */}
                    <Tag
                      color={
                        {
                          single: 'blue',
                          multiple: 'purple',
                          judge: 'green',
                          fill: 'orange',
                          essay: 'red',
                          single_choice: 'blue',
                          multiple_choice: 'purple',
                          true_false: 'green',
                          short_answer: 'orange',
                        }[q.type] || 'default'
                      }
                    >
                      {{
                        single: '单选题',
                        multiple: '多选题',
                        judge: '判断题',
                        fill: '填空题',
                        essay: '问答题',
                        single_choice: '单选题',
                        multiple_choice: '多选题',
                        true_false: '判断题',
                        short_answer: '简答题',
                      }[q.type] || q.type}
                    </Tag>

                    <Tag
                      color={
                        {
                          easy: 'success',
                          medium: 'warning',
                          hard: 'error',
                        }[q.difficulty] || 'default'
                      }
                    >
                      {{
                        easy: '简单',
                        medium: '中等',
                        hard: '困难',
                      }[q.difficulty] || q.difficulty}
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

      {/* 分页（仅全部视图） */}
      {viewType === 'all' && state.questions.length > 0 && (
        <Card>
          <Pagination
            current={pagination.currentPage}
            total={pagination.totalQuestions}
            pageSize={pagination.pageSize}
            onChange={handlePageChange}
            onShowSizeChange={handlePageSizeChange}
            {...createPaginationConfig({ pageSizeOptions: ['10', '15', '20', '30', '40', '50'] })}
          />
        </Card>
      )}
    </Space>
  )
}

export default QuestionsPage
