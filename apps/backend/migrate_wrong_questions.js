import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'exam_system',
  multipleStatements: true
};

async function runMigration() {
  let connection;
  
  try {
    // 创建数据库连接
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected to MySQL database');
    
    // SQL语句内容
    const sqlContent = `
-- 错题本表
CREATE TABLE IF NOT EXISTS wrong_question_books (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_is_default (is_default)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='错题本表';

-- 错题记录表
CREATE TABLE IF NOT EXISTS wrong_questions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  book_id INT NOT NULL,
  question_id INT NOT NULL,
  exam_result_id INT,
  wrong_count INT DEFAULT 1,
  last_wrong_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  mastery_level ENUM('not_mastered', 'partially_mastered', 'mastered') DEFAULT 'not_mastered',
  tags VARCHAR(500),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (book_id) REFERENCES wrong_question_books(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  FOREIGN KEY (exam_result_id) REFERENCES exam_results(id) ON DELETE SET NULL,
  UNIQUE KEY unique_book_question (book_id, question_id),
  INDEX idx_book_id (book_id),
  INDEX idx_question_id (question_id),
  INDEX idx_mastery_level (mastery_level),
  INDEX idx_last_wrong_time (last_wrong_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='错题记录表';

-- 错题练习记录表
CREATE TABLE IF NOT EXISTS wrong_question_practice_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  wrong_question_id INT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  time_spent INT NOT NULL COMMENT '答题用时(秒)',
  practice_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (wrong_question_id) REFERENCES wrong_questions(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_wrong_question_id (wrong_question_id),
  INDEX idx_practice_time (practice_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='错题练习记录表';

-- 错题本分享表
CREATE TABLE IF NOT EXISTS wrong_question_book_shares (
  id INT PRIMARY KEY AUTO_INCREMENT,
  book_id INT NOT NULL,
  shared_by INT NOT NULL,
  shared_to INT,
  share_code VARCHAR(50) UNIQUE NOT NULL,
  is_public BOOLEAN DEFAULT FALSE,
  access_count INT DEFAULT 0,
  expires_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_id) REFERENCES wrong_question_books(id) ON DELETE CASCADE,
  FOREIGN KEY (shared_by) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (shared_to) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_book_id (book_id),
  INDEX idx_shared_by (shared_by),
  INDEX idx_share_code (share_code),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='错题本分享表';

-- 错题统计表
CREATE TABLE IF NOT EXISTS wrong_question_statistics (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  date DATE NOT NULL,
  total_wrong_questions INT DEFAULT 0,
  mastered_questions INT DEFAULT 0,
  practice_count INT DEFAULT 0,
  correct_rate DECIMAL(5,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_date (user_id, date),
  INDEX idx_user_id (user_id),
  INDEX idx_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='错题统计表';
    `;
    
    // 分割SQL语句（按分号分割，但忽略触发器中的分号）
    const statements = [];
    let currentStatement = '';
    let inTrigger = false;
    
    const lines = sqlContent.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.toUpperCase().includes('CREATE TRIGGER')) {
        inTrigger = true;
      }
      
      currentStatement += line + '\n';
      
      if (trimmedLine.endsWith(';')) {
        if (inTrigger && trimmedLine.toUpperCase().includes('END')) {
          inTrigger = false;
          statements.push(currentStatement.trim());
          currentStatement = '';
        } else if (!inTrigger) {
          statements.push(currentStatement.trim());
          currentStatement = '';
        }
      }
    }
    
    // 如果还有剩余的语句
    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }
    
    // 执行每个SQL语句
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement && statement.length > 0) {
        try {
          console.log(`Executing statement ${i + 1}/${statements.length}...`);
          await connection.execute(statement);
          console.log(`Statement ${i + 1} executed successfully`);
        } catch (error) {
          console.error(`Error executing statement ${i + 1}:`, error.message);
          console.error('Statement:', statement.substring(0, 200) + '...');
          // 继续执行其他语句
        }
      }
    }
    
    console.log('Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

// 运行迁移
runMigration();