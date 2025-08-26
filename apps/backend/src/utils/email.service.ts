import nodemailer from 'nodemailer';
import { EmailConfig, EmailTemplate } from '../types/password-reset.js';

class EmailService {
  private transporter: any | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    try {
      // 检查是否配置了邮件服务
      if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('邮件服务未配置，将使用控制台输出模拟发送');
        this.isConfigured = false;
        return;
      }

      const config: EmailConfig = {
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      };

      // 创建nodemailer传输器
      this.transporter = nodemailer.createTransport(config);
      
      // 检查邮箱配置是否为默认占位符
      if (process.env.EMAIL_USER === 'your_email@qq.com' || process.env.EMAIL_PASS === 'your_email_password') {
        console.warn('邮件服务使用默认配置，请在.env文件中配置真实的邮箱信息');
        this.isConfigured = false;
        return;
      }
      
      // 验证配置（异步验证，不阻塞启动）
      this.transporter.verify((error: any, success: boolean) => {
        if (error) {
          console.error('邮件服务配置验证失败:', error.message);
          this.isConfigured = false;
        } else {
          console.log('邮件服务配置验证成功');
          this.isConfigured = true;
        }
      });
    } catch (error) {
      console.error('邮件服务初始化失败:', error);
      this.isConfigured = false;
    }
  }

  async sendPasswordResetEmail(to: string, resetToken: string, username: string): Promise<boolean> {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
    
    const template = this.generatePasswordResetTemplate(username, resetUrl);
    
    return this.sendEmail(to, template);
  }

  private generatePasswordResetTemplate(username: string, resetUrl: string): EmailTemplate {
    const subject = '密码重置请求 - 在线考试系统';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background: #f9f9f9; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>密码重置请求</h1>
          </div>
          <div class="content">
            <p>亲爱的 ${username}，</p>
            <p>我们收到了您的密码重置请求。如果这是您本人的操作，请点击下面的按钮重置您的密码：</p>
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">重置密码</a>
            </div>
            <div class="warning">
              <strong>重要提醒：</strong>
              <ul>
                <li>此链接将在 1 小时后过期</li>
                <li>如果您没有请求重置密码，请忽略此邮件</li>
                <li>为了您的账户安全，请不要将此链接分享给他人</li>
              </ul>
            </div>
            <p>如果按钮无法点击，请复制以下链接到浏览器地址栏：</p>
            <p style="word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 3px;">${resetUrl}</p>
          </div>
          <div class="footer">
            <p>此邮件由系统自动发送，请勿回复。</p>
            <p>© 2024 在线考试系统. 保留所有权利。</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const text = `
      密码重置请求
      
      亲爱的 ${username}，
      
      我们收到了您的密码重置请求。如果这是您本人的操作，请访问以下链接重置您的密码：
      
      ${resetUrl}
      
      重要提醒：
      - 此链接将在 1 小时后过期
      - 如果您没有请求重置密码，请忽略此邮件
      - 为了您的账户安全，请不要将此链接分享给他人
      
      此邮件由系统自动发送，请勿回复。
      © 2024 在线考试系统. 保留所有权利。
    `;
    
    return { subject, html, text };
  }

  private async sendEmail(to: string, template: EmailTemplate): Promise<boolean> {
    try {
      if (!this.isConfigured || !this.transporter) {
        // 如果邮件服务未配置，使用模拟发送
        console.log('\n=== 模拟邮件发送（邮件服务未配置）===');
        console.log(`收件人: ${to}`);
        console.log(`主题: ${template.subject}`);
        console.log(`内容: ${template.text}`);
        console.log('==================\n');
        return true;
      }

      // 发送真实邮件
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: to,
        subject: template.subject,
        html: template.html,
        text: template.text
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('邮件发送成功:', result.messageId);
      return true;
    } catch (error) {
      console.error('邮件发送失败:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.isConfigured) {
      return false;
    }

    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('邮件服务连接测试失败:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();