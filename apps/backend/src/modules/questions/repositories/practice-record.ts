import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { masteryFromRecentPractice } from '../../wrong-questions/domain/mastery.js'

/** 必须在事务中调用，使练习记录与错题本同步成功或一同回滚。 */
export async function recordQuestionPractice(
  conn: PoolConnection,
  userId: number,
  questionId: number,
  isCorrect: boolean,
  answer: unknown,
): Promise<void> {
  // 同一用户的并发提交串行处理，避免首次答错创建多个默认错题本。
  await conn.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [userId])
  await conn.query('INSERT INTO practice_records (user_id, question_id, is_correct, user_answer) VALUES (?, ?, ?, ?)', [
    userId, questionId, isCorrect, JSON.stringify(answer ?? null),
  ])
  const [wrongRows] = await conn.query<RowDataPacket[]>(
    `SELECT wq.id FROM wrong_questions wq
     JOIN wrong_question_books book ON book.id = wq.book_id
     WHERE book.user_id = ? AND wq.question_id = ? FOR UPDATE`,
    [userId, questionId],
  )

  if (!isCorrect && !wrongRows.length) {
    const [books] = await conn.query<RowDataPacket[]>(
      'SELECT id FROM wrong_question_books WHERE user_id = ? AND is_default = 1 ORDER BY id LIMIT 1', [userId],
    )
    let bookId = Number(books[0]?.id)
    if (!bookId) {
      const [created] = await conn.query<ResultSetHeader>(
        `INSERT INTO wrong_question_books (user_id, name, description, is_default, is_public)
         VALUES (?, '我的错题本', '练习中答错的题目', 1, 0)`, [userId],
      )
      bookId = created.insertId
    }
    const [created] = await conn.query<ResultSetHeader>(
      `INSERT INTO wrong_questions (book_id, question_id, wrong_count, mastery_level)
       VALUES (?, ?, 0, 'not_mastered')`, [bookId, questionId],
    )
    wrongRows.push({ id: created.insertId } as RowDataPacket)
  }

  for (const row of wrongRows) {
    await conn.query(
      `INSERT INTO wrong_question_practice_records (user_id, wrong_question_id, is_correct, time_spent, practice_time)
       VALUES (?, ?, ?, 0, NOW())`, [userId, row.id, isCorrect],
    )
    const [recent] = await conn.query<RowDataPacket[]>(
      `SELECT is_correct FROM wrong_question_practice_records WHERE wrong_question_id = ?
       ORDER BY practice_time DESC, id DESC LIMIT 5`, [row.id],
    )
    const mastery = masteryFromRecentPractice(recent.map(record => Number(record.is_correct) === 1))
    await conn.query(
      `UPDATE wrong_questions SET mastery_level = ?, wrong_count = wrong_count + ?,
       last_wrong_time = IF(?, last_wrong_time, NOW()), updated_at = NOW() WHERE id = ?`,
      [mastery, isCorrect ? 0 : 1, isCorrect, row.id],
    )
  }
}
