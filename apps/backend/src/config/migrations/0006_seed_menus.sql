/*
 Navicat Premium Data Transfer

 Source Server         : 本地项目库
 Source Server Type    : MySQL
 Source Server Version : 80032 (8.0.32)
 Source Host           : localhost:3306
 Source Schema         : exam_system

 Target Server Type    : MySQL
 Target Server Version : 80032 (8.0.32)
 File Encoding         : 65001

 Date: 26/08/2025 14:53:11
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for menus
-- ----------------------------
DROP TABLE IF EXISTS `menus`;
CREATE TABLE `menus`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '菜单名称',
  `title` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '菜单标题（显示名称）',
  `path` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '路由路径',
  `component` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '组件路径',
  `icon` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '菜单图标',
  `parent_id` int NULL DEFAULT NULL COMMENT '父菜单ID',
  `sort_order` int NULL DEFAULT 0 COMMENT '排序',
  `level` int NULL DEFAULT 1 COMMENT '菜单层级',
  `is_hidden` tinyint(1) NULL DEFAULT 0 COMMENT '是否隐藏',
  `is_disabled` tinyint(1) NULL DEFAULT 0 COMMENT '是否禁用',
  `is_system` tinyint(1) NULL DEFAULT 0 COMMENT '是否系统菜单（不可删除）',
  `menu_type` enum('menu','button','link') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT 'menu' COMMENT '菜单类型',
  `permission_code` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '权限编码',
  `redirect` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '重定向路径',
  `meta` json NULL COMMENT '元数据（如keepAlive、requireAuth等）',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '菜单描述',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_name`(`name` ASC) USING BTREE,
  UNIQUE INDEX `uk_path`(`path` ASC) USING BTREE,
  INDEX `idx_parent_id`(`parent_id` ASC) USING BTREE,
  INDEX `idx_sort_order`(`sort_order` ASC) USING BTREE,
  INDEX `idx_level`(`level` ASC) USING BTREE,
  INDEX `idx_permission_code`(`permission_code` ASC) USING BTREE,
  INDEX `idx_menu_type`(`menu_type` ASC) USING BTREE,
  CONSTRAINT `menus_ibfk_1` FOREIGN KEY (`parent_id`) REFERENCES `menus` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 62 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '菜单表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of menus
-- ----------------------------
INSERT INTO `menus` VALUES (1, 'dashboard', '仪表盘', '/dashboard', 'DashboardPage', 'dashboard', NULL, 0, 1, 0, 0, 1, 'menu', 'dashboard:view', NULL, '{\"requireAuth\": true}', NULL, '2025-08-22 21:37:10', '2025-08-25 09:03:20');
INSERT INTO `menus` VALUES (2, 'exam', '考试管理', '/exam', NULL, 'file-text', NULL, 1, 1, 0, 0, 1, 'menu', 'exam:view', NULL, '{\"requireAuth\": true}', NULL, '2025-08-22 21:37:10', '2025-08-25 09:04:19');
INSERT INTO `menus` VALUES (3, 'question', '题库管理', '/questions', 'QuestionsPage', 'question-circle', NULL, 8, 1, 0, 0, 1, 'menu', 'question:view', NULL, '{\"requireAuth\": true}', NULL, '2025-08-22 21:37:10', '2025-08-25 09:04:19');
INSERT INTO `menus` VALUES (4, 'user', '用户管理', '/admin/users', 'UserManagementPage', 'user', NULL, 12, 1, 0, 0, 1, 'menu', 'user:view', NULL, '{\"requireAuth\": true}', NULL, '2025-08-22 21:37:10', '2025-08-25 09:04:19');
INSERT INTO `menus` VALUES (5, 'system', '系统管理', '/system', NULL, 'setting', NULL, 15, 1, 0, 0, 1, 'menu', 'system:view', NULL, '{\"requireAuth\": true}', NULL, '2025-08-22 21:37:10', '2025-08-25 09:04:19');
INSERT INTO `menus` VALUES (6, 'learning', '学习中心', '/learning', NULL, 'book', NULL, 18, 1, 0, 0, 1, 'menu', 'learning:view', NULL, '{\"requireAuth\": true}', NULL, '2025-08-22 21:37:10', '2025-08-25 09:04:19');
INSERT INTO `menus` VALUES (7, 'analytics', '数据分析', '/analytics', 'AnalyticsPage', 'bar-chart', NULL, 20, 1, 0, 0, 1, 'menu', 'analytics:view', NULL, '{\"requireAuth\": true}', NULL, '2025-08-22 21:37:10', '2025-08-25 09:04:19');
INSERT INTO `menus` VALUES (8, 'exam-list', '考试列表', '/exam/list', 'ExamPage', 'unordered-list', 2, 2, 2, 0, 0, 1, 'menu', 'exam:list', NULL, '{\"requireAuth\": true}', NULL, '2025-08-22 21:37:10', '2025-08-25 09:04:19');
INSERT INTO `menus` VALUES (9, 'exam-results', '考试结果', '/results', 'ResultsPage', 'trophy', 2, 5, 2, 0, 0, 1, 'menu', 'exam:results', NULL, '{\"requireAuth\": true}', NULL, '2025-08-22 21:37:10', '2025-08-25 09:04:19');
INSERT INTO `menus` VALUES (10, 'exam-practice', '题目练习', '/practice', 'QuestionPracticePage', 'edit', 2, 9, 2, 0, 0, 1, 'menu', 'exam:practice', NULL, '{\"requireAuth\": true}', NULL, '2025-08-22 21:37:10', '2025-08-25 09:04:19');
INSERT INTO `menus` VALUES (12, 'system-settings', '系统设置', '/settings', 'SettingsPage', 'setting', 5, 3, 2, 0, 0, 1, 'menu', 'system:settings', NULL, '{\"requireAuth\": true}', NULL, '2025-08-22 21:37:10', '2025-08-25 09:04:19');
INSERT INTO `menus` VALUES (13, 'system-logs', '系统日志', '/logs', 'LogsPage', 'file-text', 5, 6, 2, 0, 0, 1, 'menu', 'system:logs', NULL, '{\"requireAuth\": true}', NULL, '2025-08-22 21:37:10', '2025-08-25 09:04:19');
INSERT INTO `menus` VALUES (14, 'system-notifications', '通知管理', '/notifications', 'NotificationsPage', 'bell', 5, 10, 2, 0, 0, 1, 'menu', 'system:notifications', NULL, '{\"requireAuth\": true}', NULL, '2025-08-22 21:37:10', '2025-08-25 09:04:19');
INSERT INTO `menus` VALUES (15, 'system-tasks', '任务管理', '/tasks', 'TasksPage', 'calendar', 5, 13, 2, 0, 0, 1, 'menu', 'system:tasks', NULL, '{\"requireAuth\": true}', NULL, '2025-08-22 21:37:10', '2025-08-25 09:04:19');
INSERT INTO `menus` VALUES (16, 'system-menus', '菜单管理', '/admin/menus', 'MenuManagePage', 'menu', 5, 16, 2, 0, 0, 1, 'menu', 'system:menus', NULL, '{\"requireAuth\": true}', NULL, '2025-08-22 21:37:10', '2025-08-25 09:04:19');
INSERT INTO `menus` VALUES (17, 'learning-progress', '学习进度', '/learning/progress', 'LearningProgressPage', 'line-chart', 6, 4, 2, 0, 0, 1, 'menu', 'learning:progress', NULL, '{\"requireAuth\": true}', NULL, '2025-08-22 21:37:10', '2025-08-25 09:04:19');
INSERT INTO `menus` VALUES (18, 'learning-favorites', '我的收藏', '/favorites', 'FavoritesPage', 'heart', 6, 7, 2, 0, 0, 1, 'menu', 'learning:favorites', NULL, '{\"requireAuth\": true}', NULL, '2025-08-22 21:37:10', '2025-08-25 09:04:19');
INSERT INTO `menus` VALUES (19, 'learning-wrong', '错题本', '/wrong-questions', 'WrongQuestionsPage', 'exclamation-circle', 6, 11, 2, 0, 0, 1, 'menu', 'learning:wrong', NULL, '{\"requireAuth\": true}', NULL, '2025-08-22 21:37:10', '2025-08-25 09:04:19');
INSERT INTO `menus` VALUES (20, 'learning-discussion', '讨论区', '/discussion', 'DiscussionPage', 'message', 6, 14, 2, 0, 0, 1, 'menu', 'learning:discussion', NULL, '{\"requireAuth\": true}', NULL, '2025-08-22 21:37:10', '2025-08-25 09:04:19');
INSERT INTO `menus` VALUES (21, 'learning-leaderboard', '排行榜', '/leaderboard', 'LeaderboardPage', 'trophy', 6, 17, 2, 0, 0, 1, 'menu', 'learning:leaderboard', NULL, '{\"requireAuth\": true}', NULL, '2025-08-22 21:37:10', '2025-08-25 09:04:19');
INSERT INTO `menus` VALUES (22, 'profile', '个人资料', '/profile', 'ProfilePage', 'user', NULL, 21, 1, 0, 0, 1, 'menu', 'profile:view', NULL, '{\"requireAuth\": true}', NULL, '2025-08-23 00:15:55', '2025-08-25 09:04:19');
INSERT INTO `menus` VALUES (31, 'system-roles', '角色管理', '/admin/roles', 'RoleManagementPage', 'user', 5, 20, 2, 0, 0, 1, 'menu', 'system:roles', NULL, '{\"requireAuth\": true}', NULL, '2025-08-23 15:45:44', '2025-08-25 15:02:25');
INSERT INTO `menus` VALUES (61, 'question-maintain', '题库维护', '/admin/questions', 'QuestionsPage', 'question-circle', 3, 1, 2, 0, 0, 0, 'menu', 'question:view', NULL, '{\"requireAuth\": true}', NULL, '2025-08-25 17:18:01', '2025-08-25 20:45:19');

SET FOREIGN_KEY_CHECKS = 1;
