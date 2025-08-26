import * as XLSX from 'xlsx'
import Papa from 'papaparse'

export interface ParsedQuestion {
  content: string
  question_type: string
  options?: {
    content: string
    is_correct: boolean
  }[]
  answer?: string
  knowledge_points?: string[]
  explanation?: string
}

export interface ParseResult {
  success: boolean
  data?: ParsedQuestion[]
  errors?: string[]
  total?: number
}

// 解析CSV文件
export const parseCSVFile = (file: File): Promise<ParseResult> => {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      encoding: 'UTF-8',
      complete: (results) => {
        try {
          const questions = processRawData(results.data)
          resolve({
            success: true,
            data: questions.validQuestions,
            errors: questions.errors,
            total: results.data.length
          })
        } catch (error) {
          resolve({
            success: false,
            errors: [`CSV解析错误: ${error instanceof Error ? error.message : '未知错误'}`]
          })
        }
      },
      error: (error) => {
        resolve({
          success: false,
          errors: [`CSV文件读取失败: ${error.message}`]
        })
      }
    })
  })
}

// 解析Excel文件
export const parseExcelFile = (file: File): Promise<ParseResult> => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        
        // 获取第一个工作表
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        
        // 转换为JSON格式
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
        
        // 处理数据（第一行作为标题）
        const headers = jsonData[0] as string[]
        const rows = jsonData.slice(1)
        
        const formattedData = rows.map(row => {
          const obj: any = {}
          headers.forEach((header, index) => {
            obj[header] = (row as any[])[index] || ''
          })
          return obj
        })
        
        const questions = processRawData(formattedData)
        resolve({
          success: true,
          data: questions.validQuestions,
          errors: questions.errors,
          total: formattedData.length
        })
      } catch (error) {
        resolve({
          success: false,
          errors: [`Excel解析错误: ${error instanceof Error ? error.message : '未知错误'}`]
        })
      }
    }
    
    reader.onerror = () => {
      resolve({
        success: false,
        errors: ['Excel文件读取失败']
      })
    }
    
    reader.readAsArrayBuffer(file)
  })
}

// 处理原始数据
const processRawData = (rawData: any[]): { validQuestions: ParsedQuestion[], errors: string[] } => {
  const validQuestions: ParsedQuestion[] = []
  const errors: string[] = []
  
  rawData.forEach((row, index) => {
    try {
      const question = parseQuestionRow(row, index + 1)
      if (question) {
        validQuestions.push(question)
      }
    } catch (error) {
      errors.push(`第${index + 1}行: ${error instanceof Error ? error.message : '解析失败'}`)
    }
  })
  
  return { validQuestions, errors }
}

// 解析单行题目数据
const parseQuestionRow = (row: any, rowIndex: number): ParsedQuestion | null => {
  // 检查必填字段
  const content = row['题目内容'] || row['content'] || ''
  const questionType = row['题目类型'] || row['question_type'] || row['type'] || ''
  
  if (!content.trim()) {
    throw new Error('题目内容不能为空')
  }
  
  if (!questionType.trim()) {
    throw new Error('题目类型不能为空')
  }
  
  // 验证题目类型
  const validTypes = ['single_choice', 'multiple_choice', 'true_false', 'short_answer']
  if (!validTypes.includes(questionType)) {
    throw new Error(`无效的题目类型: ${questionType}，支持的类型: ${validTypes.join(', ')}`)
  }
  
  const question: ParsedQuestion = {
    content: content.trim(),
    question_type: questionType
  }
  
  // 处理选择题选项
  if (questionType === 'single_choice' || questionType === 'multiple_choice') {
    const options = []
    const correctAnswer = (row['正确答案'] || row['answer'] || '').toString().toUpperCase()
    
    // 解析选项
    const optionKeys = ['选项A', '选项B', '选项C', '选项D', 'option_a', 'option_b', 'option_c', 'option_d']
    const optionLabels = ['A', 'B', 'C', 'D']
    
    for (let i = 0; i < 4; i++) {
      const optionContent = row[optionKeys[i]] || row[optionKeys[i + 4]] || ''
      if (optionContent && optionContent.trim()) {
        const isCorrect = questionType === 'single_choice' 
          ? correctAnswer === optionLabels[i]
          : correctAnswer.includes(optionLabels[i])
        
        options.push({
          content: optionContent.trim(),
          is_correct: isCorrect
        })
      }
    }
    
    if (options.length < 2) {
      throw new Error('选择题至少需要2个选项')
    }
    
    if (!options.some(opt => opt.is_correct)) {
      throw new Error('选择题必须有正确答案')
    }
    
    question.options = options
    question.answer = correctAnswer // 添加answer字段
  }
  
  // 处理判断题
  if (questionType === 'true_false') {
    const answer = (row['正确答案'] || row['answer'] || '').toString().toLowerCase()
    if (!['true', 'false', '正确', '错误', '对', '错', '是', '否'].includes(answer)) {
      throw new Error('判断题答案必须是: true/false 或 正确/错误')
    }
    question.answer = ['true', '正确', '对', '是'].includes(answer) ? 'true' : 'false'
  }
  
  // 处理简答题
  if (questionType === 'short_answer') {
    const answer = row['正确答案'] || row['answer'] || ''
    if (!answer.trim()) {
      throw new Error('简答题必须提供参考答案')
    }
    question.answer = answer.trim()
  }
  
  // 处理知识点
  const knowledgePoints = row['知识点'] || row['knowledge_points'] || ''
  if (knowledgePoints && knowledgePoints.trim()) {
    question.knowledge_points = knowledgePoints.split(',').map((kp: string) => kp.trim()).filter((kp: string) => kp)
  }
  
  // 处理解析
  const explanation = row['解析'] || row['explanation'] || ''
  if (explanation && explanation.trim()) {
    question.explanation = explanation.trim()
  }
  
  return question
}

// 主解析函数
export const parseFile = async (file: File): Promise<ParseResult> => {
  const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
  
  switch (fileExtension) {
    case '.csv':
      return parseCSVFile(file)
    case '.xlsx':
    case '.xls':
      return parseExcelFile(file)
    default:
      return {
        success: false,
        errors: ['不支持的文件格式，请使用 .xlsx, .xls 或 .csv 文件']
      }
  }
}