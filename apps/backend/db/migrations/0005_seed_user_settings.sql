INSERT INTO user_settings (user_id, settings)
VALUES (1, JSON_OBJECT('theme','light','lang','zh-CN'))
ON DUPLICATE KEY UPDATE settings = VALUES(settings);
