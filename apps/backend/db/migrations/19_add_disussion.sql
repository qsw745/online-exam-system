-- ============== 可选：切换库 ==============
-- USE your_database_name;

-- ============== 讨论分类表 ==============
CREATE TABLE IF NOT EXISTS discussion_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  icon VARCHAR(100) NULL,
  color VARCHAR(20) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 补列（color, sort_order, is_active, description, icon）
SET @tbl := 'discussion_categories';
-- color
SET @sql := (
  SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME=@tbl AND COLUMN_NAME='color'),
            'SELECT 1', 'ALTER TABLE discussion_categories ADD COLUMN color VARCHAR(20) NULL')
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
-- sort_order
SET @sql := (
  SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME=@tbl AND COLUMN_NAME='sort_order'),
            'SELECT 1', 'ALTER TABLE discussion_categories ADD COLUMN sort_order INT NOT NULL DEFAULT 0')
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
-- is_active
SET @sql := (
  SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME=@tbl AND COLUMN_NAME='is_active'),
            'SELECT 1', 'ALTER TABLE discussion_categories ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1')
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
-- description
SET @sql := (
  SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME=@tbl AND COLUMN_NAME='description'),
            'SELECT 1', 'ALTER TABLE discussion_categories ADD COLUMN description VARCHAR(255) NULL')
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
-- icon
SET @sql := (
  SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME=@tbl AND COLUMN_NAME='icon'),
            'SELECT 1', 'ALTER TABLE discussion_categories ADD COLUMN icon VARCHAR(100) NULL')
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ============== 讨论主表 ==============
CREATE TABLE IF NOT EXISTS discussions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  category_id INT NULL,
  title VARCHAR(200) NOT NULL,
  content MEDIUMTEXT NOT NULL,
  tags TEXT NULL,                        -- 前端已 JSON.stringify
  related_type VARCHAR(20) NOT NULL DEFAULT 'general', -- 'question' | 'exam' | 'task' | 'general'
  related_id INT NULL,

  is_pinned TINYINT(1) NOT NULL DEFAULT 0,
  is_locked TINYINT(1) NOT NULL DEFAULT 0,
  is_featured TINYINT(1) NOT NULL DEFAULT 0,

  view_count INT NOT NULL DEFAULT 0,
  reply_count INT NOT NULL DEFAULT 0,
  like_count INT NOT NULL DEFAULT 0,

  last_reply_at DATETIME NULL,
  last_reply_user_id INT NULL,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  KEY idx_discussions_cat (category_id, is_pinned, created_at),
  KEY idx_discussions_sort (is_pinned, last_reply_at, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============== 回复表 ==============
CREATE TABLE IF NOT EXISTS discussion_replies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  discussion_id INT NOT NULL,
  user_id INT NOT NULL,
  parent_id INT NULL,
  content MEDIUMTEXT NOT NULL,

  is_solution TINYINT(1) NOT NULL DEFAULT 0,
  like_count INT NOT NULL DEFAULT 0,
  reply_count INT NOT NULL DEFAULT 0,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  KEY idx_replies_discussion (discussion_id, parent_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============== 点赞表（本次报错的缺表） ==============
CREATE TABLE IF NOT EXISTS discussion_likes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  target_type VARCHAR(20) NOT NULL, -- 'discussion' | 'reply'
  target_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_target (user_id, target_type, target_id),
  KEY idx_target (target_type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============== 收藏表 ==============
CREATE TABLE IF NOT EXISTS discussion_bookmarks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  discussion_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_discussion (user_id, discussion_id),
  KEY idx_discussion (discussion_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============== 关注表 ==============
CREATE TABLE IF NOT EXISTS discussion_follows (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  discussion_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_follow (user_id, discussion_id),
  KEY idx_follow_discussion (discussion_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============== 标签表（控制器里会自增 usage_count） ==============
CREATE TABLE IF NOT EXISTS discussion_tags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  color VARCHAR(20) NULL,
  usage_count INT NOT NULL DEFAULT 0,
  UNIQUE KEY uniq_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============== 用户讨论统计表（控制器/服务会写入） ==============
CREATE TABLE IF NOT EXISTS user_discussion_stats (
  user_id INT NOT NULL PRIMARY KEY,
  discussions_count INT NOT NULL DEFAULT 0,
  replies_count INT NOT NULL DEFAULT 0,
  likes_received INT NOT NULL DEFAULT 0,
  solutions_count INT NOT NULL DEFAULT 0,
  reputation_score INT NOT NULL DEFAULT 0,
  last_active_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============== 初始化一些分类，保证前端下拉可选 ==============
INSERT INTO discussion_categories (name, description, icon, color, sort_order, is_active)
SELECT '学习求助', '学习/作业相关问题求助', 'help-circle', '#1677ff', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM discussion_categories WHERE name='学习求助');

INSERT INTO discussion_categories (name, description, icon, color, sort_order, is_active)
SELECT '经验分享', '备考/学习经验与资料分享', 'share-2', '#52c41a', 2, 1
WHERE NOT EXISTS (SELECT 1 FROM discussion_categories WHERE name='经验分享');

INSERT INTO discussion_categories (name, description, icon, color, sort_order, is_active)
SELECT '题目讨论', '针对具体题目的讨论', 'message-square', '#faad14', 3, 1
WHERE NOT EXISTS (SELECT 1 FROM discussion_categories WHERE name='题目讨论');

-- 结束
