-- 用户表
-- CREATE TABLE IF NOT EXISTS users (
--   id INT PRIMARY KEY AUTO_INCREMENT,
--   username VARCHAR(255) NOT NULL,
--   email VARCHAR(255) NOT NULL UNIQUE,
--   password VARCHAR(255) NOT NULL,
--   role ENUM('admin', 'teacher', 'student') NOT NULL DEFAULT 'student',
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
-- );

-- 考试表
CREATE TABLE IF NOT EXISTS exams (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  duration INT NOT NULL, -- 考试时长（分钟）
  total_score INT NOT NULL DEFAULT 100,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 试题表
CREATE TABLE IF NOT EXISTS questions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  exam_id INT NOT NULL,
  question_type ENUM('single_choice', 'multiple_choice', 'true_false', 'short_answer') NOT NULL,
  content TEXT NOT NULL,
  options JSON, -- 选项，用于选择题
  correct_answer TEXT NOT NULL,
  score INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (exam_id) REFERENCES exams(id)
);

-- 考试结果表
CREATE TABLE IF NOT EXISTS exam_results (
  id INT PRIMARY KEY AUTO_INCREMENT,
  exam_id INT NOT NULL,
  user_id INT NOT NULL,
  score INT NOT NULL DEFAULT 0,
  start_time TIMESTAMP NOT NULL,
  submit_time TIMESTAMP,
  answers JSON,
  time_spent INT DEFAULT 0,
  status ENUM('in_progress', 'submitted', 'graded') NOT NULL DEFAULT 'in_progress',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (exam_id) REFERENCES exams(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 答题记录表
CREATE TABLE IF NOT EXISTS answer_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  exam_result_id INT NOT NULL,
  question_id INT NOT NULL,
  user_answer TEXT,
  score INT,
  is_correct BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (exam_result_id) REFERENCES exam_results(id),
  FOREIGN KEY (question_id) REFERENCES questions(id)
);

-- 任务表
CREATE TABLE IF NOT EXISTS tasks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  type ENUM('exam', 'practice') NOT NULL,
  status ENUM('not_started', 'in_progress', 'completed', 'expired', 'draft', 'published', 'unpublished') NOT NULL DEFAULT 'draft',
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  user_id INT NOT NULL,
  exam_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (exam_id) REFERENCES exams(id)
);

-- 通知表
CREATE TABLE IF NOT EXISTS notifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  type ENUM('info', 'warning', 'success', 'error') NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 用户
CREATE TABLE users (
  id            INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(190) NOT NULL UNIQUE,
  username      VARCHAR(100) NOT NULL,
  password      VARCHAR(255) NOT NULL,
  status        ENUM('active','disabled') NOT NULL DEFAULT 'active',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 组织/部门（支持树形）
CREATE TABLE organizations (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  code          VARCHAR(64)  NOT NULL UNIQUE,
  parent_id     INT UNSIGNED NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_org_parent FOREIGN KEY (parent_id) REFERENCES organizations(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 用户-组织 多对多（可带主组织、职位、入职时间等）
CREATE TABLE user_organizations (
  user_id       INT          NOT NULL,
  org_id        INT UNSIGNED NOT NULL,
  is_primary    TINYINT(1)   NOT NULL DEFAULT 0,
  title         VARCHAR(100) NULL,        -- 职务/岗位（可选）
  assigned_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, org_id),
  KEY idx_uo_org (org_id),
  CONSTRAINT fk_uo_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_uo_org  FOREIGN KEY (org_id)  REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 角色
CREATE TABLE roles (
  id           INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(100)  NOT NULL,
  code         VARCHAR(64)   NOT NULL UNIQUE, -- admin/teacher/student…
  is_system    TINYINT(1)    NOT NULL DEFAULT 0,
  is_disabled  TINYINT(1)    NOT NULL DEFAULT 0,
  sort_order   INT           NOT NULL DEFAULT 1,
  created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 菜单（也可做树形）
CREATE TABLE menus (
  id           INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(100)  NOT NULL UNIQUE,  -- 唯一标识
  title        VARCHAR(120)  NOT NULL,
  path         VARCHAR(190)  NOT NULL,
  icon         VARCHAR(64)   NULL,
  parent_id    INT UNSIGNED  NULL,
  is_hidden    TINYINT(1)    NOT NULL DEFAULT 0,
  sort_order   INT           NOT NULL DEFAULT 1,
  created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_menu_parent  FOREIGN KEY (parent_id) REFERENCES menus(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 角色-菜单 多对多（控制“能看到哪些菜单”）
CREATE TABLE role_menus (
  role_id      INT UNSIGNED  NOT NULL,
  menu_id      INT UNSIGNED  NOT NULL,
  PRIMARY KEY (role_id, menu_id),
  KEY idx_rm_menu (menu_id),
  CONSTRAINT fk_rm_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_rm_menu FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
