-- Create questions table
CREATE TABLE IF NOT EXISTS questions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  content TEXT NOT NULL,
  type ENUM('single_choice', 'multiple_choice', 'true_false', 'short_answer') NOT NULL,
  difficulty ENUM('easy', 'medium', 'hard') NOT NULL,
  options JSON NOT NULL,
  correct_answer JSON NOT NULL,
  explanation TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);