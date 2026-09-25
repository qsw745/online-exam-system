/* eslint-disable @typescript-eslint/no-explicit-any */
import { log } from '@/infrastructure/logging/logger'
declare const process: any

import type { EmailConfig, EmailTemplate } from '@/types/password-reset.js'
import { buildPasswordResetEmail, buildVerificationEmail } from './email.templates.js'

class EmailService {
  private transporter: any | null = null
  private isConfigured = false
  private readonly ready: Promise<void>

  constructor() {
    this.ready = this.initializeTransporter()
  }

  private async initializeTransporter() {
    try {
      if (!process?.env?.EMAIL_HOST || !process?.env?.EMAIL_USER || !process?.env?.EMAIL_PASS) {
        log.warn(process.env.NODE_ENV === 'production' ? '邮件服务未配置，拒绝发送' : '邮件服务未配置，将使用控制台输出模拟发送')
        this.isConfigured = false
        return
      }

      const config: EmailConfig = {
        host: process.env.EMAIL_HOST!,
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: process.env.EMAIL_SECURE === 'true',
        auth: { user: process.env.EMAIL_USER!, pass: process.env.EMAIL_PASS! },
      }

      // ✅ 关键修复：用 Function + 动态 import 字符串，避免 TS 去解析 @types/nodemailer
      const dynamicImport = new Function('m', 'return import(m)') as (m: string) => Promise<any>
      const mod: any = await dynamicImport('nodemailer')
      const nodemailer = mod?.default ?? mod
      this.transporter = nodemailer.createTransport(config as any)

      if (process.env.EMAIL_USER === 'your_email@qq.com' || process.env.EMAIL_PASS === 'your_email_password') {
        log.warn('邮件服务使用默认配置，请在 .env 文件中配置真实的邮箱信息')
        this.isConfigured = false
        return
      }

      await this.transporter.verify()
      log.info('邮件服务配置验证成功')
      this.isConfigured = true
    } catch (error) {
      log.error('邮件服务初始化失败:', error)
      this.isConfigured = false
    }
  }

  async sendPasswordResetEmail(to: string, resetToken: string, username: string): Promise<boolean> {
    const base = process?.env?.PUBLIC_FRONTEND_URL || process?.env?.FRONTEND_URL || 'http://localhost:5173'
    const resetUrl = `${String(base).replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(resetToken)}`
    const template = buildPasswordResetEmail({ username, resetUrl })
    return this.sendEmail(to, template)
  }

  async sendVerificationEmail(to: string, verifyToken: string, username: string): Promise<boolean> {
    const base = process?.env?.PUBLIC_FRONTEND_URL || process?.env?.FRONTEND_URL || 'http://localhost:5173'
    const verifyUrl = `${String(base).replace(/\/$/, '')}/verify-email?token=${encodeURIComponent(verifyToken)}`
    const template = buildVerificationEmail({ username, verifyUrl })
    return this.sendEmail(to, template)
  }

  async sendPlainEmail(to: string, subject: string, content: string): Promise<boolean> {
    const safeSubject = String(subject || '').trim() || '通知'
    const safeContent = String(content || '').trim() || '请查看系统消息。'
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><pre style="white-space:pre-wrap;font-family:Arial">${safeContent}</pre></body></html>`
    const template: EmailTemplate = { subject: safeSubject, html, text: safeContent }
    return this.sendEmail(to, template)
  }

  private async sendEmail(to: string, template: EmailTemplate): Promise<boolean> {
    try {
      await this.ready
      if (!this.isConfigured || !this.transporter) {
        // 正式服务必须确认真实投递，不能把模拟输出当作成功。
        if (process.env.NODE_ENV === 'production') return false
        console.log('\n=== 模拟邮件发送（邮件服务未配置）===')
        console.log(`收件人: ${to}`)
        console.log(`主题: ${template.subject}`)
        console.log(`内容: ${template.text}`)
        console.log('==================\n')
        return true
      }

      const result = await this.transporter.sendMail({
        from: process.env.EMAIL_USER,
        to,
        subject: template.subject,
        html: template.html,
        text: template.text,
      })
      console.log('邮件发送成功:', result?.messageId)
      return true
    } catch (error) {
      console.error('邮件发送失败:', error)
      return false
    }
  }

  async testConnection(): Promise<boolean> {
    await this.ready
    if (!this.isConfigured || !this.transporter) return false
    try {
      await this.transporter.verify()
      return true
    } catch (error) {
      console.error('邮件服务连接测试失败:', error)
      return false
    }
  }
}

export const emailService = new EmailService()
