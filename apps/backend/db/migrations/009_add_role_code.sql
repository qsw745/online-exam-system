-- 为roles表添加code字段
ALTER TABLE roles ADD COLUMN code VARCHAR(50) AFTER name;