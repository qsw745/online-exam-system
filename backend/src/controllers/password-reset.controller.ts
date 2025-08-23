import { Request, Response } from 'express';
import { pool } from '../config/database.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { ApiResponse } from '../types/response.js';
import { 
  ForgotPasswordRequest, 
  ResetPasswordRequest, 
  PasswordResetResponse,
  PasswordResetToken 
} from '../types/password-reset.js';
import { emailService } from '../utils/email.service.js';

interface IUser extends RowDataPacket {
  id: number;
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'teacher' | 'student';
  created_at: Date;
  updated_at: Date;
}

interface IPasswordResetToken extends RowDataPacket {
  id: number;
  user_id: number;
  token: string;
  expires_at: Date;
  used: boolean;
  created_at: Date;
  updated_at: Date;
}

export class PasswordResetController {
  /**
   * 发送密码重置邮件
   */
  static async forgotPassword(req: Request, res: Response<ApiResponse<PasswordResetResponse>>) {
    try {
      const { email }: ForgotPasswordRequest = req.body;

      if (!email) {
        const errorResponse: ApiResponse<PasswordResetResponse> = {
          success: false,
          error: '邮箱地址不能为空'
        };
        return res.status(400).json(errorResponse);
      }

      // 验证邮箱格式
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        const errorResponse: ApiResponse<PasswordResetResponse> = {
          success: false,
          error: '邮箱格式不正确'
        };
        return res.status(400).json(errorResponse);
      }

      // 查找用户
      const [users] = await pool.query<IUser[]>(
        'SELECT id, username, email FROM users WHERE email = ?',
        [email]
      );

      // 无论用户是否存在，都返回成功消息（安全考虑）
      if (users.length === 0) {
        const successResponse: ApiResponse<PasswordResetResponse> = {
          success: true,
          data: {
            success: true,
            message: '如果该邮箱已注册，您将收到密码重置邮件'
          }
        };
        return res.json(successResponse);
      }

      const user = users[0];

      // 检查是否有未过期的重置令牌
      const [existingTokens] = await pool.query<IPasswordResetToken[]>(
        'SELECT * FROM password_reset_tokens WHERE user_id = ? AND expires_at > NOW() AND used = FALSE',
        [user.id]
      );

      // 如果存在未过期的令牌，限制频繁请求
      if (existingTokens.length > 0) {
        const lastToken = existingTokens[0];
        const timeDiff = Date.now() - new Date(lastToken.created_at).getTime();
        const minutesSinceLastRequest = Math.floor(timeDiff / (1000 * 60));

        if (minutesSinceLastRequest < 5) {
          const errorResponse: ApiResponse<PasswordResetResponse> = {
            success: false,
            error: '请求过于频繁，请5分钟后再试'
          };
          return res.status(429).json(errorResponse);
        }
      }

      // 生成重置令牌
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1小时后过期

      // 使数据库事务
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        // 将之前的令牌标记为已使用
        await connection.query(
          'UPDATE password_reset_tokens SET used = TRUE WHERE user_id = ? AND used = FALSE',
          [user.id]
        );

        // 插入新的重置令牌
        await connection.query<ResultSetHeader>(
          'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
          [user.id, resetToken, expiresAt]
        );

        await connection.commit();

        // 发送重置邮件
        const emailSent = await emailService.sendPasswordResetEmail(
          user.email,
          resetToken,
          user.username
        );

        if (!emailSent) {
          console.error('密码重置邮件发送失败');
          // 即使邮件发送失败，也不向用户暴露具体错误
        }

        const successResponse: ApiResponse<PasswordResetResponse> = {
          success: true,
          data: {
            success: true,
            message: '如果该邮箱已注册，您将收到密码重置邮件'
          }
        };
        return res.json(successResponse);

      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }

    } catch (error) {
      console.error('忘记密码处理错误:', error);
      const errorResponse: ApiResponse<PasswordResetResponse> = {
        success: false,
        error: '服务器内部错误，请稍后重试'
      };
      return res.status(500).json(errorResponse);
    }
  }

  /**
   * 验证重置令牌
   */
  static async validateResetToken(req: Request, res: Response<ApiResponse<{ valid: boolean; email?: string }>>) {
    try {
      const { token } = req.params;

      if (!token) {
        const errorResponse: ApiResponse<{ valid: boolean; email?: string }> = {
          success: false,
          error: '重置令牌不能为空'
        };
        return res.status(400).json(errorResponse);
      }

      // 查找令牌
      const [tokens] = await pool.query<IPasswordResetToken[]>(
        `SELECT prt.*, u.email 
         FROM password_reset_tokens prt 
         JOIN users u ON prt.user_id = u.id 
         WHERE prt.token = ? AND prt.expires_at > NOW() AND prt.used = FALSE`,
        [token]
      );

      if (tokens.length === 0) {
        const errorResponse: ApiResponse<{ valid: boolean; email?: string }> = {
          success: false,
          error: '重置令牌无效或已过期'
        };
        return res.status(400).json(errorResponse);
      }

      const tokenData = tokens[0] as IPasswordResetToken & { email: string };

      const successResponse: ApiResponse<{ valid: boolean; email?: string }> = {
        success: true,
        data: {
          valid: true,
          email: tokenData.email
        }
      };
      return res.json(successResponse);

    } catch (error) {
      console.error('验证重置令牌错误:', error);
      const errorResponse: ApiResponse<{ valid: boolean; email?: string }> = {
        success: false,
        error: '服务器内部错误'
      };
      return res.status(500).json(errorResponse);
    }
  }

  /**
   * 重置密码
   */
  static async resetPassword(req: Request, res: Response<ApiResponse<PasswordResetResponse>>) {
    try {
      const { token, newPassword, confirmPassword }: ResetPasswordRequest = req.body;

      // 验证输入
      if (!token || !newPassword || !confirmPassword) {
        const errorResponse: ApiResponse<PasswordResetResponse> = {
          success: false,
          error: '所有字段都是必填的'
        };
        return res.status(400).json(errorResponse);
      }

      if (newPassword !== confirmPassword) {
        const errorResponse: ApiResponse<PasswordResetResponse> = {
          success: false,
          error: '两次输入的密码不一致'
        };
        return res.status(400).json(errorResponse);
      }

      if (newPassword.length < 6) {
        const errorResponse: ApiResponse<PasswordResetResponse> = {
          success: false,
          error: '密码长度至少为6位'
        };
        return res.status(400).json(errorResponse);
      }

      // 查找有效的重置令牌
      const [tokens] = await pool.query<IPasswordResetToken[]>(
        `SELECT prt.*, u.id as user_id, u.email 
         FROM password_reset_tokens prt 
         JOIN users u ON prt.user_id = u.id 
         WHERE prt.token = ? AND prt.expires_at > NOW() AND prt.used = FALSE`,
        [token]
      );

      if (tokens.length === 0) {
        const errorResponse: ApiResponse<PasswordResetResponse> = {
          success: false,
          error: '重置令牌无效或已过期'
        };
        return res.status(400).json(errorResponse);
      }

      const tokenData = tokens[0] as IPasswordResetToken & { email: string };

      // 使用数据库事务
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        // 加密新密码
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // 更新用户密码
        await connection.query(
          'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?',
          [hashedPassword, tokenData.user_id]
        );

        // 标记令牌为已使用
        await connection.query(
          'UPDATE password_reset_tokens SET used = TRUE, updated_at = NOW() WHERE id = ?',
          [tokenData.id]
        );

        // 清理该用户的其他未使用令牌
        await connection.query(
          'UPDATE password_reset_tokens SET used = TRUE WHERE user_id = ? AND used = FALSE',
          [tokenData.user_id]
        );

        await connection.commit();

        const successResponse: ApiResponse<PasswordResetResponse> = {
          success: true,
          data: {
            success: true,
            message: '密码重置成功，请使用新密码登录'
          }
        };
        return res.json(successResponse);

      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }

    } catch (error) {
      console.error('重置密码错误:', error);
      const errorResponse: ApiResponse<PasswordResetResponse> = {
        success: false,
        error: '服务器内部错误，请稍后重试'
      };
      return res.status(500).json(errorResponse);
    }
  }

  /**
   * 清理过期令牌（管理员功能）
   */
  static async cleanExpiredTokens(req: Request, res: Response<ApiResponse<{ cleaned: number }>>) {
    try {
      const [result] = await pool.query<ResultSetHeader>(
        'DELETE FROM password_reset_tokens WHERE expires_at < NOW() OR used = TRUE'
      );

      const successResponse: ApiResponse<{ cleaned: number }> = {
        success: true,
        data: {
          cleaned: result.affectedRows
        }
      };
      return res.json(successResponse);

    } catch (error) {
      console.error('清理过期令牌错误:', error);
      const errorResponse: ApiResponse<{ cleaned: number }> = {
        success: false,
        error: '清理失败'
      };
      return res.status(500).json(errorResponse);
    }
  }
}