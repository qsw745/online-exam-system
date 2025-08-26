import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database.js';
import { RowDataPacket } from 'mysql2';
import { ApiResponse } from '../types/response.js';

interface IUser extends RowDataPacket {
  id: number;
  username: string;
  email: string;
  password: string;
  role: 'student' | 'teacher' | 'admin';
  created_at: Date;
  updated_at: Date;
}

interface JwtPayload {
  id: number;
  email: string;
  role: 'student' | 'teacher' | 'admin';
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export const auth = async (req: AuthRequest, res: Response<ApiResponse<null>>, next: NextFunction) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      throw new Error();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

    // 验证用户ID是否有效
    if (!decoded.id || isNaN(decoded.id) || decoded.id <= 0) {
      throw new Error('Invalid user ID in token');
    }

    const [users] = await pool.query<IUser[]>(
      'SELECT * FROM users WHERE id = ?',
      [decoded.id]
    );

    if (users.length === 0) {
      throw new Error();
    }

    req.user = decoded;
    next();
  } catch (error) {
    const errorResponse: ApiResponse<null> = {
      success: false,
      error: '请先登录'
    };
    return res.status(401).json(errorResponse);
  }
};

export const checkRole = (roles: ('student' | 'teacher' | 'admin')[]) => {
  return (req: AuthRequest, res: Response<ApiResponse<null>>, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      const errorResponse: ApiResponse<null> = {
        success: false,
        error: '权限不足'
      };
      return res.status(403).json(errorResponse);
    }
    next();
  };
};
