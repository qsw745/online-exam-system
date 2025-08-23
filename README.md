# 在线刷题系统

## 📋 数据模型

### 核心表结构

```sql
-- 用户表
users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE,
  password VARCHAR(255),
  role ENUM('student', 'teacher', 'admin'),
  nickname VARCHAR(255),
  experience_points INT DEFAULT 0,
  level INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)

-- 题目表
questions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  type ENUM('single', 'multiple', 'judge', 'fill', 'essay'),
  stem TEXT,
  options JSON,
  answer JSON,
  difficulty INT CHECK (difficulty BETWEEN 1 AND 5),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)

-- 试卷表
papers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255),
  total_score INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)

-- 任务表
tasks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255),
  type ENUM('practice', 'exam'),
  duration_minutes INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)

-- 提交记录表
submissions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT,
  task_id INT,
  answers JSON,
  auto_score INT,
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (task_id) REFERENCES tasks(id)
)
```

## 🔧 本地开发

### 环境要求
- Node.js 18+
- pnpm 8+
- MySQL 8+

### 安装步骤

1. **克隆项目**
```bash
git clone <repository-url>
cd online-exam-system
```

2. **安装依赖**
```bash
# 安装前端依赖
pnpm install

# 安装后端依赖
cd backend
pnpm install
cd ..
```

3. **配置环境变量**
创建前端 `.env` 文件：
```env
VITE_API_URL=http://localhost:3000/api
```

创建后端 `.env` 文件：
```env
PORT=3000
JWT_SECRET=your_jwt_secret
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=online_exam
```

4. **初始化数据库**
- 创建 MySQL 数据库
- 运行 SQL 脚本创建表结构

5. **启动开发服务器**
```bash
# 启动前端和后端服务
pnpm run dev:local
```

## 🚀 项目结构

```
├── src/                  # 前端源代码
│   ├── components/       # React 组件
│   ├── contexts/         # React 上下文
│   ├── hooks/            # 自定义 Hooks
│   ├── lib/             # 工具函数和 API 客户端
│   ├── pages/           # 页面组件
│   └── styles/          # 样式文件
├── backend/             # 后端源代码
│   ├── src/             # TypeScript 源文件
│   │   ├── controllers/ # 控制器
│   │   ├── models/      # 数据模型
│   │   ├── routes/      # 路由定义
│   │   ├── services/    # 业务逻辑
│   │   └── utils/       # 工具函数
│   └── tests/           # 测试文件
└── public/              # 静态资源
```

## 📝 API 文档

### 认证接口
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/logout` - 用户登出

### 用户接口
- `GET /api/users/me` - 获取当前用户信息
- `PUT /api/users/me` - 更新用户信息

### 题目接口
- `GET /api/questions` - 获取题目列表
- `GET /api/questions/:id` - 获取题目详情
- `POST /api/questions` - 创建新题目
- `PUT /api/questions/:id` - 更新题目
- `DELETE /api/questions/:id` - 删除题目

### 试卷接口
- `GET /api/papers` - 获取试卷列表
- `GET /api/papers/:id` - 获取试卷详情
- `POST /api/papers` - 创建新试卷
- `PUT /api/papers/:id` - 更新试卷
- `DELETE /api/papers/:id` - 删除试卷

### 任务接口
- `GET /api/tasks` - 获取任务列表
- `GET /api/tasks/:id` - 获取任务详情
- `POST /api/tasks` - 创建新任务
- `PUT /api/tasks/:id` - 更新任务
- `DELETE /api/tasks/:id` - 删除任务

### 提交接口
- `POST /api/submissions` - 提交答案
- `GET /api/submissions/:id` - 获取提交详情
- `GET /api/submissions/task/:taskId` - 获取任务的所有提交
