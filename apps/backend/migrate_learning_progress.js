import mysql from 'mysql2/promise';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 数据库配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'exam_system'
};

// SQL 语句
const sqlStatements = [
  // 学习进度记录表
  `CREATE TABLE learning_progress (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    subject_id INT,
    topic VARCHAR(255),
    progress_type ENUM('exam', 'practice', 'study', 'review') NOT NULL,
    total_questions INT DEFAULT 0,
    correct_answers INT DEFAULT 0,
    wrong_answers INT DEFAULT 0,
    accuracy_rate DECIMAL(5,2) DEFAULT 0.00,
    time_spent INT DEFAULT 0,
    study_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_date (user_id, study_date),
    INDEX idx_subject (subject_id),
    INDEX idx_progress_type (progress_type)
  )`,

  // 学习目标表
  `CREATE TABLE learning_goals (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    subject_id INT,
    goal_type ENUM('daily', 'weekly', 'monthly', 'custom') NOT NULL,
    target_questions INT DEFAULT 0,
    target_time INT DEFAULT 0,
    target_accuracy DECIMAL(5,2) DEFAULT 0.00,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status ENUM('active', 'completed', 'paused', 'cancelled') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_goal (user_id, goal_type),
    INDEX idx_date_range (start_date, end_date),
    INDEX idx_status (status)
  )`,

  // 学习轨迹表
  `CREATE TABLE learning_tracks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    activity_type ENUM('login', 'exam_start', 'exam_submit', 'practice_start', 'practice_submit', 'question_view', 'material_view') NOT NULL,
    resource_type ENUM('exam', 'question', 'material', 'subject') NOT NULL,
    resource_id INT NOT NULL,
    duration INT DEFAULT 0,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_activity (user_id, activity_type),
    INDEX idx_resource (resource_type, resource_id),
    INDEX idx_created_at (created_at)
  )`,

  // 学习统计汇总表
  `CREATE TABLE learning_statistics (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    subject_id INT,
    stat_date DATE NOT NULL,
    total_study_time INT DEFAULT 0,
    total_questions INT DEFAULT 0,
    correct_answers INT DEFAULT 0,
    wrong_answers INT DEFAULT 0,
    accuracy_rate DECIMAL(5,2) DEFAULT 0.00,
    exam_count INT DEFAULT 0,
    practice_count INT DEFAULT 0,
    login_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_subject_date (user_id, subject_id, stat_date),
    INDEX idx_user_date (user_id, stat_date),
    INDEX idx_subject_date (subject_id, stat_date)
  )`,

  // 学习成就表
  `CREATE TABLE learning_achievements (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    achievement_type ENUM('streak', 'accuracy', 'volume', 'speed', 'improvement') NOT NULL,
    achievement_name VARCHAR(255) NOT NULL,
    description TEXT,
    criteria JSON,
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_achievement (user_id, achievement_type),
    INDEX idx_earned_at (earned_at)
  )`
];

async function migrate() {
  let connection;
  
  try {
    console.log('连接到 MySQL 数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功');
    
    console.log('开始执行学习进度跟踪模块数据库迁移...');
    
    for (let i = 0; i < sqlStatements.length; i++) {
      const sql = sqlStatements[i];
      console.log(`执行第 ${i + 1} 条 SQL 语句...`);
      await connection.execute(sql);
      console.log(`第 ${i + 1} 条 SQL 语句执行成功`);
    }
    
    console.log('学习进度跟踪模块数据库迁移完成！');
    
  } catch (error) {
    console.error('数据库迁移失败:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

migrate();