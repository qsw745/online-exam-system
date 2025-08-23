# 邮件服务配置指南

## 概述

本系统的忘记密码功能需要配置邮件服务来发送密码重置邮件。目前支持SMTP邮件服务。

## 配置步骤

### 1. 选择邮件服务提供商

推荐使用以下邮件服务：
- **QQ邮箱** (推荐，国内用户)
- **163邮箱** (网易邮箱)
- **Gmail** (需要科学上网)
- **Outlook** (微软邮箱)

### 2. 获取邮箱授权码

#### QQ邮箱配置
1. 登录QQ邮箱网页版
2. 点击「设置」→「账户」
3. 找到「POP3/IMAP/SMTP/Exchange/CardDAV/CalDAV服务」
4. 开启「POP3/SMTP服务」或「IMAP/SMTP服务」
5. 按照提示发送短信，获取授权码
6. 保存授权码（这就是你的邮箱密码）

#### 163邮箱配置
1. 登录163邮箱网页版
2. 点击「设置」→「POP3/SMTP/IMAP」
3. 开启「POP3/SMTP服务」和「IMAP/SMTP服务」
4. 设置客户端授权密码
5. 保存授权密码

### 3. 修改环境变量

编辑 `backend/.env` 文件，更新以下配置：

#### QQ邮箱配置示例
```env
# Email Configuration
EMAIL_HOST=smtp.qq.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your_qq_email@qq.com
EMAIL_PASS=your_authorization_code
FRONTEND_URL=http://localhost:5173
```

#### 163邮箱配置示例
```env
# Email Configuration
EMAIL_HOST=smtp.163.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your_163_email@163.com
EMAIL_PASS=your_authorization_code
FRONTEND_URL=http://localhost:5173
```

#### Gmail配置示例
```env
# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_app_password
FRONTEND_URL=http://localhost:5173
```

### 4. 重启服务器

配置完成后，重启后端服务器：
```bash
cd backend
npm run dev
```

## 配置参数说明

| 参数 | 说明 | 示例 |
|------|------|------|
| EMAIL_HOST | SMTP服务器地址 | smtp.qq.com |
| EMAIL_PORT | SMTP端口号 | 587 |
| EMAIL_SECURE | 是否使用SSL | false |
| EMAIL_USER | 邮箱地址 | your_email@qq.com |
| EMAIL_PASS | 邮箱授权码/密码 | 授权码 |
| FRONTEND_URL | 前端地址 | http://localhost:5173 |

## 常见问题

### 1. 邮件发送失败
- 检查邮箱地址和授权码是否正确
- 确认已开启SMTP服务
- 检查网络连接

### 2. 授权失败
- 确认使用的是授权码，不是登录密码
- 检查邮箱服务商的SMTP设置

### 3. 邮件未收到
- 检查垃圾邮件文件夹
- 确认邮箱地址正确
- 查看服务器日志

## 测试邮件服务

配置完成后，可以通过忘记密码功能测试邮件发送：
1. 访问登录页面
2. 点击「忘记密码」
3. 输入已注册的邮箱地址
4. 检查邮箱是否收到重置邮件

## 安全建议

1. 不要在代码中硬编码邮箱密码
2. 使用专门的邮箱账户发送系统邮件
3. 定期更换授权码
4. 监控邮件发送日志