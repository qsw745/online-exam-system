import { pool } from '../config/database';
import { logUserAction, logSystemLog } from './logger.service';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface IWrongQuestionBook {
  id?: number;
  user_id: number;
  name: string;
  description?: string;
  is_default: boolean;
  is_public: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface IWrongQuestion {
  id?: number;
  book_id: number;
  question_id: number;
  exam_result_id?: number;
  wrong_count: number;
  last_wrong_time: string;
  mastery_level: 'not_mastered' | 'partially_mastered' | 'mastered';
  tags?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface IPracticeRecord {
  id?: number;
  user_id: number;
  wrong_question_id: number;
  is_correct: boolean;
  time_spent: number;
  practice_time: string;
  created_at?: string;
}

export interface IWrongQuestionBookShare {
  id?: number;
  book_id: number;
  shared_by: number;
  shared_to?: number;
  share_code: string;
  is_public: boolean;
  access_count: number;
  expires_at?: string;
  created_at?: string;
}

export class WrongQuestionService {
  // 错题本管理
  static async createBook(bookData: Omit<IWrongQuestionBook, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    try {
      const { user_id, name, description, is_default, is_public } = bookData;
      
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO wrong_question_books (user_id, name, description, is_default, is_public) 
         VALUES (?, ?, ?, ?, ?)`,
        [user_id, name, description || '', is_default, is_public]
      );
      
      logUserAction(user_id, 'create_wrong_question_book', 'wrong_question_books', result.insertId, { name });
      return result.insertId;
    } catch (error: any) {
      logSystemLog('error', 'Failed to create wrong question book', { error: error.message, user_id: bookData.user_id });
      throw error;
    }
  }

  static async getUserBooks(userId: number): Promise<any[]> {
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT wqb.*, 
                COUNT(wq.id) as question_count,
                COUNT(CASE WHEN wq.mastery_level = 'mastered' THEN 1 END) as mastered_count
         FROM wrong_question_books wqb
         LEFT JOIN wrong_questions wq ON wqb.id = wq.book_id
         WHERE wqb.user_id = ?
         GROUP BY wqb.id
         ORDER BY wqb.is_default DESC, wqb.created_at DESC`,
        [userId]
      );
      
      return rows;
    } catch (error: any) {
      logSystemLog('error', 'Failed to get user wrong question books', { error: error.message, user_id: userId });
      throw error;
    }
  }

  static async updateBook(bookId: number, userId: number, updates: Partial<IWrongQuestionBook>): Promise<void> {
    try {
      const fields = Object.keys(updates).filter(key => key !== 'id' && key !== 'user_id').map(key => `${key} = ?`);
      const values = Object.keys(updates).filter(key => key !== 'id' && key !== 'user_id').map(key => updates[key as keyof IWrongQuestionBook]);
      
      if (fields.length === 0) {
        return;
      }

      await pool.execute(
        `UPDATE wrong_question_books SET ${fields.join(', ')}, updated_at = NOW() 
         WHERE id = ? AND user_id = ?`,
        [...values, bookId, userId]
      );
      
      logUserAction(userId, 'update_wrong_question_book', 'wrong_question_books', bookId, updates);
    } catch (error: any) {
      logSystemLog('error', 'Failed to update wrong question book', { error: error.message, book_id: bookId, user_id: userId });
      throw error;
    }
  }

  static async deleteBook(bookId: number, userId: number): Promise<void> {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // 检查是否为默认错题本
      const [rows] = await connection.execute<RowDataPacket[]>(
        'SELECT is_default FROM wrong_question_books WHERE id = ? AND user_id = ?',
        [bookId, userId]
      );
      
      if (rows.length === 0) {
        throw new Error('错题本不存在');
      }
      
      if (rows[0].is_default) {
        throw new Error('默认错题本不能删除');
      }

      // 删除错题本及相关数据
      await connection.execute(
        'DELETE FROM wrong_question_practice_records WHERE wrong_question_id IN (SELECT id FROM wrong_questions WHERE book_id = ?)',
        [bookId]
      );
      
      await connection.execute('DELETE FROM wrong_questions WHERE book_id = ?', [bookId]);
      await connection.execute('DELETE FROM wrong_question_book_shares WHERE book_id = ?', [bookId]);
      await connection.execute('DELETE FROM wrong_question_books WHERE id = ? AND user_id = ?', [bookId, userId]);
      
      await connection.commit();
      logUserAction(userId, 'delete_wrong_question_book', 'wrong_question_books', bookId);
    } catch (error: any) {
      await connection.rollback();
      logSystemLog('error', 'Failed to delete wrong question book', { error: error.message, book_id: bookId, user_id: userId });
      throw error;
    } finally {
      connection.release();
    }
  }

  // 错题管理
  static async addWrongQuestion(questionData: Omit<IWrongQuestion, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    try {
      const { book_id, question_id, exam_result_id, wrong_count, last_wrong_time, mastery_level, tags, notes } = questionData;
      
      // 检查是否已存在
      const [existingRows] = await pool.execute<RowDataPacket[]>(
        'SELECT id, wrong_count FROM wrong_questions WHERE book_id = ? AND question_id = ?',
        [book_id, question_id]
      );
      
      if (existingRows.length > 0) {
        // 更新现有记录
        const existingId = existingRows[0].id;
        await pool.execute(
          `UPDATE wrong_questions SET 
           wrong_count = wrong_count + ?, 
           last_wrong_time = ?, 
           exam_result_id = COALESCE(?, exam_result_id),
           mastery_level = ?,
           tags = COALESCE(?, tags),
           notes = COALESCE(?, notes),
           updated_at = NOW()
           WHERE id = ?`,
          [wrong_count, last_wrong_time, exam_result_id, mastery_level, tags, notes, existingId]
        );
        return existingId;
      } else {
        // 创建新记录
        const [result] = await pool.execute<ResultSetHeader>(
          `INSERT INTO wrong_questions (book_id, question_id, exam_result_id, wrong_count, last_wrong_time, mastery_level, tags, notes) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [book_id, question_id, exam_result_id, wrong_count, last_wrong_time, mastery_level, tags || '', notes || '']
        );
        return result.insertId;
      }
    } catch (error: any) {
      logSystemLog('error', 'Failed to add wrong question', { error: error.message, question_id: questionData.question_id });
      throw error;
    }
  }

  static async getWrongQuestions(bookId: number, userId: number, options: {
    page?: number;
    limit?: number;
    mastery_level?: string;
    tags?: string;
    search?: string;
  } = {}): Promise<{ questions: any[], total: number }> {
    try {
      const { page = 1, limit = 20, mastery_level, tags, search } = options;
      const offset = (page - 1) * limit;
      
      // 验证用户权限
      const [bookRows] = await pool.execute<RowDataPacket[]>(
        'SELECT id FROM wrong_question_books WHERE id = ? AND user_id = ?',
        [bookId, userId]
      );
      
      if (bookRows.length === 0) {
        throw new Error('无权访问此错题本');
      }

      let whereClause = 'WHERE wq.book_id = ?';
      let params: any[] = [bookId];
      
      if (mastery_level) {
        whereClause += ' AND wq.mastery_level = ?';
        params.push(mastery_level);
      }
      
      if (tags) {
        whereClause += ' AND wq.tags LIKE ?';
        params.push(`%${tags}%`);
      }
      
      if (search) {
        whereClause += ' AND (q.content LIKE ? OR q.title LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }

      // 获取总数
      const [countRows] = await pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM wrong_questions wq 
         JOIN questions q ON wq.question_id = q.id ${whereClause}`,
        params
      );

      // 获取分页数据
      const [dataRows] = await pool.execute<RowDataPacket[]>(
        `SELECT wq.*, q.content, q.title, q.type, q.difficulty,
                COUNT(pr.id) as practice_count,
                COUNT(CASE WHEN pr.is_correct = 1 THEN 1 END) as correct_count
         FROM wrong_questions wq
         JOIN questions q ON wq.question_id = q.id
         LEFT JOIN wrong_question_practice_records pr ON wq.id = pr.wrong_question_id
         ${whereClause}
         GROUP BY wq.id
         ORDER BY wq.last_wrong_time DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      return {
        questions: dataRows,
        total: countRows[0].total
      };
    } catch (error: any) {
      logSystemLog('error', 'Failed to get wrong questions', { error: error.message, book_id: bookId, user_id: userId });
      throw error;
    }
  }

  static async updateWrongQuestion(questionId: number, userId: number, updates: Partial<IWrongQuestion>): Promise<void> {
    try {
      // 验证权限
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT wq.id FROM wrong_questions wq 
         JOIN wrong_question_books wqb ON wq.book_id = wqb.id 
         WHERE wq.id = ? AND wqb.user_id = ?`,
        [questionId, userId]
      );
      
      if (rows.length === 0) {
        throw new Error('无权修改此错题');
      }

      const fields = Object.keys(updates).filter(key => key !== 'id').map(key => `${key} = ?`);
      const values = Object.keys(updates).filter(key => key !== 'id').map(key => updates[key as keyof IWrongQuestion]);
      
      if (fields.length === 0) {
        return;
      }

      await pool.execute(
        `UPDATE wrong_questions SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`,
        [...values, questionId]
      );
      
      logUserAction(userId, 'update_wrong_question', 'wrong_questions', questionId, updates);
    } catch (error: any) {
      logSystemLog('error', 'Failed to update wrong question', { error: error.message, question_id: questionId, user_id: userId });
      throw error;
    }
  }

  static async removeWrongQuestion(questionId: number, userId: number): Promise<void> {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // 验证权限
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT wq.id FROM wrong_questions wq 
         JOIN wrong_question_books wqb ON wq.book_id = wqb.id 
         WHERE wq.id = ? AND wqb.user_id = ?`,
        [questionId, userId]
      );
      
      if (rows.length === 0) {
        throw new Error('无权删除此错题');
      }

      await connection.execute('DELETE FROM wrong_question_practice_records WHERE wrong_question_id = ?', [questionId]);
      await connection.execute('DELETE FROM wrong_questions WHERE id = ?', [questionId]);
      
      await connection.commit();
      logUserAction(userId, 'remove_wrong_question', 'wrong_questions', questionId);
    } catch (error: any) {
      await connection.rollback();
      logSystemLog('error', 'Failed to remove wrong question', { error: error.message, question_id: questionId, user_id: userId });
      throw error;
    } finally {
      connection.release();
    }
  }

  // 练习记录
  static async addPracticeRecord(recordData: Omit<IPracticeRecord, 'id' | 'created_at'>): Promise<number> {
    try {
      const { user_id, wrong_question_id, is_correct, time_spent, practice_time } = recordData;
      
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO wrong_question_practice_records (user_id, wrong_question_id, is_correct, time_spent, practice_time) 
         VALUES (?, ?, ?, ?, ?)`,
        [user_id, wrong_question_id, is_correct, time_spent, practice_time]
      );
      
      // 更新掌握程度
      await WrongQuestionService.updateMasteryLevel(wrong_question_id, is_correct);
      logUserAction(user_id, 'practice_wrong_question', 'wrong_question_practice_records', result.insertId, { is_correct, time_spent });
      
      return result.insertId;
    } catch (error: any) {
      logSystemLog('error', 'Failed to add practice record', { error: error.message, user_id: recordData.user_id, wrong_question_id: recordData.wrong_question_id });
      throw error;
    }
  }

  static async updateMasteryLevel(wrongQuestionId: number, isCorrect: boolean): Promise<void> {
    try {
      // 获取最近的练习记录
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT is_correct FROM wrong_question_practice_records 
         WHERE wrong_question_id = ? 
         ORDER BY practice_time DESC LIMIT 5`,
        [wrongQuestionId]
      );

      let masteryLevel = 'not_mastered';
      
      if (rows.length >= 3) {
        const recentCorrect = rows.slice(0, 3).every(r => r.is_correct);
        const allCorrect = rows.every(r => r.is_correct);
        
        if (allCorrect && rows.length >= 5) {
          masteryLevel = 'mastered';
        } else if (recentCorrect) {
          masteryLevel = 'partially_mastered';
        }
      }

      await pool.execute(
        'UPDATE wrong_questions SET mastery_level = ?, updated_at = NOW() WHERE id = ?',
        [masteryLevel, wrongQuestionId]
      );
    } catch (error: any) {
      logSystemLog('error', 'Failed to update mastery level', { error: error.message, wrong_question_id: wrongQuestionId });
      throw error;
    }
  }

  // 错题本分享
  static async shareBook(bookId: number, userId: number, shareData: {
    shared_to?: number;
    is_public: boolean;
    expires_at?: string;
  }): Promise<string> {
    try {
      // 验证权限
      const [rows] = await pool.execute<RowDataPacket[]>(
        'SELECT id FROM wrong_question_books WHERE id = ? AND user_id = ?',
        [bookId, userId]
      );
      
      if (rows.length === 0) {
        throw new Error('无权分享此错题本');
      }

      const shareCode = Math.random().toString(36).substring(2, 15);
      const { shared_to, is_public, expires_at } = shareData;

      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO wrong_question_book_shares (book_id, shared_by, shared_to, share_code, is_public, expires_at) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [bookId, userId, shared_to || null, shareCode, is_public, expires_at || null]
      );
      
      logUserAction(userId, 'share_wrong_question_book', 'wrong_question_book_shares', result.insertId, { share_code: shareCode, is_public });
      return shareCode;
    } catch (error: any) {
      logSystemLog('error', 'Failed to share wrong question book', { error: error.message, book_id: bookId, user_id: userId });
      throw error;
    }
  }

  static async getSharedBook(shareCode: string, userId: number): Promise<any> {
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT wqbs.*, wqb.name, wqb.description, u.username as shared_by_name
         FROM wrong_question_book_shares wqbs
         JOIN wrong_question_books wqb ON wqbs.book_id = wqb.id
         JOIN users u ON wqbs.shared_by = u.id
         WHERE wqbs.share_code = ? AND (wqbs.expires_at IS NULL OR wqbs.expires_at > NOW())
         AND (wqbs.is_public = 1 OR wqbs.shared_to = ? OR wqbs.shared_by = ?)`,
        [shareCode, userId, userId]
      );
      
      if (rows.length === 0) {
        throw new Error('分享链接无效或已过期');
      }
      
      // 增加访问次数
      await pool.execute('UPDATE wrong_question_book_shares SET access_count = access_count + 1 WHERE id = ?', [rows[0].id]);
      
      return rows[0];
    } catch (error: any) {
      logSystemLog('error', 'Failed to get shared wrong question book', { error: error.message, share_code: shareCode, user_id: userId });
      throw error;
    }
  }

  // 统计信息
  static async getStatistics(userId: number): Promise<any> {
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT 
           COUNT(DISTINCT wqb.id) as book_count,
           COUNT(DISTINCT wq.id) as total_wrong_questions,
           COUNT(CASE WHEN wq.mastery_level = 'mastered' THEN 1 END) as mastered_count,
           COUNT(CASE WHEN wq.mastery_level = 'partially_mastered' THEN 1 END) as partially_mastered_count,
           COUNT(CASE WHEN wq.mastery_level = 'not_mastered' THEN 1 END) as not_mastered_count,
           COUNT(DISTINCT pr.id) as total_practice_count,
           COUNT(CASE WHEN pr.is_correct = 1 THEN 1 END) as correct_practice_count
         FROM wrong_question_books wqb
         LEFT JOIN wrong_questions wq ON wqb.id = wq.book_id
         LEFT JOIN wrong_question_practice_records pr ON wq.id = pr.wrong_question_id
         WHERE wqb.user_id = ?`,
        [userId]
      );
      
      return rows[0];
    } catch (error: any) {
      logSystemLog('error', 'Failed to get wrong question statistics', { error: error.message, user_id: userId });
      throw error;
    }
  }

  // 从考试结果中获取错题
  static async getWrongQuestionsFromExamResult(examResultId: number): Promise<any[]> {
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT DISTINCT 
           era.question_id,
           q.title,
           q.content,
           q.type,
           q.difficulty,
           e.title as exam_title,
           s.name as subject
         FROM exam_result_answers era
         JOIN questions q ON era.question_id = q.id
         JOIN exam_results er ON era.exam_result_id = er.id
         JOIN exams e ON er.exam_id = e.id
         LEFT JOIN subjects s ON q.subject_id = s.id
         WHERE era.exam_result_id = ? 
         AND era.is_correct = 0`,
        [examResultId]
      );
      
      return rows;
    } catch (error: any) {
      logSystemLog('error', 'Failed to get wrong questions from exam result', { error: error.message, exam_result_id: examResultId });
      throw error;
    }
  }

  // 批量操作
  static async batchAddWrongQuestions(bookId: number, questionIds: number[], examResultId?: number): Promise<{ success: number[], failed: { questionId: number, error: string }[] }> {
    const success: number[] = [];
    const failed: { questionId: number, error: string }[] = [];
    
    for (const questionId of questionIds) {
      try {
        await WrongQuestionService.addWrongQuestion({
          book_id: bookId,
          question_id: questionId,
          exam_result_id: examResultId,
          wrong_count: 1,
          last_wrong_time: new Date().toISOString(),
          mastery_level: 'not_mastered',
          tags: '',
          notes: ''
        });
        success.push(questionId);
      } catch (error: any) {
        failed.push({ questionId, error: error.message });
      }
    }
    
    return { success, failed };
  }
}