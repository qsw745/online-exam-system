import { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { pool } from '../config/database.js';

export interface INotification extends RowDataPacket {
  id: number;
  user_id: number;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'error' | 'success';
  is_read: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface IUnreadCount extends RowDataPacket {
  unread_count: number;
}

export class Notification {
  private static pool: Pool = pool;

  static async list(userId: number, page: number = 1, limit: number = 10): Promise<{ notifications: INotification[]; total: number }> {
    const offset = (page - 1) * limit;
    const [notifications] = await this.pool.query<INotification[]>(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [userId, limit, offset]
    );

    const [totalResult] = await this.pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as total FROM notifications WHERE user_id = ?',
      [userId]
    );

    return {
      notifications,
      total: totalResult[0].total
    };
  }

  static async unreadCount(userId: number): Promise<number> {
    const [result] = await this.pool.query<IUnreadCount[]>(
      'SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = ? AND is_read = false',
      [userId]
    );
    return result[0].unread_count;
  }

  static async markAsRead(userId: number, notificationId: number): Promise<boolean> {
    const [result] = await this.pool.query<ResultSetHeader>(
      'UPDATE notifications SET is_read = true, updated_at = NOW() WHERE id = ? AND user_id = ?',
      [notificationId, userId]
    );
    return result.affectedRows > 0;
  }

  static async create(notification: Omit<INotification, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const [result] = await this.pool.query<ResultSetHeader>(
      'INSERT INTO notifications (user_id, title, content, type, is_read) VALUES (?, ?, ?, ?, ?)',
      [notification.user_id, notification.title, notification.content, notification.type, notification.is_read]
    );
    return result.insertId;
  }

  static async delete(userId: number, notificationId: number): Promise<boolean> {
    const [result] = await this.pool.query<ResultSetHeader>(
      'DELETE FROM notifications WHERE id = ? AND user_id = ?',
      [notificationId, userId]
    );
    return result.affectedRows > 0;
  }
}
