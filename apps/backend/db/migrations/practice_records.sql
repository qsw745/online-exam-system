-- 练习记录表
CREATE TABLE IF NOT EXISTS practice_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  question_id INT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  user_answer TEXT,
  practice_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  INDEX idx_user_question (user_id, question_id),
  INDEX idx_user_correct (user_id, is_correct),
  INDEX idx_practice_time (practice_time)
);

-- 错题本表
CREATE TABLE IF NOT EXISTS wrong_questions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  question_id INT NOT NULL,
  first_wrong_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_practice_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  wrong_count INT DEFAULT 1,
  correct_count INT DEFAULT 0,
  is_mastered BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_question (user_id, question_id),
  INDEX idx_user_mastered (user_id, is_mastered),
  INDEX idx_last_practice (last_practice_time)
);