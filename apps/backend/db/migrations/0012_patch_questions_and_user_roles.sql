-- 0012_patch_questions_and_user_roles.sql
-- 目的：
--  A) 补 questions.knowledge_points
--  B) 补 roles 基础数据
--  C) 创建/修复 user_roles（确保 user_id/role_id/assigned_at 存在且类型正确，索引/外键齐全）
--  D) 将 users.role(admin/teacher/student) 回填到 user_roles
-- 说明：脚本可幂等重复执行；统一 INFORMATION_SCHEMA 比较的 collation，避免混用错误

SET NAMES utf8mb4;

-- 统一当前库名在 utf8mb3_general_ci 下比较，避免 Illegal mix of collations
SET @db  := DATABASE();
SET @dbc := CONVERT(@db USING utf8mb3) COLLATE utf8mb3_general_ci;

-- ===================== A) questions.knowledge_points =====================
SET @col_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='questions'
    AND COLUMN_NAME='knowledge_points'
);
SET @sql := IF(@col_exists>0,
  'SELECT 1',
  'ALTER TABLE `questions` ADD COLUMN `knowledge_points` JSON NULL AFTER `explanation`;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ===================== B) 角色基础数据（按 code 唯一） =====================
-- 若 roles.code 没有唯一约束，可按需放开以下 UNIQUE（幂等写法，下次执行会忽略）
-- ALTER TABLE `roles` ADD UNIQUE KEY `uniq_roles_code`(`code`);

INSERT INTO roles (name, code, description, is_system, is_disabled, sort_order, created_at, updated_at)
VALUES
  ('管理员', 'admin',   '系统管理员', 1, 0, 1, NOW(), NOW()),
  ('教师',   'teacher', '任课教师',   1, 0, 2, NOW(), NOW()),
  ('学生',   'student', '普通学生',   1, 0, 3, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  name       = VALUES(name),
  description= VALUES(description),
  is_system  = VALUES(is_system),
  is_disabled= VALUES(is_disabled),
  sort_order = VALUES(sort_order),
  updated_at = VALUES(updated_at);

-- ===================== C) user_roles 表修复/创建 =====================

-- C.0 读取 users.id / roles.id 的实际类型，便于对齐
SET @users_id_type := (
  SELECT COLUMN_TYPE
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='users' AND COLUMN_NAME='id'
);
SET @roles_id_type := (
  SELECT COLUMN_TYPE
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='roles' AND COLUMN_NAME='id'
);

-- C.1 若 user_roles 不存在则创建最小表结构（不带外键，后续再补齐/对齐类型）
SET @ur_exists := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.TABLES
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='user_roles'
);
SET @sql := IF(@ur_exists>0, 'SELECT 1',
  'CREATE TABLE `user_roles` (
     `user_id` INT NULL,
     `role_id` INT NULL,
     `assigned_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- C.2 确保三列都存在（兼容旧表缺列情形）
-- user_id
SET @col := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='user_roles' AND COLUMN_NAME='user_id'
);
SET @sql := IF(@col>0,'SELECT 1','ALTER TABLE `user_roles` ADD COLUMN `user_id` INT NULL;');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- role_id
SET @col := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='user_roles' AND COLUMN_NAME='role_id'
);
SET @sql := IF(@col>0,'SELECT 1','ALTER TABLE `user_roles` ADD COLUMN `role_id` INT NULL;');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- assigned_at
SET @col := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='user_roles' AND COLUMN_NAME='assigned_at'
);
SET @sql := IF(@col>0,'SELECT 1',
  'ALTER TABLE `user_roles` ADD COLUMN `assigned_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- C.3 对齐 user_id / role_id 列类型到被引用表的 COLUMN_TYPE（若未知则兜底用 INT）
SET @sql := CONCAT(
  'ALTER TABLE `user_roles` MODIFY COLUMN `user_id` ',
  IFNULL(@users_id_type,'INT'),
  ' NOT NULL;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := CONCAT(
  'ALTER TABLE `user_roles` MODIFY COLUMN `role_id` ',
  IFNULL(@roles_id_type,'INT'),
  ' NOT NULL;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- C.4 主键/索引：仅在不存在时创建
-- 主键 (user_id, role_id)
SET @pk_exists := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='user_roles' AND CONSTRAINT_TYPE='PRIMARY KEY'
);
SET @sql := IF(@pk_exists>0,'SELECT 1',
  'ALTER TABLE `user_roles` ADD PRIMARY KEY (`user_id`,`role_id`);'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 索引 idx_ur_role(role_id)
SET @idx := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='user_roles' AND INDEX_NAME='idx_ur_role'
);
SET @sql := IF(@idx>0,'SELECT 1','CREATE INDEX `idx_ur_role` ON `user_roles`(`role_id`);');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- C.5 外键：如存在先删，再按需加回（避免类型变更时冲突）
-- 删 fk_ur_user
SET @fk := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
  WHERE CONVERT(CONSTRAINT_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND CONSTRAINT_NAME='fk_ur_user'
);
SET @sql := IF(@fk>0,'ALTER TABLE `user_roles` DROP FOREIGN KEY `fk_ur_user`;','SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 删 fk_ur_role
SET @fk := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
  WHERE CONVERT(CONSTRAINT_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND CONSTRAINT_NAME='fk_ur_role'
);
SET @sql := IF(@fk>0,'ALTER TABLE `user_roles` DROP FOREIGN KEY `fk_ur_role`;','SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 加回外键（仅当被引用表存在）
SET @users_tbl_exists := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.TABLES
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='users'
);
SET @roles_tbl_exists := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.TABLES
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='roles'
);

SET @sql := IF(@users_tbl_exists=0,'SELECT 1',
  'ALTER TABLE `user_roles`
     ADD CONSTRAINT `fk_ur_user`
     FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
     ON DELETE CASCADE;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := IF(@roles_tbl_exists=0,'SELECT 1',
  'ALTER TABLE `user_roles`
     ADD CONSTRAINT `fk_ur_role`
     FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`)
     ON DELETE CASCADE;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ===================== D) 回填 user_roles（忽略已存在） =====================
-- 注意：为避免字符序不一致，强制把 users.role 以 utf8mb4_general_ci 与 roles.code 对齐比较
INSERT IGNORE INTO user_roles (user_id, role_id, assigned_at)
SELECT u.id AS user_id,
       r.id AS role_id,
       NOW()
FROM users u
JOIN roles r
  ON CONVERT(r.code USING utf8mb4) COLLATE utf8mb4_general_ci
   = CONVERT(u.role USING utf8mb4) COLLATE utf8mb4_general_ci
WHERE u.role IN ('admin','teacher','student');
