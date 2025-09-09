-- 错题本相关表结构

-- 错题本表
CREATE TABLE IF NOT EXISTS wrong_question_books (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL DEFAULT '我的错题本',
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
);

-- 错题记录表
CREATE TABLE IF NOT EXISTS wrong_questions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  question_id INT NOT NULL,
  book_id INT NOT NULL,
  exam_id INT,
  task_id INT,
  user_answer TEXT,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  difficulty_level ENUM('easy', 'medium', 'hard') DEFAULT 'medium',
  subject VARCHAR(100),
  chapter VARCHAR(100),
  knowledge_points JSON,
  wrong_count INT NOT NULL DEFAULT 1,
  last_wrong_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_mastered BOOLEAN NOT NULL DEFAULT FALSE,
  mastered_time TIMESTAMP NULL,
  notes TEXT,
  tags JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES wrong_question_books(id) ON DELETE CASCADE,
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE SET NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
  UNIQUE KEY unique_user_question_book (user_id, question_id, book_id),
  INDEX idx_user_id (user_id),
  INDEX idx_question_id (question_id),
  INDEX idx_book_id (book_id),
  INDEX idx_subject (subject),
  INDEX idx_difficulty (difficulty_level),
  INDEX idx_mastered (is_mastered),
  INDEX idx_wrong_time (last_wrong_time)
);

-- 错题练习记录表
CREATE TABLE IF NOT EXISTS wrong_question_practice_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  wrong_question_id INT NOT NULL,
  practice_type ENUM('single', 'batch', 'review') NOT NULL DEFAULT 'single',
  user_answer TEXT,
  is_correct BOOLEAN NOT NULL,
  time_spent INT DEFAULT 0, -- 答题用时（秒）
  practice_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (wrong_question_id) REFERENCES wrong_questions(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_wrong_question_id (wrong_question_id),
  INDEX idx_practice_time (practice_time),
  INDEX idx_practice_type (practice_type)
);

-- 错题本分享表
CREATE TABLE IF NOT EXISTS wrong_question_book_shares (
  id INT PRIMARY KEY AUTO_INCREMENT,
  book_id INT NOT NULL,
  shared_by INT NOT NULL,
  shared_to INT,
  share_type ENUM('public', 'private', 'class') NOT NULL DEFAULT 'private',
  share_code VARCHAR(32) UNIQUE,
  access_count INT DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_id) REFERENCES wrong_question_books(id) ON DELETE CASCADE,
  FOREIGN KEY (shared_by) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (shared_to) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_book_id (book_id),
  INDEX idx_shared_by (shared_by),
  INDEX idx_share_code (share_code),
  INDEX idx_share_type (share_type)
);

-- 错题统计表
CREATE TABLE IF NOT EXISTS wrong_question_statistics (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  date DATE NOT NULL,
  total_wrong_count INT DEFAULT 0,
  new_wrong_count INT DEFAULT 0,
  mastered_count INT DEFAULT 0,
  practice_count INT DEFAULT 0,
  correct_rate DECIMAL(5,2) DEFAULT 0.00,
  study_time INT DEFAULT 0, -- 学习时间（分钟）
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_date (user_id, date),
  INDEX idx_user_id (user_id),
  INDEX idx_date (date)
);

-- 为每个用户创建默认错题本的触发器
DELIMITER //
CREATE TRIGGER create_default_wrong_book 
AFTER INSERT ON users 
FOR EACH ROW 
BEGIN
  INSERT INTO wrong_question_books (user_id, name, description, is_default) 
  VALUES (NEW.id, '我的错题本', '系统自动创建的默认错题本', TRUE);
END//
DELIMITER ;

-- 错题自动收集触发器（当答题错误时自动添加到错题本）
DELIMITER //
CREATE TRIGGER auto_collect_wrong_questions 
AFTER INSERT ON answer_records 
FOR EACH ROW 
BEGIN
  DECLARE default_book_id INT;
  DECLARE question_subject VARCHAR(100);
  DECLARE question_chapter VARCHAR(100);
  DECLARE user_id_val INT;
  DECLARE exam_id_val INT;
  DECLARE task_id_val INT;
  
  -- 只处理错误答案
  IF NEW.is_correct = FALSE THEN
    -- 获取用户ID和考试信息
    SELECT er.user_id, er.exam_id INTO user_id_val, exam_id_val
    FROM exam_results er 
    WHERE er.id = NEW.exam_result_id;
    
    -- 获取任务ID（如果存在）
    SELECT t.id INTO task_id_val
    FROM tasks t 
    WHERE t.exam_id = exam_id_val 
    LIMIT 1;
    
    -- 获取用户的默认错题本ID
    SELECT id INTO default_book_id 
    FROM wrong_question_books 
    WHERE user_id = user_id_val AND is_default = TRUE 
    LIMIT 1;
    
    -- 获取题目的学科和章节信息
    SELECT subject, chapter INTO question_subject, question_chapter
    FROM questions 
    WHERE id = NEW.question_id;
    
    -- 插入或更新错题记录
    INSERT INTO wrong_questions (
      user_id, question_id, book_id, exam_id, task_id,
      user_answer, correct_answer, subject, chapter,
      wrong_count, last_wrong_time
    ) 
    SELECT 
      user_id_val, NEW.question_id, default_book_id, exam_id_val, task_id_val,
      NEW.user_answer, q.correct_answer, question_subject, question_chapter,
      1, NOW()
    FROM questions q 
    WHERE q.id = NEW.question_id
    ON DUPLICATE KEY UPDATE 
      wrong_count = wrong_count + 1,
      last_wrong_time = NOW(),
      user_answer = NEW.user_answer,
      is_mastered = FALSE,
      mastered_time = NULL;
  END IF;
END//
DELIMITER ;