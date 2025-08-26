-- add_task_publish_status.sql (robust)
-- 使 tasks 支持发布状态；为 task_assignments 增加/修复 assigned_by；条件建索引
-- 兼容 MySQL 5.7/8.0；统一 INFORMATION_SCHEMA 比较的 collation

SET NAMES utf8mb4;

-- 统一库名到 utf8mb3_general_ci，避免 collation 混用
SET @db  := DATABASE();
SET @dbc := CONVERT(@db USING utf8mb3) COLLATE utf8mb3_general_ci;

-- 读取 users.id 的真实类型，用于对齐 assigned_by
SET @users_id_type := (
  SELECT COLUMN_TYPE
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='users' AND COLUMN_NAME='id'
);
SET @users_id_type := IFNULL(@users_id_type, 'INT');

-- ========= 1) 修改 tasks.status 的枚举集合（若表存在） =========
SET @tasks_exists := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.TABLES
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='tasks'
);
SET @sql := IF(@tasks_exists=0,'SELECT 1',
  'ALTER TABLE `tasks`
     MODIFY COLUMN `status` ENUM(
       ''not_started'',''in_progress'',''completed'',''expired'',''draft'',''published'',''unpublished''
     ) NOT NULL DEFAULT ''draft'';'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := IF(@tasks_exists=0,'SELECT 1',
  'UPDATE `tasks` SET `status`=''draft'' WHERE `status`=''not_started'';'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ========= 2) 为 task_assignments 增加/修复 assigned_by，并加外键 =========
-- 2.0 若表不存在就先建最小结构（按你项目常见列名；如已存在则跳过）
SET @ta_exists := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.TABLES
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='task_assignments'
);
SET @sql := IF(@ta_exists>0,'SELECT 1',
  'CREATE TABLE `task_assignments` (
     `id` INT PRIMARY KEY AUTO_INCREMENT,
     `task_id` INT NOT NULL,
     `user_id` INT NOT NULL,
     `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 2.1 列不存在则添加为 NULL；若已存在，下一步也会强制改为 NULL 并对齐类型
SET @col_exists := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='task_assignments' AND COLUMN_NAME='assigned_by'
);
SET @sql := IF(@col_exists>0,'SELECT 1',
  'ALTER TABLE `task_assignments` ADD COLUMN `assigned_by` INT NULL AFTER `user_id`;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 2.2 若存在同名外键，先删掉（避免类型/可空变更时冲突）
SET @fk_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
  WHERE CONVERT(CONSTRAINT_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND CONSTRAINT_NAME='fk_ta_assigned_by'
);
SET @sql := IF(@fk_exists>0,
  'ALTER TABLE `task_assignments` DROP FOREIGN KEY `fk_ta_assigned_by`;',
  'SELECT 1'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 2.3 强制把 assigned_by 改为与 users.id 一致的类型，且 **NULL**（以便 ON DELETE SET NULL 合法）
SET @sql := CONCAT(
  'ALTER TABLE `task_assignments` MODIFY COLUMN `assigned_by` ',
  @users_id_type, ' NULL;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 2.4 重新添加外键（仅当 users 表存在）
SET @users_exists := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.TABLES
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='users'
);
SET @sql := IF(@users_exists=0,'SELECT 1',
  'ALTER TABLE `task_assignments`
     ADD CONSTRAINT `fk_ta_assigned_by`
     FOREIGN KEY (`assigned_by`) REFERENCES `users`(`id`)
     ON DELETE SET NULL;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ========= 3) 条件创建索引 =========
-- tasks(status)
SET @idx := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='tasks' AND INDEX_NAME='idx_tasks_status'
);
SET @sql := IF(@tasks_exists=0 OR @idx>0,'SELECT 1','CREATE INDEX `idx_tasks_status` ON `tasks`(`status`);');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- tasks(start_time, end_time)
SET @idx := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='tasks' AND INDEX_NAME='idx_tasks_publish_time'
);
SET @sql := IF(@tasks_exists=0 OR @idx>0,'SELECT 1','CREATE INDEX `idx_tasks_publish_time` ON `tasks`(`start_time`,`end_time`);');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- task_assignments(user_id)
SET @idx := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='task_assignments' AND INDEX_NAME='idx_task_assignments_user'
);
SET @sql := IF(@ta_exists=0 OR @idx>0,'SELECT 1','CREATE INDEX `idx_task_assignments_user` ON `task_assignments`(`user_id`);');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- task_assignments(task_id)（如主键未覆盖则兜底建索引）
SET @idx := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='task_assignments' AND INDEX_NAME='idx_task_assignments_task'
);
SET @sql := IF(@ta_exists=0 OR @idx>0,'SELECT 1','CREATE INDEX `idx_task_assignments_task` ON `task_assignments`(`task_id`);');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
