-- 0008_alter_exam_results_add_time_status.sql
-- 为 exam_results 补齐列：start_time、submit_time、status、updated_at
-- 兼容 MySQL 5.7/8.0，使用 INFORMATION_SCHEMA 判断，幂等执行

-- start_time
SET @col_exists := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'exam_results' AND COLUMN_NAME = 'start_time'
);
SET @sql := IF(@col_exists>0, 'SELECT 1',
  'ALTER TABLE `exam_results` ADD COLUMN `start_time` DATETIME NULL AFTER `score`;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- submit_time
SET @col_exists := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'exam_results' AND COLUMN_NAME = 'submit_time'
);
SET @sql := IF(@col_exists>0, 'SELECT 1',
  'ALTER TABLE `exam_results` ADD COLUMN `submit_time` DATETIME NULL AFTER `start_time`;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- status （给一个常见状态集合，若你的代码有固定集合可按需修改）
SET @col_exists := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'exam_results' AND COLUMN_NAME = 'status'
);
SET @sql := IF(@col_exists>0, 'SELECT 1',
  "ALTER TABLE `exam_results` ADD COLUMN `status` ENUM('in_progress','submitted','graded','expired') NOT NULL DEFAULT 'submitted' AFTER `submit_time`;"
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- updated_at（很多旧表没有，但查询里用了）
SET @col_exists := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'exam_results' AND COLUMN_NAME = 'updated_at'
);
SET @sql := IF(@col_exists>0, 'SELECT 1',
  'ALTER TABLE `exam_results` ADD COLUMN `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER `created_at`;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 可选：给历史记录补一个“已提交”的状态，避免为空
UPDATE `exam_results` SET `status` = 'submitted' WHERE `status` IS NULL;
