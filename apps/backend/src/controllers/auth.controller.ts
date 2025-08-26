import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { pool } from '../config/database.js';
import { RowDataPacket } from 'mysql2';
import { ApiResponse } from '../types/response.js';
import crypto from 'crypto';
import { emailService } from '../utils/email.service.js';
import { LoggerService } from '../services/logger.service.js';

interface IUser extends RowDataPacket {
  id: number;
  username: string;
  email: string;
  password: string;
  role: 'student' | 'teacher' | 'admin';
  created_at: Date;
  updated_at: Date;
}

type AuthResponseData = {
  token: string;
  user?: Omit<IUser, 'password'>;
};

interface JwtPayload {
  id: number;
  email: string;
  role: 'student' | 'teacher' | 'admin';
}

export class AuthController {
  static async register(req: AuthRequest, res: Response<ApiResponse<AuthResponseData>>) {
    try {
      const { username, email, password, role } = req.body;

      if (!email || !password || !role) {
        const errorResponse: ApiResponse<AuthResponseData> = {
          success: false,
          error: '缺少必填字段'
        };
        return res.status(400).json(errorResponse);
      }

      if (!['student', 'teacher', 'admin'].includes(role)) {
        const errorResponse: ApiResponse<AuthResponseData> = {
          success: false,
          error: '无效的用户角色'
        };
        return res.status(400).json(errorResponse);
      }

      const [existingUsers] = await pool.query<IUser[]>(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );

      if (existingUsers.length > 0) {
        const errorResponse: ApiResponse<AuthResponseData> = {
          success: false,
          error: '用户已存在'
        };
        return res.status(409).json(errorResponse);
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const [result] = await pool.query(
        'INSERT INTO users (username, email, password, role, nickname) VALUES (?, ?, ?, ?, ?)',
        [username || email.split('@')[0], email, hashedPassword, role, username]
      );

      const userId = (result as any).insertId;
      const payload: JwtPayload = { id: userId, email, role };
      const token = jwt.sign(
        payload,
        process.env.JWT_SECRET!,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      const [newUser] = await pool.query<IUser[]>(
        'SELECT id, username, email, role, nickname, created_at, updated_at FROM users WHERE id = ?',
        [userId]
      );

      const successResponse: ApiResponse<AuthResponseData> = {
        success: true,
        data: {
          token,
          user: newUser[0]
        }
      };
      return res.status(201).json(successResponse);
    } catch (error) {
      console.error('注册用户错误:', error);
      const errorResponse: ApiResponse<AuthResponseData> = {
        success: false,
        error: error instanceof Error ? error.message : '创建用户失败'
      };
      return res.status(500).json(errorResponse);
    }
  }

static async login(req: AuthRequest, res: Response<ApiResponse<AuthResponseData>>) {
  try {
    const { email, password } = req.body;

    const [users] = await pool.query<IUser[]>(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      await LoggerService.logLogin({
        username: email,
        status: 'failed',
        failureReason: '用户不存在',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      return res.status(401).json({ success: false, error: '用户不存在' });
    }

    const user = users[0];

    // ✅ 关键：状态检查，禁用用户不可登录
    if (user.status && user.status.toLowerCase() !== 'active') {
      await LoggerService.logLogin({
        userId: user.id,
        username: user.username || user.email,
        status: 'failed',
        failureReason: '账号已被禁用',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      return res.status(403).json({ success: false, error: '账号已被禁用，请联系管理员' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      await LoggerService.logLogin({
        userId: user.id,
        username: user.username || user.email,
        status: 'failed',
        failureReason: '密码错误',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      return res.status(401).json({ success: false, error: '密码错误' });
    }

    const payload: JwtPayload = { id: user.id, email: user.email, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: process.env.JWT_EXPIRES_IN });

    await LoggerService.logLogin({
      userId: user.id,
      username: user.username || user.email,
      status: 'success',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    const { password: _, ...userWithoutPassword } = user;
    return res.json({
      success: true,
      data: { token, user: userWithoutPassword }
    });
  } catch (error) {
    console.error('用户登录错误:', error);
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : '登录失败' });
  }
}


  // 忘记密码 - 发送重置邮件
  static async forgotPassword(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          error: '邮箱地址不能为空'
        });
      }

      // 检查用户是否存在
      const [users] = await pool.execute<IUser[]>(
        'SELECT id, email FROM users WHERE email = ?',
        [email]
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          error: '该邮箱地址未注册'
        });
      }

      const user = users[0];
      
      // 生成重置令牌
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24小时后过期

      // 删除该用户之前的重置令牌
      await pool.execute(
        'DELETE FROM password_reset_tokens WHERE user_id = ?',
        [user.id]
      );

      // 保存新的重置令牌
      await pool.execute(
        'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
        [user.id, resetToken, expiresAt]
      );

      // 发送重置邮件
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
      await emailService.sendPasswordResetEmail(email, resetUrl);

      return res.json({
        success: true,
        message: '密码重置邮件已发送，请查收邮件'
      });
    } catch (error) {
      console.error('忘记密码错误:', error);
      return res.status(500).json({
        success: false,
        error: '发送重置邮件失败，请稍后重试'
      });
    }
  }

  // 验证重置令牌
  static async validateResetToken(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          error: '重置令牌不能为空'
        });
      }

      // 查找有效的重置令牌
      const [tokens] = await pool.execute<RowDataPacket[]>(
        'SELECT * FROM password_reset_tokens WHERE token = ? AND expires_at > NOW()',
        [token]
      );

      if (tokens.length === 0) {
        return res.status(410).json({
          success: false,
          error: '重置链接无效或已过期'
        });
      }

      return res.json({
        success: true,
        message: '重置令牌有效'
      });
    } catch (error) {
      console.error('验证重置令牌错误:', error);
      return res.status(500).json({
        success: false,
        error: '验证失败，请稍后重试'
      });
    }
  }

  // 重置密码
  static async resetPassword(req: AuthRequest, res: Response<ApiResponse<any>>) {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({
          success: false,
          error: '重置令牌和新密码不能为空'
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          error: '密码长度至少为6位'
        });
      }

      // 查找有效的重置令牌
      const [tokens] = await pool.execute<RowDataPacket[]>(
        'SELECT user_id FROM password_reset_tokens WHERE token = ? AND expires_at > NOW()',
        [token]
      );

      if (tokens.length === 0) {
        return res.status(410).json({
          success: false,
          error: '重置链接无效或已过期'
        });
      }

      const userId = tokens[0].user_id;
      
      // 加密新密码
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // 更新用户密码
      await pool.execute(
        'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?',
        [hashedPassword, userId]
      );

      // 删除已使用的重置令牌
      await pool.execute(
        'DELETE FROM password_reset_tokens WHERE token = ?',
        [token]
      );

      return res.json({
        success: true,
        message: '密码重置成功'
      });
    } catch (error) {
      console.error('重置密码错误:', error);
      return res.status(500).json({
        success: false,
        error: '密码重置失败，请稍后重试'
      });
    }
  }
}