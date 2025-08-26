-- 0012_patch_questions_and_user_roles.sql
-- 补：questions.knowledge_points 字段；补：roles 基础数据 + user_roles 表并回填

SET NAMES utf8mb4;

-- ========== A) questions.knowledge_points ==========
-- 仅在缺少时添加（使用 INFORMATION_SCHEMA 判断，避免重复执行报错）
SET @col_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'questions'
    AND COLUMN_NAME = 'knowledge_points'
);
SET @sql := IF(@col_exists>0,
  'SELECT 1',
  'ALTER TABLE `questions` ADD COLUMN `knowledge_points` JSON NULL AFTER `explanation`;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ========== B) 角色基础数据（按 code 唯一） ==========
-- 如果没有，就补三条常用角色
INSERT INTO roles (name, code, description, is_system, is_disabled, sort_order, created_at, updated_at)
VALUES
  ('管理员', 'admin',   '系统管理员', 1, 0, 1, NOW(), NOW()),
  ('教师',   'teacher', '任课教师',   1, 0, 2, NOW(), NOW()),
  ('学生',   'student', '普通学生',   1, 0, 3, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  is_system = VALUES(is_system),
  is_disabled = VALUES(is_disabled),
  sort_order = VALUES(sort_order),
  updated_at = VALUES(updated_at);

-- ========== C) user_roles 表 ==========
-- 代码查询用的是 user_roles（而不是我们早先创建的 role_users）
CREATE TABLE IF NOT EXISTS `user_roles` (
  `user_id` INT NOT NULL,
  `role_id` INT UNSIGNED NOT NULL,
  `assigned_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `role_id`),
  KEY `idx_ur_role` (`role_id`),
  CONSTRAINT `fk_ur_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ur_role` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== D) 将 users.role（枚举 admin/teacher/student）回填到 user_roles ==========
-- 先把枚举值映射到 roles.id，再插入缺少的 user_roles 关系
INSERT IGNORE INTO user_roles (user_id, role_id, assigned_at)
SELECT u.id                           AS user_id,
       r.id                           AS role_id,
       NOW()
FROM users u
JOIN roles r
   ON r.code COLLATE utf8mb4_unicode_ci = u.role                -- users.role: admin/teacher/student
WHERE u.role IN ('admin','teacher','student');
