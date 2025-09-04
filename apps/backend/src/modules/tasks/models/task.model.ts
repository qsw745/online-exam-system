import { RowDataPacket, ResultSetHeader, Pool } from 'mysql2/promise';
import { pool } from '../config/database.js';

export interface ITask extends RowDataPacket {
  id: number;
  user_id: number;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed';
  created_at: Date;
  updated_at: Date;
}

export interface TaskListParams {
  user_id: number;
  status?: string;
  limit: number;
  offset: number;
  sort_by: string;
  sort_order: 'asc' | 'desc';
}

export interface TaskListResult {
  tasks: ITask[];
  total: number;
}

export class Task {
  private static pool: Pool = pool;

  static async get(id: number, userId: number): Promise<ITask | null> {
    const [tasks] = await this.pool.query<ITask[]>(
      'SELECT * FROM tasks WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return tasks[0] || null;
  }

  static async list(params: TaskListParams): Promise<TaskListResult> {
    const {
      user_id,
      status,
      limit,
      offset,
      sort_by,
      sort_order
    } = params;

    const conditions: string[] = ['user_id = ?'];
    const values: any[] = [user_id];

    if (status) {
      conditions.push('status = ?');
      values.push(status);
    }

    const whereClause = conditions.join(' AND ');

    const [tasks] = await this.pool.query<ITask[]>(
      `SELECT * FROM tasks WHERE ${whereClause} ORDER BY ${sort_by} ${sort_order} LIMIT ? OFFSET ?`,
      [...values, limit, offset]
    );

    const [totalRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM tasks WHERE ${whereClause}`,
      values
    );

    return {
      tasks,
      total: totalRows[0].total
    };
  }

  static async create(taskData: {
    user_id: number;
    title: string;
    description?: string;
    status?: string;
  }): Promise<ITask> {
    const [result] = await this.pool.query<ResultSetHeader>(
      'INSERT INTO tasks (user_id, title, description, status) VALUES (?, ?, ?, ?)',
      [taskData.user_id, taskData.title, taskData.description, taskData.status || 'pending']
    );

    const [tasks] = await this.pool.query<ITask[]>(
      'SELECT * FROM tasks WHERE id = ?',
      [result.insertId]
    );
    return tasks[0];
  }

  static async update(id: number, userId: number, taskData: {
    title?: string;
    description?: string;
    status?: string;
  }): Promise<ITask | null> {
    const updates: string[] = [];
    const values: any[] = [];

    Object.entries(taskData).forEach(([key, value]) => {
      if (value !== undefined) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (updates.length === 0) return null;

    values.push(id, userId);
    const [result] = await this.pool.query<ResultSetHeader>(
      `UPDATE tasks SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ? AND user_id = ?`,
      values
    );

    if (result.affectedRows === 0) return null;

    const [tasks] = await this.pool.query<ITask[]>(
      'SELECT * FROM tasks WHERE id = ?',
      [id]
    );
    return tasks[0] || null;
  }

  static async delete(id: number, userId: number): Promise<ITask | null> {
    const task = await this.get(id, userId);
    if (!task) return null;

    await this.pool.query<ResultSetHeader>(
      'DELETE FROM tasks WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    return task;
  }
}
