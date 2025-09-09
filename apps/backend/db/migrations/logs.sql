-- 统一日志表（简化方案）
CREATE TABLE IF NOT EXISTS logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  log_type ENUM('user', 'system', 'audit', 'login', 'exam') NOT NULL DEFAULT 'user',
  level ENUM('debug', 'info', 'warn', 'error', 'fatal') NOT NULL DEFAULT 'info',
  user_id INT NULL,
  username VARCHAR(255) NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NULL,
  resource_id INT NULL,
  message TEXT NULL,
  details JSON NULL,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  status ENUM('success', 'failed') NULL,
  failure_reason VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- 外键约束
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  
  -- 索引优化
  INDEX idx_log_type (log_type),
  INDEX idx_level (level),
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_resource (resource_type, resource_id),
  INDEX idx_created_at (created_at),
  INDEX idx_composite (log_type, level, created_at)
);

-- 插入一些示例数据
INSERT INTO logs (log_type, level, user_id, username, action, resource_type, message, ip_address, created_at) VALUES
('user', 'info', 1, 'admin', 'login', 'auth', 'User login successful', '127.0.0.1', NOW()),
('system', 'info', NULL, NULL, 'startup', 'server', 'Server startup', NULL, NOW()),
('user', 'info', 1, 'admin', 'view_page', 'logs', 'View logs page', '127.0.0.1', NOW());