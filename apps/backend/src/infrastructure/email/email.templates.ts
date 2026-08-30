import type { EmailTemplate } from '@/types/password-reset.js'

export type VerificationEmailInput = { username: string; verifyUrl: string }
export type PasswordResetEmailInput = { username: string; resetUrl: string }

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function emailShell(title: string, content: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    .container{max-width:600px;margin:0 auto;font-family:Arial}
    .header{background:#10233f;color:#fff;padding:20px;text-align:center}
    .content{padding:30px;background:#f7f9fc}
    .button{display:inline-block;background:#18a77b;color:#fff;padding:12px 30px;text-decoration:none;border-radius:5px;margin:20px 0}
    .footer{padding:20px;text-align:center;color:#666;font-size:12px}
    .warning{background:#fff8e7;border:1px solid #d9a441;padding:15px;border-radius:5px;margin:20px 0}
  </style></head><body><div class="container">
    <div class="header"><h1>${title}</h1></div>
    <div class="content">${content}</div>
    <div class="footer"><p>此邮件由系统自动发送，请勿回复。</p><p>© 2026 问衡。</p></div>
  </div></body></html>`
}

export function buildVerificationEmail({ username, verifyUrl }: VerificationEmailInput): EmailTemplate {
  const safeUsername = escapeHtml(username)
  const safeVerifyUrl = escapeHtml(verifyUrl)
  const content = `<p>亲爱的 ${safeUsername}，</p>
    <p>感谢注册问衡。请点击下面的按钮完成邮箱验证后再登录：</p>
    <div style="text-align:center;"><a href="${safeVerifyUrl}" class="button">验证邮箱</a></div>
    <div class="warning"><strong>重要提醒：</strong>
      <ul><li>此链接将在 24 小时后过期</li><li>如果这不是你本人注册，请忽略此邮件</li></ul>
    </div>
    <p>如果按钮无法点击，请复制以下链接到浏览器地址栏：</p>
    <p style="word-break:break-all;background:#e7ecf3;padding:10px;border-radius:3px;">${safeVerifyUrl}</p>`

  return {
    subject: '邮箱验证 - 问衡',
    html: emailShell('验证你的邮箱', content),
    text: `邮箱验证\n\n亲爱的 ${username}，\n\n感谢注册问衡。请访问以下链接完成邮箱验证后再登录：\n${verifyUrl}\n\n链接 24 小时后过期。若非本人注册请忽略。\n\n此邮件由系统自动发送，请勿回复。© 2026 问衡。`,
  }
}

export function buildPasswordResetEmail({ username, resetUrl }: PasswordResetEmailInput): EmailTemplate {
  const safeUsername = escapeHtml(username)
  const safeResetUrl = escapeHtml(resetUrl)
  const content = `<p>亲爱的 ${safeUsername}，</p>
    <p>我们收到了您的密码重置请求。如果这是您本人的操作，请点击下面的按钮重置您的密码：</p>
    <div style="text-align:center;"><a href="${safeResetUrl}" class="button">重置密码</a></div>
    <div class="warning"><strong>重要提醒：</strong>
      <ul><li>此链接将在 1 小时后过期</li><li>如果您没有请求重置密码，请忽略此邮件</li><li>请不要将此链接分享给他人</li></ul>
    </div>
    <p>如果按钮无法点击，请复制以下链接到浏览器地址栏：</p>
    <p style="word-break:break-all;background:#e7ecf3;padding:10px;border-radius:3px;">${safeResetUrl}</p>`

  return {
    subject: '密码重置请求 - 问衡',
    html: emailShell('密码重置请求', content),
    text: `密码重置请求\n\n亲爱的 ${username}，\n\n我们收到了您的密码重置请求。如为本人操作，请访问：\n${resetUrl}\n\n重要提醒：\n- 链接 1 小时后过期\n- 若非本人操作请忽略\n- 不要将该链接分享给他人\n\n此邮件由系统自动发送，请勿回复。© 2026 问衡。`,
  }
}
