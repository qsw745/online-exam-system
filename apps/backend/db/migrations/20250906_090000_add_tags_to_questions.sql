-- 新增 tags 字段（JSON 数组），用于保存标签，如 ["frontend","JavaScript","Node.js"]
ALTER TABLE `questions`
  ADD COLUMN `tags` JSON NULL AFTER `knowledge_points`;

-- 兜底：把 NULL 填成空数组
UPDATE `questions` SET `tags` = JSON_ARRAY() WHERE `tags` IS NULL;

-- 先看下现在的列
SHOW COLUMNS FROM favorites;

-- 如果没有 name 列，先加一个可空的，占位
ALTER TABLE favorites ADD COLUMN `name` VARCHAR(100) NULL AFTER `user_id`;

-- 如果历史上有 title 列，迁移到 name（没有就跳过这步）
UPDATE favorites SET `name` = COALESCE(`title`, `name`, '未命名收藏夹') WHERE `name` IS NULL;

-- 改为 NOT NULL，保护数据质量
ALTER TABLE favorites MODIFY `name` VARCHAR(100) NOT NULL;

-- 建议加唯一约束：同一用户下收藏夹名不重复（按需）
ALTER TABLE favorites ADD UNIQUE KEY `uniq_user_name` (`user_id`, `name`);
