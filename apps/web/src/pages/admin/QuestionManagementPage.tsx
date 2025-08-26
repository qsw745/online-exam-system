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
import { 
  Modal, 
  Button, 
  Upload as AntUpload, 
  Progress, 
  message, 
  Form, 
  Input, 
  Select, 
  Radio, 
  Space,
  Card,
  Typography,
  Table,
  Checkbox,
  Tag,
  Tooltip,
  Row,
  Col,
  Divider,
  Alert
} from 'antd'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import { api, questions as questionsApi } from '../../lib/api'
import { parseFile, ParsedQuestion } from '../../utils/fileParser'
import { createPaginationConfig } from '../../constants/pagination'

const { Title, Paragraph } = Typography
const { Search: AntSearch } = Input

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
  // 新增题目状态
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm] = Form.useForm()
  const [addLoading, setAddLoading] = useState(false)
  const [questionType, setQuestionType] = useState('single_choice')
  const [optionCount, setOptionCount] = useState(4)

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
      message.error(error.response?.data?.message || '加载题目失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (questionId: string) => {
    try {
      await questionsApi.delete(questionId)
      message.success('题目删除成功')
      loadQuestions()
      setShowDeleteModal(false)
      setSelectedQuestion(null)
    } catch (error: any) {
      console.error('删除题目错误:', error)
      message.error(error.response?.data?.message || '删除题目失败')
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const allowedTypes = ['.xlsx', '.xls', '.csv']
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
      
      if (!allowedTypes.includes(fileExtension)) {
        message.error('请选择Excel文件(.xlsx, .xls)或CSV文件(.csv)')
        return
      }
      
      if (file.size > 10 * 1024 * 1024) { // 10MB限制
        message.error('文件大小不能超过10MB')
        return
      }
      
      setImportFile(file)
    }
  }

  const handleImport = async () => {
    if (!importFile) {
      message.error('请先选择要导入的文件')
      return
    }

    setImporting(true)
    setImportProgress(10)

    try {
      // 解析文件
      message.info('正在解析文件...')
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
        message.warning(`解析完成，但有 ${parseResult.errors.length} 个错误：\n${parseResult.errors.slice(0, 3).join('\n')}${parseResult.errors.length > 3 ? '\n...' : ''}`)
      }

      message.info(`解析成功，共 ${questions.length} 道题目，开始导入...`)
      setImportProgress(50)

      // 准备批量导入数据
      const questionsData = questions.map((q, index) => ({
        title: q.title || `题目${index + 1}`,
        content: q.content,
        question_type: q.question_type,
        difficulty: q.difficulty || 'medium',
        options: q.options,
        correct_answer: q.correct_answer,
        answer: q.answer,
        knowledge_points: q.knowledge_points || [],
        explanation: q.explanation || '',
        score: q.score || 1
      }))

      setImportProgress(70)

      // 调用批量导入API
      const importResult = await questionsApi.bulkImport(questionsData)
      setImportProgress(90)

      // 处理导入结果
      const { success_count, fail_count, errors } = importResult.data
      
      if (success_count > 0) {
        message.success(`导入完成！成功导入 ${success_count} 道题目${fail_count > 0 ? `，失败 ${fail_count} 道` : ''}`)
        loadQuestions() // 刷新题目列表
      }

      if (fail_count > 0 && errors && errors.length > 0) {
        console.error('导入错误详情:', errors)
        message.error(`部分题目导入失败：\n${errors.slice(0, 3).join('\n')}${errors.length > 3 ? '\n...' : ''}`)
      }

    } catch (error: any) {
      console.error('批量导入错误:', error)
      message.error(error.message || '批量导入失败')
    } finally {
      setImporting(false)
      setImportProgress(0)
      setShowImportModal(false)
      setImportFile(null)
    }
  }

  // 新增题目处理函数
  const handleAddQuestion = async (values: any) => {
    try {
      setAddLoading(true)
      
      // 构建题目数据
      const questionData: any = {
        title: values.title,
        content: values.content,
        question_type: questionType,
        difficulty: values.difficulty,
        knowledge_points: values.knowledge_points ? values.knowledge_points.split(',').map((kp: string) => kp.trim()) : [],
        explanation: values.explanation,
        score: values.score || 1
      }
      
      // 根据题目类型处理选项和答案
      if (questionType === 'single_choice' || questionType === 'multiple_choice') {
        const options = []
        const correctAnswers = []
        
        for (let i = 0; i < optionCount; i++) {
          const optionKey = String.fromCharCode(65 + i) // A, B, C, D...
          const optionContent = values[`option_${optionKey}`]
          if (optionContent) {
            options.push({
              content: optionContent,
              is_correct: questionType === 'single_choice' 
                ? values.correct_answer === optionKey
                : (values.correct_answers || []).includes(optionKey)
            })
            
            if (questionType === 'single_choice' && values.correct_answer === optionKey) {
              correctAnswers.push(optionKey)
            } else if (questionType === 'multiple_choice' && (values.correct_answers || []).includes(optionKey)) {
              correctAnswers.push(optionKey)
            }
          }
        }
        
        questionData.options = JSON.stringify(options)
        questionData.correct_answer = correctAnswers.join(',')
      } else if (questionType === 'true_false') {
        questionData.correct_answer = values.correct_answer
      } else if (questionType === 'short_answer') {
        questionData.answer = values.answer
      }
      
      await questionsApi.create(questionData)
      message.success('题目创建成功')
      setShowAddModal(false)
      addForm.resetFields()
      setQuestionType('single_choice')
      setOptionCount(4)
      loadQuestions()
    } catch (error: any) {
      console.error('创建题目错误:', error)
      message.error(error.response?.data?.message || '创建题目失败')
    } finally {
      setAddLoading(false)
    }
  }
  
  // 题目类型变化处理
  const handleQuestionTypeChange = (type: string) => {
    setQuestionType(type)
    if (type === 'single_choice' || type === 'multiple_choice') {
      setOptionCount(4)
    }
  }
  
  // 选项数量变化处理
  const handleOptionCountChange = (count: number) => {
    setOptionCount(count)
    // 清除多余的选项值
    const formValues = addForm.getFieldsValue()
    const newValues = { ...formValues }
    for (let i = count; i < 8; i++) {
      const optionKey = String.fromCharCode(65 + i)
      delete newValues[`option_${optionKey}`]
    }
    addForm.setFieldsValue(newValues)
  }

  const downloadTemplate = () => {
    try {
      // 创建示例CSV内容
      const csvContent = `题目标题,题目内容,题目类型,难度等级,分值,知识点,选项A,选项B,选项C,选项D,正确答案,解析
"JavaScript数据类型题","以下哪个是JavaScript的数据类型？","single_choice","medium","1","JavaScript基础,数据类型","string","number","boolean","以上都是","D","JavaScript有多种基本数据类型"
"变量声明题","JavaScript中var和let的区别是什么？","multiple_choice","hard","2","JavaScript基础,变量声明","var有函数作用域","let有块级作用域","var可以重复声明","let不可以重复声明","A,C","var和let在作用域和声明方面有区别"
"判断题示例","JavaScript是一种编程语言","true_false","easy","1","JavaScript基础","","","","","true","JavaScript确实是一种编程语言"
"简答题示例","请简述JavaScript的特点","short_answer","medium","5","JavaScript基础","","","","","JavaScript是一种动态类型的解释型编程语言","这是简答题的参考答案"`
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', '题目导入模板.csv')
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      message.success('模板下载成功')
    } catch (error) {
      console.error('模板下载失败:', error)
      message.error('模板下载失败，请稍后重试')
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
      message.error('请先选择要删除的题目')
      return
    }
    setIsBatchDelete(true)
    setShowDeleteModal(true)
  }

  const executeBatchDelete = async () => {
    try {
      // 批量删除API调用
      await Promise.all(selectedQuestions.map(id => questionsApi.delete(id)))
      message.success(`成功删除 ${selectedQuestions.length} 道题目`)
      setSelectedQuestions([])
      setSelectAll(false)
      setShowDeleteModal(false)
      setIsBatchDelete(false)
      loadQuestions()
    } catch (error: any) {
      console.error('批量删除错误:', error)
      message.error('批量删除失败')
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
    <div style={{ padding: '24px' }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: '24px' }}>
        <Title level={2} style={{ margin: 0 }}>题目管理</Title>
        <Paragraph type="secondary" style={{ margin: '8px 0 0 0' }}>
          管理考试题库中的所有题目
        </Paragraph>
      </div>

      {/* 操作栏 */}
      <Card style={{ marginBottom: '24px' }}>
        <Row gutter={[16, 16]} align="middle">
          <Col flex="auto">
            <Space size="middle" style={{ width: '100%' }}>
              {/* 搜索框 */}
              <AntSearch
                placeholder="搜索题目..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                style={{ width: 300 }}
                allowClear
              />

              {/* 筛选器 */}
              <Select
                value={filterType}
                onChange={handleFilterChange}
                style={{ width: 150 }}
                placeholder="题目类型"
              >
                <Select.Option value="all">所有类型</Select.Option>
                <Select.Option value="single_choice">单选题</Select.Option>
                <Select.Option value="multiple_choice">多选题</Select.Option>
                <Select.Option value="true_false">判断题</Select.Option>
                <Select.Option value="short_answer">简答题</Select.Option>
              </Select>
            </Space>
          </Col>
          
          <Col>
            <Space>
              {/* 操作按钮 */}
              {selectedQuestions.length > 0 && (
                <Button
                  danger
                  icon={<Trash2 size={16} />}
                  onClick={handleBatchDelete}
                >
                  批量删除 ({selectedQuestions.length})
                </Button>
              )}
              <Button
                type="default"
                icon={<Upload size={16} />}
                onClick={() => setShowImportModal(true)}
              >
                批量导入
              </Button>
              <Button
                type="primary"
                icon={<Plus size={16} />}
                onClick={() => setShowAddModal(true)}
              >
                新增题目
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 题目列表 */}
      <Card>
        <Table
          rowSelection={{
             type: 'checkbox',
             selectedRowKeys: selectedQuestions,
             onChange: (selectedRowKeys) => {
               setSelectedQuestions(selectedRowKeys as string[])
             },
             onSelectAll: (selected) => {
               if (selected) {
                 setSelectedQuestions(questions.map(q => q.id))
               } else {
                 setSelectedQuestions([])
               }
               setSelectAll(selected)
             }
           }}
          columns={[
            {
              title: '题目内容',
              dataIndex: 'content',
              key: 'content',
              ellipsis: {
                showTitle: false,
              },
              render: (content: string) => (
                <Tooltip placement="topLeft" title={content}>
                  <span>{content}</span>
                </Tooltip>
              ),
            },
            {
              title: '题目类型',
              dataIndex: 'question_type',
              key: 'question_type',
              width: 120,
              render: (type: string) => {
                const typeConfig = {
                  'single_choice': { color: 'blue', text: '单选题' },
                  'multiple_choice': { color: 'green', text: '多选题' },
                  'true_false': { color: 'orange', text: '判断题' },
                  'short_answer': { color: 'purple', text: '简答题' }
                }
                const config = typeConfig[type as keyof typeof typeConfig] || { color: 'default', text: type }
                return <Tag color={config.color}>{config.text}</Tag>
              },
            },
            {
              title: '知识点',
              dataIndex: 'knowledge_points',
              key: 'knowledge_points',
              width: 200,
              render: (points: string[]) => (
                <div>
                  {points && points.length > 0 ? (
                    points.slice(0, 2).map((point, index) => (
                      <Tag key={index} style={{ marginBottom: 4 }}>
                        {point}
                      </Tag>
                    ))
                  ) : (
                    <span style={{ color: '#999' }}>-</span>
                  )}
                  {points && points.length > 2 && (
                    <Tooltip title={points.slice(2).join(', ')}>
                      <Tag>+{points.length - 2}</Tag>
                    </Tooltip>
                  )}
                </div>
              ),
            },
            {
              title: '创建时间',
              dataIndex: 'created_at',
              key: 'created_at',
              width: 180,
              render: (date: string) => new Date(date).toLocaleString('zh-CN'),
            },
            {
              title: '操作',
              key: 'action',
              width: 150,
              render: (_, record: Question) => (
                <Space size="small">
                  <Tooltip title="查看">
                    <Button
                      type="text"
                      icon={<Eye size={16} />}
                      onClick={() => navigate(`/admin/question-detail/${record.id}`)}
                    />
                  </Tooltip>
                  <Tooltip title="编辑">
                    <Button
                      type="text"
                      icon={<Edit size={16} />}
                      onClick={() => navigate(`/admin/question-edit/${record.id}`)}
                    />
                  </Tooltip>
                  <Tooltip title="删除">
                    <Button
                      type="text"
                      danger
                      icon={<Trash2 size={16} />}
                      onClick={() => {
                        setSelectedQuestion(record)
                        setShowDeleteModal(true)
                      }}
                    />
                  </Tooltip>
                </Space>
              ),
            },
          ]}
          dataSource={filteredQuestions}
          rowKey="id"
          pagination={{
            current: currentPage,
            total: totalQuestions,
            pageSize: pageSize,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            onChange: setCurrentPage,
            onShowSizeChange: (current, newPageSize) => {
              setPageSize(newPageSize)
              setCurrentPage(1)
            },
          }}
          locale={{
            emptyText: (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <BookOpen size={48} style={{ color: '#d9d9d9', marginBottom: 16 }} />
                <div style={{ color: '#999' }}>暂无题目</div>
              </div>
            ),
          }}
        />
      </Card>

      {/* 删除确认对话框 */}
      <Modal
        title="确认删除"
        open={showDeleteModal && (isBatchDelete || selectedQuestion)}
        onCancel={() => {
          setShowDeleteModal(false)
          setIsBatchDelete(false)
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setShowDeleteModal(false)
            setIsBatchDelete(false)
          }}>
            取消
          </Button>,
          <Button 
            key="delete" 
            type="primary" 
            danger
            onClick={() => {
              if (isBatchDelete) {
                executeBatchDelete()
              } else if (selectedQuestion) {
                handleDelete(selectedQuestion.id)
              }
            }}
          >
            确认删除
          </Button>
        ]}
      >
        <p>
          {isBatchDelete 
            ? `确定要删除选中的 ${selectedQuestions.length} 道题目吗？此操作无法撤销。`
            : `确定要删除题目 ${selectedQuestion?.content}？此操作无法撤销。`
          }
        </p>
      </Modal>

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
        width={800}
        footer={[
          <Button 
            key="cancel" 
            onClick={() => {
              setShowAddModal(false)
              addForm.resetFields()
              setQuestionType('single_choice')
              setOptionCount(4)
            }}
            disabled={addLoading}
          >
            取消
          </Button>,
          <Button
            key="submit"
            type="primary"
            onClick={() => addForm.submit()}
            loading={addLoading}
          >
            创建题目
          </Button>
        ]}
      >
        <Form
          form={addForm}
          layout="vertical"
          onFinish={handleAddQuestion}
        >
          <Form.Item
            name="title"
            label="题目标题"
            rules={[{ required: true, message: '请输入题目标题' }]}
          >
            <Input placeholder="请输入题目标题" />
          </Form.Item>

          <Form.Item
            name="content"
            label="题目内容"
            rules={[{ required: true, message: '请输入题目内容' }]}
          >
            <Input.TextArea rows={3} placeholder="请输入题目内容" />
          </Form.Item>

          <Form.Item
            label="题目类型"
            required
          >
            <Radio.Group
              value={questionType}
              onChange={(e) => handleQuestionTypeChange(e.target.value)}
            >
              <Radio value="single_choice">单选题</Radio>
              <Radio value="multiple_choice">多选题</Radio>
              <Radio value="true_false">判断题</Radio>
              <Radio value="short_answer">简答题</Radio>
            </Radio.Group>
          </Form.Item>

          {(questionType === 'single_choice' || questionType === 'multiple_choice') && (
            <>
              <Form.Item label="选项数量">
                <Select
                  value={optionCount}
                  onChange={handleOptionCountChange}
                  style={{ width: 120 }}
                >
                  <Select.Option value={2}>2个</Select.Option>
                  <Select.Option value={3}>3个</Select.Option>
                  <Select.Option value={4}>4个</Select.Option>
                  <Select.Option value={5}>5个</Select.Option>
                  <Select.Option value={6}>6个</Select.Option>
                </Select>
              </Form.Item>

              {Array.from({ length: optionCount }, (_, i) => {
                const optionKey = String.fromCharCode(65 + i)
                return (
                  <Form.Item
                    key={optionKey}
                    name={`option_${optionKey}`}
                    label={`选项${optionKey}`}
                    rules={[{ required: true, message: `请输入选项${optionKey}` }]}
                  >
                    <Input placeholder={`请输入选项${optionKey}内容`} />
                  </Form.Item>
                )
              })}

              {questionType === 'single_choice' && (
                <Form.Item
                  name="correct_answer"
                  label="正确答案"
                  rules={[{ required: true, message: '请选择正确答案' }]}
                >
                  <Radio.Group>
                    {Array.from({ length: optionCount }, (_, i) => {
                      const optionKey = String.fromCharCode(65 + i)
                      return (
                        <Radio key={optionKey} value={optionKey}>
                          选项{optionKey}
                        </Radio>
                      )
                    })}
                  </Radio.Group>
                </Form.Item>
              )}

              {questionType === 'multiple_choice' && (
                <Form.Item
                  name="correct_answers"
                  label="正确答案（多选）"
                  rules={[{ required: true, message: '请选择正确答案' }]}
                >
                  <Select
                    mode="multiple"
                    placeholder="请选择正确答案"
                  >
                    {Array.from({ length: optionCount }, (_, i) => {
                      const optionKey = String.fromCharCode(65 + i)
                      return (
                        <Select.Option key={optionKey} value={optionKey}>
                          选项{optionKey}
                        </Select.Option>
                      )
                    })}
                  </Select>
                </Form.Item>
              )}
            </>
          )}

          {questionType === 'true_false' && (
            <Form.Item
              name="correct_answer"
              label="正确答案"
              rules={[{ required: true, message: '请选择正确答案' }]}
            >
              <Radio.Group>
                <Radio value="true">正确</Radio>
                <Radio value="false">错误</Radio>
              </Radio.Group>
            </Form.Item>
          )}

          {questionType === 'short_answer' && (
            <Form.Item
              name="answer"
              label="参考答案"
              rules={[{ required: true, message: '请输入参考答案' }]}
            >
              <Input.TextArea rows={3} placeholder="请输入参考答案" />
            </Form.Item>
          )}

          <Form.Item
            name="difficulty"
            label="难度等级"
            rules={[{ required: true, message: '请选择难度等级' }]}
          >
            <Select placeholder="请选择难度等级">
              <Select.Option value="easy">简单</Select.Option>
              <Select.Option value="medium">中等</Select.Option>
              <Select.Option value="hard">困难</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="knowledge_points"
            label="知识点"
            extra="多个知识点用逗号分隔"
          >
            <Input placeholder="请输入知识点，多个用逗号分隔" />
          </Form.Item>

          <Form.Item
            name="score"
            label="分值"
            initialValue={1}
          >
            <Input type="number" min={1} placeholder="请输入题目分值" />
          </Form.Item>

          <Form.Item
            name="explanation"
            label="题目解析"
          >
            <Input.TextArea rows={3} placeholder="请输入题目解析" />
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
        width={800}
        footer={[
          <Button 
            key="cancel" 
            onClick={() => {
              setShowImportModal(false)
              setImportFile(null)
              setImportProgress(0)
            }}
            disabled={importing}
          >
            取消
          </Button>,
          <Button
            key="import"
            type="primary"
            onClick={handleImport}
            disabled={!importFile || importing}
            loading={importing}
            icon={!importing && <Upload />}
          >
            {importing ? '导入中...' : '开始导入'}
          </Button>
        ]}
      >
        {/* 导入说明 */}
        <Alert
          message="导入说明"
          description={
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              <li>支持Excel文件(.xlsx, .xls)和CSV文件(.csv)</li>
              <li>文件大小不能超过10MB，单次最多导入1000道题目</li>
              <li>请按照模板格式准备数据，必填字段：题目标题、题目内容、题目类型、难度等级</li>
              <li>题目类型：single_choice(单选)、multiple_choice(多选)、true_false(判断)、short_answer(简答)</li>
              <li>难度等级：easy(简单)、medium(中等)、hard(困难)</li>
              <li>多选题正确答案用逗号分隔，如：A,C</li>
            </ul>
          }
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        {/* 下载模板 */}
        <div style={{ marginBottom: 24 }}>
          <Button 
            onClick={downloadTemplate}
            icon={<Download size={16} />}
          >
            下载导入模板
          </Button>
        </div>

        {/* 文件选择 */}
        <div style={{ marginBottom: 24 }}>
          <AntUpload.Dragger
            accept=".xlsx,.xls,.csv"
            beforeUpload={(file) => {
              setImportFile(file)
              return false
            }}
            fileList={importFile ? [{
              uid: '1',
              name: importFile.name,
              status: 'done' as const
            }] : []}
            onRemove={() => setImportFile(null)}
            disabled={importing}
            style={{ padding: '20px' }}
          >
            <div style={{ textAlign: 'center' }}>
              <FileText size={48} style={{ color: '#d9d9d9', marginBottom: 16 }} />
              <div style={{ fontSize: 16, marginBottom: 8 }}>
                {importFile ? importFile.name : '点击选择文件或拖拽文件到此处'}
              </div>
              <div style={{ color: '#999', fontSize: 14 }}>
                支持 .xlsx, .xls, .csv 格式
              </div>
            </div>
          </AntUpload.Dragger>
        </div>

        {/* 导入进度 */}
        {importing && (
          <Card size="small" style={{ marginBottom: 24 }}>
            <div style={{ marginBottom: 8 }}>
              <Typography.Text strong>导入进度</Typography.Text>
            </div>
            <Progress 
              percent={importProgress} 
              status="active"
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
            />
          </Card>
        )}
      </Modal>
    </div>
  )
}

export default QuestionManagementPage