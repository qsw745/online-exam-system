-- add_task_publish_status.sql
-- 使 tasks 支持发布状态；为 task_assignments 增加 assigned_by；按需创建索引
-- 兼容 MySQL 5.7/8.0：使用 INFORMATION_SCHEMA + 动态 SQL

-- 1) 修改 tasks.status 的枚举集合（保留默认 draft）
ALTER TABLE tasks
  MODIFY COLUMN status ENUM('not_started', 'in_progress', 'completed', 'expired', 'draft', 'published', 'unpublished')
  NOT NULL DEFAULT 'draft';

-- 可选：把旧的 not_started 归并到 draft（若不存在该值也没关系）
UPDATE tasks SET status = 'draft' WHERE status = 'not_started';

-- 2) 为 task_assignments 增加 assigned_by（如果不存在），并加外键（如果不存在）
SET @col_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME='task_assignments'
    AND COLUMN_NAME='assigned_by'
);
SET @sql := IF(@col_exists>0,
  'SELECT 1',
  'ALTER TABLE `task_assignments` ADD COLUMN `assigned_by` INT NULL AFTER `user_id`;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 外键：assigned_by -> users(id)（如果不存在）
SET @fk_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND CONSTRAINT_NAME='fk_ta_assigned_by'
);
SET @sql := IF(@fk_exists>0,
  'SELECT 1',
  'ALTER TABLE `task_assignments` ADD CONSTRAINT `fk_ta_assigned_by` FOREIGN KEY (`assigned_by`) REFERENCES `users`(`id`) ON DELETE SET NULL;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 3) 条件创建索引（MySQL 不支持 CREATE INDEX IF NOT EXISTS，用信息模式判断）
-- tasks(status)
SET @idx := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME='tasks'
    AND INDEX_NAME='idx_tasks_status'
);
SET @sql := IF(@idx>0, 'SELECT 1', 'CREATE INDEX `idx_tasks_status` ON `tasks`(`status`);');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- tasks(start_time, end_time)
SET @idx := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME='tasks'
    AND INDEX_NAME='idx_tasks_publish_time'
);
SET @sql := IF(@idx>0, 'SELECT 1', 'CREATE INDEX `idx_tasks_publish_time` ON `tasks`(`start_time`, `end_time`);');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- task_assignments(user_id)
SET @idx := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME='task_assignments'
    AND INDEX_NAME='idx_task_assignments_user'
);
SET @sql := IF(@idx>0, 'SELECT 1', 'CREATE INDEX `idx_task_assignments_user` ON `task_assignments`(`user_id`);');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- task_assignments(task_id)（主键包含 task_id 已有索引，以下仅兜底）
SET @idx := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME='task_assignments'
    AND INDEX_NAME='idx_task_assignments_task'
);
SET @sql := IF(@idx>0, 'SELECT 1', 'CREATE INDEX `idx_task_assignments_task` ON `task_assignments`(`task_id`);');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
