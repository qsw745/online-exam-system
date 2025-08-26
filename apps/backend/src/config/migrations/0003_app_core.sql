-- 0003_app_core.sql  — 补核心表（全部与 users.id 的 INT 有符号对齐）
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 日志表（user_id → INT）
CREATE TABLE IF NOT EXISTS logs (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  log_type VARCHAR(50) NOT NULL,
  level VARCHAR(20) NOT NULL,
  user_id INT NULL,
  username VARCHAR(100) NULL,
  action VARCHAR(50) NULL,
  resource_type VARCHAR(50) NULL,
  message VARCHAR(255) NULL,
  details JSON NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_logs_user (user_id),
  INDEX idx_logs_type (log_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 用户设置（user_id → INT）
CREATE TABLE IF NOT EXISTS user_settings (
  user_id INT PRIMARY KEY,
  settings JSON NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 任务（id → INT）
CREATE TABLE IF NOT EXISTS tasks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(200) NOT NULL,
  description TEXT NULL,
  status ENUM('draft','pending','ongoing','completed','cancelled') NOT NULL DEFAULT 'draft',
  start_time DATETIME NULL,
  end_time DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 任务分配（task_id → INT；user_id → INT）
CREATE TABLE IF NOT EXISTS task_assignments (
  task_id INT NOT NULL,
  user_id INT NOT NULL,
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(task_id, user_id),
  INDEX idx_ta_user (user_id),
  CONSTRAINT fk_ta_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  -- 你也可以加上：
  -- , CONSTRAINT fk_ta_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 菜单（id → INT；parent_id → INT）
CREATE TABLE IF NOT EXISTS menus (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  title VARCHAR(100) NOT NULL,
  path VARCHAR(200) NULL,
  component VARCHAR(200) NULL,
  icon VARCHAR(50) NULL,
  parent_id INT NULL,
  sort_order INT NOT NULL DEFAULT 1,
  level INT NULL,
  menu_type ENUM('menu','button','link') DEFAULT 'menu',
  permission_code VARCHAR(100) NULL,
  redirect VARCHAR(200) NULL,
  meta JSON NULL,
  is_disabled TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_menus_parent (parent_id),
  CONSTRAINT fk_menus_parent2 FOREIGN KEY (parent_id) REFERENCES menus(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 试卷 & 结果（全部 INT）
CREATE TABLE IF NOT EXISTS papers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(200) NOT NULL,
  description TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS exam_results (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  paper_id INT NOT NULL,
  score DECIMAL(5,2) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_er_user (user_id),
  INDEX idx_er_paper (paper_id),
  CONSTRAINT fk_er_paper FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
