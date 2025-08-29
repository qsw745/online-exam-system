import { RowDataPacket } from 'mysql2';
import { pool } from '../config/database.js';

export interface IResult extends RowDataPacket {
  id: number;
  user_id: number;
  paper_id: number;
  score: number;
  answers: string;
  start_time: Date;
  end_time: Date;
  status: 'pending' | 'in_progress' | 'completed';
  created_at: Date;
  updated_at: Date;
}

export class Result {
  static async list(userId: number, limit: number = 10) {
    const [results] = await pool.query<IResult[]>(
      `SELECT 
        r.id,
        r.user_id,
        r.paper_id,
        r.score,
        r.answers,
        r.start_time,
        r.end_time,
        r.status,
        r.created_at,
        r.updated_at
      FROM results r
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
      LIMIT ?`,
      [userId, limit]
    );
    return results;
  }

  static async findById(id: number, userId: number) {
    const [results] = await pool.query<IResult[]>(
      `SELECT 
        r.id,
        r.user_id,
        r.paper_id,
        r.score,
        r.answers,
        r.start_time,
        r.end_time,
        r.status,
        r.created_at,
        r.updated_at
      FROM results r
      WHERE r.id = ? AND r.user_id = ?`,
      [id, userId]
    );
    return results[0];
  }

  static async create(data: Omit<IResult, 'id' | 'created_at' | 'updated_at'>) {
    const [result] = await pool.query(
      `INSERT INTO results (
        user_id,
        paper_id,
        score,
        answers,
        start_time,
        end_time,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.user_id,
        data.paper_id,
        data.score,
        data.answers,
        data.start_time,
        data.end_time,
        data.status
      ]
    );
    return result;
  }

  static async update(id: number, userId: number, data: Partial<Omit<IResult, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) {
    const [result] = await pool.query(
      `UPDATE results
      SET ?
      WHERE id = ? AND user_id = ?`,
      [data, id, userId]
    );
    return result;
  }
}
