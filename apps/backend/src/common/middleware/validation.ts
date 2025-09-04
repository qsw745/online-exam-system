import { NextFunction, Request, Response } from 'express'
import { validationResult } from 'express-validator'

/**
 * 验证请求中间件
 * 检查 express-validator 的验证结果，如果有错误则返回 400 状态码
 */
export const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req)

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => err.msg)
    res.status(400).json({
      success: false,
      error: '请求参数验证失败',
      details: errorMessages,
    })
    return // 明确 return，避免误解
  }

  next()
}

/**
 * 创建自定义验证器
 */
export const customValidators = {
  // 验证邮箱格式
  isValidEmail: (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(value)
  },

  // 验证密码强度
  isStrongPassword: (value: string): boolean => {
    // 至少8位，包含大小写字母和数字
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/
    return passwordRegex.test(value)
  },

  // 验证手机号格式
  isValidPhone: (value: string): boolean => {
    const phoneRegex = /^1[3-9]\d{9}$/
    return phoneRegex.test(value)
  },

  // 验证日期格式
  isValidDate: (value: string): boolean => {
    const date = new Date(value)
    return date instanceof Date && !isNaN(date.getTime())
  },

  // 验证时间范围
  isValidTimeRange: (startTime: string, endTime: string): boolean => {
    const start = new Date(startTime)
    const end = new Date(endTime)
    return start < end
  },
}

export default validateRequest
