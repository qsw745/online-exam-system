import { Request, Response } from 'express';
import { WrongQuestionService, IWrongQuestionBook, IWrongQuestion, IPracticeRecord } from '../services/wrong-question.service';
import { logUserAction, logSystemLog } from '../services/logger.service';

export class WrongQuestionController {
  // 错题本管理
  static async createBook(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: '未授权访问' });
      }

      const { name, description, is_public = false } = req.body;
      
      if (!name || name.trim().length === 0) {
        return res.status(400).json({ error: '错题本名称不能为空' });
      }

      if (name.length > 100) {
        return res.status(400).json({ error: '错题本名称不能超过100个字符' });
      }

      const bookData: Omit<IWrongQuestionBook, 'id' | 'created_at' | 'updated_at'> = {
        user_id: userId,
        name: name.trim(),
        description: description?.trim() || '',
        is_default: false,
        is_public: Boolean(is_public)
      };

      const bookId = await WrongQuestionService.createBook(bookData);
      
      res.status(201).json({
        message: '错题本创建成功',
        book_id: bookId
      });
    } catch (error: any) {
      logSystemLog('error', 'Failed to create wrong question book', { 
        error: error.message, 
        user_id: req.user?.id 
      });
      res.status(500).json({ error: '创建错题本失败' });
    }
  }

  static async getBooks(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: '未授权访问' });
      }

      const books = await WrongQuestionService.getUserBooks(userId);
      
      res.json({
        message: '获取错题本列表成功',
        books
      });
    } catch (error: any) {
      logSystemLog('error', 'Failed to get wrong question books', { 
        error: error.message, 
        user_id: req.user?.id 
      });
      res.status(500).json({ error: '获取错题本列表失败' });
    }
  }

  static async updateBook(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: '未授权访问' });
      }

      const bookId = parseInt(req.params.id);
      if (isNaN(bookId)) {
        return res.status(400).json({ error: '无效的错题本ID' });
      }

      const { name, description, is_public } = req.body;
      const updates: Partial<IWrongQuestionBook> = {};

      if (name !== undefined) {
        if (!name || name.trim().length === 0) {
          return res.status(400).json({ error: '错题本名称不能为空' });
        }
        if (name.length > 100) {
          return res.status(400).json({ error: '错题本名称不能超过100个字符' });
        }
        updates.name = name.trim();
      }

      if (description !== undefined) {
        updates.description = description?.trim() || '';
      }

      if (is_public !== undefined) {
        updates.is_public = Boolean(is_public);
      }

      await WrongQuestionService.updateBook(bookId, userId, updates);
      
      res.json({ message: '错题本更新成功' });
    } catch (error: any) {
      logSystemLog('error', 'Failed to update wrong question book', { 
        error: error.message, 
        book_id: req.params.id,
        user_id: req.user?.id 
      });
      res.status(500).json({ error: error.message || '更新错题本失败' });
    }
  }

  static async deleteBook(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: '未授权访问' });
      }

      const bookId = parseInt(req.params.id);
      if (isNaN(bookId)) {
        return res.status(400).json({ error: '无效的错题本ID' });
      }

      await WrongQuestionService.deleteBook(bookId, userId);
      
      res.json({ message: '错题本删除成功' });
    } catch (error: any) {
      logSystemLog('error', 'Failed to delete wrong question book', { 
        error: error.message, 
        book_id: req.params.id,
        user_id: req.user?.id 
      });
      res.status(500).json({ error: error.message || '删除错题本失败' });
    }
  }

  // 错题管理
  static async addWrongQuestion(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: '未授权访问' });
      }

      const { book_id, question_id, exam_result_id, tags, notes } = req.body;
      
      if (!book_id || !question_id) {
        return res.status(400).json({ error: '错题本ID和题目ID不能为空' });
      }

      const questionData: Omit<IWrongQuestion, 'id' | 'created_at' | 'updated_at'> = {
        book_id: parseInt(book_id),
        question_id: parseInt(question_id),
        exam_result_id: exam_result_id ? parseInt(exam_result_id) : undefined,
        wrong_count: 1,
        last_wrong_time: new Date().toISOString(),
        mastery_level: 'not_mastered',
        tags: tags?.trim() || '',
        notes: notes?.trim() || ''
      };

      const wrongQuestionId = await WrongQuestionService.addWrongQuestion(questionData);
      
      res.status(201).json({
        message: '错题添加成功',
        wrong_question_id: wrongQuestionId
      });
    } catch (error: any) {
      logSystemLog('error', 'Failed to add wrong question', { 
        error: error.message, 
        user_id: req.user?.id 
      });
      res.status(500).json({ error: '添加错题失败' });
    }
  }

  static async getWrongQuestions(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: '未授权访问' });
      }

      const bookId = parseInt(req.params.bookId);
      if (isNaN(bookId)) {
        return res.status(400).json({ error: '无效的错题本ID' });
      }

      const {
        page = 1,
        limit = 20,
        mastery_level,
        tags,
        search
      } = req.query;

      const options = {
        page: parseInt(page as string) || 1,
        limit: Math.min(parseInt(limit as string) || 20, 100),
        mastery_level: mastery_level as string,
        tags: tags as string,
        search: search as string
      };

      const result = await WrongQuestionService.getWrongQuestions(bookId, userId, options);
      
      res.json({
        message: '获取错题列表成功',
        ...result,
        page: options.page,
        limit: options.limit
      });
    } catch (error: any) {
      logSystemLog('error', 'Failed to get wrong questions', { 
        error: error.message, 
        book_id: req.params.bookId,
        user_id: req.user?.id 
      });
      res.status(500).json({ error: error.message || '获取错题列表失败' });
    }
  }

  static async updateWrongQuestion(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: '未授权访问' });
      }

      const questionId = parseInt(req.params.id);
      if (isNaN(questionId)) {
        return res.status(400).json({ error: '无效的错题ID' });
      }

      const { mastery_level, tags, notes } = req.body;
      const updates: Partial<IWrongQuestion> = {};

      if (mastery_level !== undefined) {
        if (!['not_mastered', 'partially_mastered', 'mastered'].includes(mastery_level)) {
          return res.status(400).json({ error: '无效的掌握程度' });
        }
        updates.mastery_level = mastery_level;
      }

      if (tags !== undefined) {
        updates.tags = tags?.trim() || '';
      }

      if (notes !== undefined) {
        updates.notes = notes?.trim() || '';
      }

      await WrongQuestionService.updateWrongQuestion(questionId, userId, updates);
      
      res.json({ message: '错题更新成功' });
    } catch (error: any) {
      logSystemLog('error', 'Failed to update wrong question', { 
        error: error.message, 
        question_id: req.params.id,
        user_id: req.user?.id 
      });
      res.status(500).json({ error: error.message || '更新错题失败' });
    }
  }

  static async removeWrongQuestion(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: '未授权访问' });
      }

      const questionId = parseInt(req.params.id);
      if (isNaN(questionId)) {
        return res.status(400).json({ error: '无效的错题ID' });
      }

      await WrongQuestionService.removeWrongQuestion(questionId, userId);
      
      res.json({ message: '错题移除成功' });
    } catch (error: any) {
      logSystemLog('error', 'Failed to remove wrong question', { 
        error: error.message, 
        question_id: req.params.id,
        user_id: req.user?.id 
      });
      res.status(500).json({ error: error.message || '移除错题失败' });
    }
  }

  // 练习记录
  static async addPracticeRecord(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: '未授权访问' });
      }

      const { wrong_question_id, is_correct, time_spent } = req.body;
      
      if (!wrong_question_id || is_correct === undefined || !time_spent) {
        return res.status(400).json({ error: '缺少必要参数' });
      }

      const recordData: Omit<IPracticeRecord, 'id' | 'created_at'> = {
        user_id: userId,
        wrong_question_id: parseInt(wrong_question_id),
        is_correct: Boolean(is_correct),
        time_spent: parseInt(time_spent),
        practice_time: new Date().toISOString()
      };

      const recordId = await WrongQuestionService.addPracticeRecord(recordData);
      
      res.status(201).json({
        message: '练习记录添加成功',
        record_id: recordId
      });
    } catch (error: any) {
      logSystemLog('error', 'Failed to add practice record', { 
        error: error.message, 
        user_id: req.user?.id 
      });
      res.status(500).json({ error: '添加练习记录失败' });
    }
  }

  // 错题本分享
  static async shareBook(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: '未授权访问' });
      }

      const bookId = parseInt(req.params.id);
      if (isNaN(bookId)) {
        return res.status(400).json({ error: '无效的错题本ID' });
      }

      const { shared_to, is_public = false, expires_at } = req.body;
      
      const shareData = {
        shared_to: shared_to ? parseInt(shared_to) : undefined,
        is_public: Boolean(is_public),
        expires_at: expires_at || undefined
      };

      const shareCode = await WrongQuestionService.shareBook(bookId, userId, shareData);
      
      res.status(201).json({
        message: '错题本分享成功',
        share_code: shareCode
      });
    } catch (error: any) {
      logSystemLog('error', 'Failed to share wrong question book', { 
        error: error.message, 
        book_id: req.params.id,
        user_id: req.user?.id 
      });
      res.status(500).json({ error: error.message || '分享错题本失败' });
    }
  }

  static async getSharedBook(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: '未授权访问' });
      }

      const { shareCode } = req.params;
      if (!shareCode) {
        return res.status(400).json({ error: '分享码不能为空' });
      }

      const sharedBook = await WrongQuestionService.getSharedBook(shareCode, userId);
      
      res.json({
        message: '获取分享错题本成功',
        shared_book: sharedBook
      });
    } catch (error: any) {
      logSystemLog('error', 'Failed to get shared wrong question book', { 
        error: error.message, 
        share_code: req.params.shareCode,
        user_id: req.user?.id 
      });
      res.status(500).json({ error: error.message || '获取分享错题本失败' });
    }
  }

  // 统计信息
  static async getStatistics(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: '未授权访问' });
      }

      const statistics = await WrongQuestionService.getStatistics(userId);
      
      res.json({
        message: '获取统计信息成功',
        statistics
      });
    } catch (error: any) {
      logSystemLog('error', 'Failed to get wrong question statistics', { 
        error: error.message, 
        user_id: req.user?.id 
      });
      res.status(500).json({ error: '获取统计信息失败' });
    }
  }

  // 批量操作
  static async batchAddWrongQuestions(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { book_id, questions } = req.body;
      
      if (!book_id || !Array.isArray(questions) || questions.length === 0) {
        res.status(400).json({ message: '参数错误' });
        return;
      }
      
      const results = [];
      for (const questionData of questions) {
        try {
          const wrongQuestionId = await WrongQuestionService.addWrongQuestion({
            book_id,
            question_id: questionData.question_id,
            exam_result_id: questionData.exam_result_id,
            wrong_count: questionData.wrong_count || 1,
            last_wrong_time: questionData.last_wrong_time || new Date().toISOString(),
            mastery_level: questionData.mastery_level || 'not_mastered',
            tags: questionData.tags,
            notes: questionData.notes
          });
          results.push({ question_id: questionData.question_id, wrong_question_id: wrongQuestionId, success: true });
        } catch (error: any) {
          results.push({ question_id: questionData.question_id, success: false, error: error.message });
        }
      }
      
      res.json({ message: '批量添加完成', results });
    } catch (error: any) {
      res.status(500).json({ message: '批量添加错题失败', error: error.message });
    }
  }

  // 批量更新掌握程度
  static async batchUpdateMastery(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { updates } = req.body;
      
      if (!Array.isArray(updates) || updates.length === 0) {
        res.status(400).json({ message: '参数错误' });
        return;
      }
      
      const results = [];
      for (const update of updates) {
        try {
          await WrongQuestionService.updateWrongQuestion(update.question_id, userId, {
            mastery_level: update.mastery_level
          });
          results.push({ question_id: update.question_id, success: true });
        } catch (error: any) {
          results.push({ question_id: update.question_id, success: false, error: error.message });
        }
      }
      
      res.json({ message: '批量更新完成', results });
    } catch (error: any) {
      res.status(500).json({ message: '批量更新掌握程度失败', error: error.message });
    }
  }

  // 自动收集错题（从考试结果中）
  static async autoCollectWrongQuestions(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { exam_result_id } = req.body;
      
      if (!exam_result_id) {
        res.status(400).json({ message: '考试结果ID不能为空' });
        return;
      }
      
      // 获取用户的默认错题本
      const books = await WrongQuestionService.getUserBooks(userId);
      let defaultBook = books.find(book => book.is_default);
      
      if (!defaultBook) {
        // 创建默认错题本
        const bookId = await WrongQuestionService.createBook({
          user_id: userId,
          name: '我的错题本',
          description: '系统自动创建的默认错题本',
          is_default: true,
          is_public: false
        });
        defaultBook = { id: bookId };
      }
      
      // 获取考试中的错题
      const wrongQuestions = await WrongQuestionService.getWrongQuestionsFromExamResult(exam_result_id);
      
      const results = [];
      for (const question of wrongQuestions) {
        try {
          const wrongQuestionId = await WrongQuestionService.addWrongQuestion({
            book_id: defaultBook.id,
            question_id: question.question_id,
            exam_result_id: exam_result_id,
            wrong_count: 1,
            last_wrong_time: new Date().toISOString(),
            mastery_level: 'not_mastered',
            tags: question.subject || '',
            notes: `来自考试：${question.exam_title || ''}`
          });
          results.push({ question_id: question.question_id, wrong_question_id: wrongQuestionId, success: true });
        } catch (error: any) {
          results.push({ question_id: question.question_id, success: false, error: error.message });
        }
      }
      
      res.json({ 
        message: '自动收集错题完成', 
        collected_count: results.filter(r => r.success).length,
        total_count: wrongQuestions.length,
        results 
      });
    } catch (error: any) {
      res.status(500).json({ message: '自动收集错题失败', error: error.message });
    }
  }
}