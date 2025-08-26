-- 为tasks表添加发布状态支持的迁移脚本
-- 执行时间：2024年

-- 修改tasks表的status字段，添加发布相关状态
ALTER TABLE tasks 
MODIFY COLUMN status ENUM('not_started', 'in_progress', 'completed', 'expired', 'draft', 'published', 'unpublished') NOT NULL DEFAULT 'draft';

-- 将现有的任务状态迁移到新的状态体系
-- 将所有现有的'not_started'状态的任务设置为'draft'（草稿）
UPDATE tasks SET status = 'draft' WHERE status = 'not_started';

-- 创建任务分配表（如果不存在）
CREATE TABLE IF NOT EXISTS task_assignments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  task_id INT NOT NULL,
  user_id INT NOT NULL,
  assigned_by INT NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id),
  UNIQUE KEY unique_task_user (task_id, user_id)
);

-- 为现有任务创建分配记录（基于原有的user_id字段）
INSERT IGNORE INTO task_assignments (task_id, user_id, assigned_by)
SELECT id, user_id, user_id FROM tasks WHERE user_id IS NOT NULL;

-- 添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_publish_time ON tasks(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_task_assignments_user ON task_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_task ON task_assignments(task_id);

-- 添加注释
ALTER TABLE tasks COMMENT = '任务表 - 支持发布状态管理';
ALTER TABLE task_assignments COMMENT = '任务分配表 - 支持多用户任务分配';