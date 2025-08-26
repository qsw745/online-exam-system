-- Add user profile fields
ALTER TABLE users 
ADD COLUMN nickname VARCHAR(255) NULL COMMENT 'User nickname',
ADD COLUMN school VARCHAR(255) NULL COMMENT 'School name',
ADD COLUMN class_name VARCHAR(255) NULL COMMENT 'Class name',
ADD COLUMN experience_points INT DEFAULT 0 COMMENT 'Experience points',
ADD COLUMN level INT DEFAULT 1 COMMENT 'User level',
ADD COLUMN avatar_url VARCHAR(500) NULL COMMENT 'Avatar URL';