-- 0013_rbac_org_seed.sql (robust)
-- 目的：
--  1) 确保组织与关联表存在（organizations / user_organizations / user_org_roles / org_default_roles）
--  2) 动态对齐外键列类型（尤其 role_id 对 roles.id）
--  3) 插入默认机构/角色/菜单映射，并把现有用户挂默认机构与角色
--  4) 所有步骤可幂等重复执行；统一 INFORMATION_SCHEMA 的 collation，避免混用错误

SET NAMES utf8mb4;

-- 统一当前库名在 utf8mb3_general_ci 下比较，避免 Illegal mix of collations
SET @db  := DATABASE();
SET @dbc := CONVERT(@db USING utf8mb3) COLLATE utf8mb3_general_ci;

-- =========================
-- 0) 读取被引用列真实类型
-- =========================
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
-- 兜底
SET @users_id_type := IFNULL(@users_id_type, 'INT');
SET @roles_id_type := IFNULL(@roles_id_type, 'INT');

-- =========================
-- 1) 确保 organizations 存在
-- =========================
SET @tbl_exists := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.TABLES
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='organizations'
);
SET @sql := IF(@tbl_exists>0, 'SELECT 1',
  'CREATE TABLE `organizations` (
     `id` INT PRIMARY KEY AUTO_INCREMENT,
     `name` VARCHAR(100) NOT NULL,
     `code` VARCHAR(64)  NOT NULL,
     `parent_id` INT NULL,
     `is_active` TINYINT(1) NOT NULL DEFAULT 1,
     `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
     `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     UNIQUE KEY `uniq_org_code` (`code`),
     INDEX `idx_org_parent` (`parent_id`),
     CONSTRAINT `fk_org_parent` FOREIGN KEY (`parent_id`) REFERENCES `organizations`(`id`) ON DELETE SET NULL
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- =========================
-- 2) 确保 user_organizations 存在并列完整
-- =========================
SET @tbl_exists := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.TABLES
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='user_organizations'
);
SET @sql := IF(@tbl_exists>0, 'SELECT 1',
  'CREATE TABLE `user_organizations` (
     `user_id` INT NOT NULL,
     `org_id`  INT NOT NULL,
     `is_primary` TINYINT(1) NOT NULL DEFAULT 0,
     `title` VARCHAR(100) NULL,
     `assigned_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
     PRIMARY KEY (`user_id`,`org_id`),
     INDEX `idx_uo_org` (`org_id`)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 补缺列（兼容旧表）
-- user_id
SET @col := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='user_organizations' AND COLUMN_NAME='user_id'
);
SET @sql := IF(@col>0,'SELECT 1','ALTER TABLE `user_organizations` ADD COLUMN `user_id` INT NOT NULL;');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- org_id
SET @col := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='user_organizations' AND COLUMN_NAME='org_id'
);
SET @sql := IF(@col>0,'SELECT 1','ALTER TABLE `user_organizations` ADD COLUMN `org_id` INT NOT NULL;');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- is_primary
SET @col := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='user_organizations' AND COLUMN_NAME='is_primary'
);
SET @sql := IF(@col>0,'SELECT 1','ALTER TABLE `user_organizations` ADD COLUMN `is_primary` TINYINT(1) NOT NULL DEFAULT 0;');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- title
SET @col := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='user_organizations' AND COLUMN_NAME='title'
);
SET @sql := IF(@col>0,'SELECT 1','ALTER TABLE `user_organizations` ADD COLUMN `title` VARCHAR(100) NULL;');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- assigned_at
SET @col := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='user_organizations' AND COLUMN_NAME='assigned_at'
);
SET @sql := IF(@col>0,'SELECT 1','ALTER TABLE `user_organizations` ADD COLUMN `assigned_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 索引/主键存在性判断（PK 已在创建时给出，这里只在缺失时补）
SET @pk := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='user_organizations' AND CONSTRAINT_TYPE='PRIMARY KEY'
);
SET @sql := IF(@pk>0,'SELECT 1','ALTER TABLE `user_organizations` ADD PRIMARY KEY (`user_id`,`org_id`);');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 外键（存在则跳过）
SET @fk := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
  WHERE CONVERT(CONSTRAINT_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND CONSTRAINT_NAME='fk_uo_user'
);
SET @sql := IF(@fk>0,'SELECT 1',
  'ALTER TABLE `user_organizations`
     ADD CONSTRAINT `fk_uo_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @fk := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
  WHERE CONVERT(CONSTRAINT_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND CONSTRAINT_NAME='fk_uo_org'
);
SET @sql := IF(@fk>0,'SELECT 1',
  'ALTER TABLE `user_organizations`
     ADD CONSTRAINT `fk_uo_org`  FOREIGN KEY (`org_id`)  REFERENCES `organizations`(`id`) ON DELETE CASCADE;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- =========================
-- 3) 确保 user_org_roles 存在并列完整（role_id 动态对齐）
-- =========================
SET @tbl_exists := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.TABLES
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='user_org_roles'
);
SET @sql := IF(@tbl_exists>0, 'SELECT 1',
  'CREATE TABLE `user_org_roles` (
     `user_id` INT NULL,
     `org_id`  INT NULL,
     `role_id` INT NULL,
     `assigned_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 补列
-- user_id
SET @col := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='user_org_roles' AND COLUMN_NAME='user_id'
);
SET @sql := IF(@col>0,'SELECT 1','ALTER TABLE `user_org_roles` ADD COLUMN `user_id` INT NULL;');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- org_id
SET @col := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='user_org_roles' AND COLUMN_NAME='org_id'
);
SET @sql := IF(@col>0,'SELECT 1','ALTER TABLE `user_org_roles` ADD COLUMN `org_id` INT NULL;');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- role_id
SET @col := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='user_org_roles' AND COLUMN_NAME='role_id'
);
SET @sql := IF(@col>0,'SELECT 1','ALTER TABLE `user_org_roles` ADD COLUMN `role_id` INT NULL;');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- assigned_at
SET @col := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='user_org_roles' AND COLUMN_NAME='assigned_at'
);
SET @sql := IF(@col>0,'SELECT 1','ALTER TABLE `user_org_roles` ADD COLUMN `assigned_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 类型对齐与非空约束
SET @sql := CONCAT('ALTER TABLE `user_org_roles` MODIFY `user_id` INT NOT NULL;');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := CONCAT('ALTER TABLE `user_org_roles` MODIFY `org_id` INT NOT NULL;');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := CONCAT('ALTER TABLE `user_org_roles` MODIFY `role_id` ', @roles_id_type, ' NOT NULL;');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 主键 + 索引
SET @pk := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='user_org_roles' AND CONSTRAINT_TYPE='PRIMARY KEY'
);
SET @sql := IF(@pk>0,'SELECT 1','ALTER TABLE `user_org_roles` ADD PRIMARY KEY (`user_id`,`org_id`,`role_id`);');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 外键（存在则跳过）
SET @fk := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
  WHERE CONVERT(CONSTRAINT_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND CONSTRAINT_NAME='fk_uor_user'
);
SET @sql := IF(@fk>0,'SELECT 1',
  'ALTER TABLE `user_org_roles`
     ADD CONSTRAINT `fk_uor_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @fk := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
  WHERE CONVERT(CONSTRAINT_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND CONSTRAINT_NAME='fk_uor_org'
);
SET @sql := IF(@fk>0,'SELECT 1',
  'ALTER TABLE `user_org_roles`
     ADD CONSTRAINT `fk_uor_org`  FOREIGN KEY (`org_id`)  REFERENCES `organizations`(`id`) ON DELETE CASCADE;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @fk := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
  WHERE CONVERT(CONSTRAINT_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND CONSTRAINT_NAME='fk_uor_role'
);
SET @sql := IF(@fk>0,'SELECT 1',
  'ALTER TABLE `user_org_roles`
     ADD CONSTRAINT `fk_uor_role` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- =========================
-- 4) 确保 org_default_roles 存在
-- =========================
SET @tbl_exists := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.TABLES
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='org_default_roles'
);
SET @sql := IF(@tbl_exists>0, 'SELECT 1',
  'CREATE TABLE `org_default_roles` (
     `org_id`  INT NOT NULL,
     `role_id` INT NOT NULL,
     PRIMARY KEY (`org_id`,`role_id`)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 外键
SET @fk := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
  WHERE CONVERT(CONSTRAINT_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND CONSTRAINT_NAME='fk_odr_org'
);
SET @sql := IF(@fk>0,'SELECT 1',
  'ALTER TABLE `org_default_roles`
     ADD CONSTRAINT `fk_odr_org`  FOREIGN KEY (`org_id`)  REFERENCES `organizations`(`id`) ON DELETE CASCADE;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @fk := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
  WHERE CONVERT(CONSTRAINT_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND CONSTRAINT_NAME='fk_odr_role'
);
SET @sql := IF(@fk>0,'SELECT 1',
  'ALTER TABLE `org_default_roles`
     ADD CONSTRAINT `fk_odr_role` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- =========================
-- 5) 默认机构/角色/菜单 & 映射（你的原始逻辑）
-- =========================
-- 默认组织
INSERT INTO organizations (name, code, parent_id, is_active, created_at, updated_at)
VALUES ('默认机构', 'default', NULL, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  name=VALUES(name), is_active=VALUES(is_active), updated_at=VALUES(updated_at);

-- 拿到默认机构ID
SET @org_default_id := (
  SELECT id FROM organizations WHERE code='default' LIMIT 1
);

-- 角色（admin/teacher/student）
INSERT INTO roles (name, code, is_system, is_disabled, sort_order, created_at, updated_at) VALUES
('管理员','admin',1,0,1,NOW(),NOW()),
('教师','teacher',1,0,2,NOW(),NOW()),
('学生','student',1,0,3,NOW(),NOW())
ON DUPLICATE KEY UPDATE
  name=VALUES(name),
  is_system=VALUES(is_system),
  is_disabled=VALUES(is_disabled),
  sort_order=VALUES(sort_order),
  updated_at=VALUES(updated_at);

-- 角色ID
SET @role_admin_id   := (SELECT id FROM roles WHERE code='admin'   LIMIT 1);
SET @role_teacher_id := (SELECT id FROM roles WHERE code='teacher' LIMIT 1);
SET @role_student_id := (SELECT id FROM roles WHERE code='student' LIMIT 1);

-- 上层“系统管理”菜单
INSERT INTO menus (name, title, path, icon, parent_id, is_hidden, sort_order, created_at, updated_at)
VALUES ('system', '系统管理', '/admin', 'Settings', NULL, 0, 900, NOW(), NOW())
ON DUPLICATE KEY UPDATE title=VALUES(title), path=VALUES(path), icon=VALUES(icon), updated_at=VALUES(updated_at);
SET @menu_system_id := (SELECT id FROM menus WHERE name='system' LIMIT 1);

-- 业务菜单
INSERT INTO menus (name, title, path, icon, parent_id, is_hidden, sort_order, created_at, updated_at) VALUES
('dashboard',         '仪表盘',     '/dashboard',           'Gauge',     NULL,           0, 1, NOW(), NOW()),
('question_practice', '题目练习',   '/questions/practice',  'BookOpen',  NULL,           0, 2, NOW(), NOW()),
('org_management',    '机构管理',   '/orgs',                'Building',  @menu_system_id,0, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  title=VALUES(title), path=VALUES(path), icon=VALUES(icon), parent_id=VALUES(parent_id), updated_at=VALUES(updated_at);

SET @menu_dashboard_id := (SELECT id FROM menus WHERE name='dashboard' LIMIT 1);
SET @menu_practice_id  := (SELECT id FROM menus WHERE name='question_practice' LIMIT 1);
SET @menu_org_mgmt_id  := (SELECT id FROM menus WHERE name='org_management' LIMIT 1);

-- 角色-菜单映射
INSERT IGNORE INTO role_menus (role_id, menu_id) VALUES
(@role_admin_id,   @menu_dashboard_id),
(@role_admin_id,   @menu_practice_id),
(@role_admin_id,   @menu_org_mgmt_id),
(@role_teacher_id, @menu_dashboard_id),
(@role_teacher_id, @menu_practice_id),
(@role_student_id, @menu_dashboard_id),
(@role_student_id, @menu_practice_id);

-- 默认机构 → 默认角色
INSERT IGNORE INTO org_default_roles (org_id, role_id) VALUES
(@org_default_id, @role_student_id);

-- =========================
-- 6) 把现有用户加入默认机构并赋默认/管理员/教师角色（幂等）
-- =========================
-- 没有任何组织关系的用户，挂到默认机构（主组织）
INSERT IGNORE INTO user_organizations (user_id, org_id, is_primary, title, assigned_at)
SELECT u.id, @org_default_id, 1, NULL, NOW()
FROM users u
LEFT JOIN user_organizations uo ON uo.user_id = u.id
WHERE uo.user_id IS NULL;

-- 默认角色 student
INSERT IGNORE INTO user_org_roles (user_id, org_id, role_id, assigned_at)
SELECT uo.user_id, uo.org_id, @role_student_id, NOW()
FROM user_organizations uo
LEFT JOIN user_org_roles uor
  ON uor.user_id=uo.user_id AND uor.org_id=uo.org_id AND uor.role_id=@role_student_id
WHERE uor.user_id IS NULL;

-- 简单识别管理员（email/username 含 'admin'）
INSERT IGNORE INTO user_org_roles (user_id, org_id, role_id, assigned_at)
SELECT uo.user_id, uo.org_id, @role_admin_id, NOW()
FROM user_organizations uo
JOIN users u ON u.id = uo.user_id
LEFT JOIN user_org_roles uor
  ON uor.user_id=uo.user_id AND uor.org_id=uo.org_id AND uor.role_id=@role_admin_id
WHERE uor.user_id IS NULL
  AND (u.email LIKE '%admin%' OR u.username LIKE '%admin%');

-- 可选：识别教师（email/username 含 'teacher'）
INSERT IGNORE INTO user_org_roles (user_id, org_id, role_id, assigned_at)
SELECT uo.user_id, uo.org_id, @role_teacher_id, NOW()
FROM user_organizations uo
JOIN users u ON u.id = uo.user_id
LEFT JOIN user_org_roles uor
  ON uor.user_id=uo.user_id AND uor.org_id=uo.org_id AND uor.role_id=@role_teacher_id
WHERE uor.user_id IS NULL
  AND (u.email LIKE '%teacher%' OR u.username LIKE '%teacher%');
