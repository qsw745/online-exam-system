/* eslint-disable @typescript-eslint/no-explicit-any */
// 没装 @types/node 时做最小声明
import { log } from '@/infrastructure/logging/logger'

declare const process: any

import type { EmailConfig, EmailTemplate } from '@/types/password-reset.js'

class EmailService {
  private transporter: any | null = null
  private isConfigured = false

  constructor() {
    void this.initializeTransporter()
  }

  private async initializeTransporter() {
    try {
      if (!process?.env?.EMAIL_HOST || !process?.env?.EMAIL_USER || !process?.env?.EMAIL_PASS) {
        log.warn('邮件服务未配置，将使用控制台输出模拟发送')
        this.isConfigured = false
        return
      }

      const config: EmailConfig = {
        host: process.env.EMAIL_HOST!,
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: process.env.EMAIL_SECURE === 'true',
        auth: { user: process.env.EMAIL_USER!, pass: process.env.EMAIL_PASS! },
      }

      const mod: any = await import('nodemailer')
      const nodemailer = mod?.default ?? mod
      this.transporter = nodemailer.createTransport(config as any)

      if (process.env.EMAIL_USER === 'your_email@qq.com' || process.env.EMAIL_PASS === 'your_email_password') {
        log.warn('邮件服务使用默认配置，请在 .env 文件中配置真实的邮箱信息')
        this.isConfigured = false
        return
      }

      this.transporter.verify((error: any) => {
        if (error) {
          log.error('邮件服务配置验证失败:', error?.message || error)
          this.isConfigured = false
        } else {
          // 避免 log.log(Level) 类型冲突，使用 info
          log.info('邮件服务配置验证成功')
          this.isConfigured = true
        }
      })
    } catch (error) {
      log.error('邮件服务初始化失败:', error)
      this.isConfigured = false
    }
  }

  async sendPasswordResetEmail(to: string, resetToken: string, username: string): Promise<boolean> {
    const base = process?.env?.FRONTEND_URL || 'http://localhost:5173'
    const resetUrl = `${String(base).replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(resetToken)}`
    const template = this.generatePasswordResetTemplate(username, resetUrl)
    return this.sendEmail(to, template)
  }

  private generatePasswordResetTemplate(username: string, resetUrl: string): EmailTemplate {
    const subject = '密码重置请求 - 在线考试系统'
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      .container{max-width:600px;margin:0 auto;font-family:Arial}
      .header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:20px;text-align:center}
      .content{padding:30px;background:#f9f9f9}
      .button{display:inline-block;background:#667eea;color:#fff;padding:12px 30px;text-decoration:none;border-radius:5px;margin:20px 0}
      .footer{padding:20px;text-align:center;color:#666;font-size:12px}
      .warning{background:#fff3cd;border:1px solid #ffeaa7;padding:15px;border-radius:5px;margin:20px 0}
    </style></head><body><div class="container">
      <div class="header"><h1>密码重置请求</h1></div>
      <div class="content">
        <p>亲爱的 ${username}，</p>
        <p>我们收到了您的密码重置请求。如果这是您本人的操作，请点击下面的按钮重置您的密码：</p>
        <div style="text-align:center;"><a href="${resetUrl}" class="button">重置密码</a></div>
        <div class="warning"><strong>重要提醒：</strong>
          <ul><li>此链接将在 1 小时后过期</li><li>如果您没有请求重置密码，请忽略此邮件</li><li>请不要将此链接分享给他人</li></ul>
        </div>
        <p>如果按钮无法点击，请复制以下链接到浏览器地址栏：</p>
        <p style="word-break:break-all;background:#f0f0f0;padding:10px;border-radius:3px;">${resetUrl}</p>
      </div>
      <div class="footer"><p>此邮件由系统自动发送，请勿回复。</p><p>© 2024 在线考试系统.</p></div>
    </div></body></html>`
    const text = `密码重置请求

亲爱的 ${username}，

我们收到了您的密码重置请求。如为本人操作，请访问：
${resetUrl}

重要提醒：
- 链接 1 小时后过期
- 若非本人操作请忽略
- 不要将该链接分享给他人

此邮件由系统自动发送，请勿回复。© 2024 在线考试系统。`
    return { subject, html, text }
  }

  private async sendEmail(to: string, template: EmailTemplate): Promise<boolean> {
    try {
      if (!this.isConfigured || !this.transporter) {
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
