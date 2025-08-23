# 在线考试系统开发文档

## 项目结构

```
.
├── backend/           # 后端代码
│   ├── src/          # 源代码
│   ├── tests/        # 测试代码
│   └── package.json  # 后端依赖
├── frontend/         # 前端代码
│   ├── src/          # 源代码
│   ├── public/       # 静态资源
│   └── package.json  # 前端依赖
└── README.md         # 项目说明
```

## 开发环境配置

### 前端开发

1. 安装依赖：
```bash
pnpm install
```

2. 启动开发服务器：
```bash
pnpm run dev
```

3. 构建生产版本：
```bash
pnpm run build
```

### 后端开发

1. 安装依赖：
```bash
cd backend
pnpm install
```

2. 启动开发服务器：
```bash
pnpm run dev
```

3. 运行测试：
```bash
pnpm run test
```

## 环境变量

### 前端环境变量

在 `.env` 文件中配置：

```env
VITE_API_URL=http://localhost:3000/api
```

### 后端环境变量

在 `.env` 文件中配置：

```env
PORT=3000
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=online_exam
JWT_SECRET=your_jwt_secret
```

## API 文档

### 用户管理

- `GET /api/users` - 获取用户列表
- `GET /api/users/:id` - 获取用户详情
- `POST /api/users` - 创建用户
- `PUT /api/users/:id` - 更新用户信息
- `DELETE /api/users/:id` - 删除用户

### 题目管理

- `GET /api/questions` - 获取题目列表
- `GET /api/questions/:id` - 获取题目详情
- `POST /api/questions` - 创建题目
- `PUT /api/questions/:id` - 更新题目
- `DELETE /api/questions/:id` - 删除题目

### 试卷管理

- `GET /api/papers` - 获取试卷列表
- `GET /api/papers/:id` - 获取试卷详情
- `POST /api/papers` - 创建试卷
- `PUT /api/papers/:id` - 更新试卷
- `DELETE /api/papers/:id` - 删除试卷

### 考试管理

- `GET /api/exams` - 获取考试列表
- `GET /api/exams/:id` - 获取考试详情
- `POST /api/exams` - 创建考试
- `PUT /api/exams/:id` - 更新考试
- `DELETE /api/exams/:id` - 删除考试

## 数据库设计

### users 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | varchar(36) | 主键 |
| username | varchar(50) | 用户名 |
| password | varchar(100) | 密码 |
| email | varchar(100) | 邮箱 |
| role | varchar(20) | 角色 |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |

### questions 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | varchar(36) | 主键 |
| title | text | 题目标题 |
| content | text | 题目内容 |
| type | varchar(20) | 题目类型 |
| options | json | 选项 |
| answer | text | 答案 |
| score | int | 分值 |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |

### papers 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | varchar(36) | 主键 |
| title | varchar(100) | 试卷标题 |
| description | text | 试卷说明 |
| total_score | int | 总分 |
| duration | int | 考试时长 |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |

### paper_questions 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | varchar(36) | 主键 |
| paper_id | varchar(36) | 试卷ID |
| question_id | varchar(36) | 题目ID |
| score | int | 分值 |
| order | int | 顺序 |

### exams 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | varchar(36) | 主键 |
| paper_id | varchar(36) | 试卷ID |
| title | varchar(100) | 考试标题 |
| description | text | 考试说明 |
| start_time | timestamp | 开始时间 |
| end_time | timestamp | 结束时间 |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |

### exam_results 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | varchar(36) | 主键 |
| exam_id | varchar(36) | 考试ID |
| user_id | varchar(36) | 用户ID |
| score | int | 得分 |
| answers | json | 答案 |
| submit_time | timestamp | 提交时间 |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |

## 开发规范

### Git 提交规范

提交信息格式：

```
<type>(<scope>): <subject>

<body>

<footer>
```

类型（type）：
- feat: 新功能
- fix: 修复bug
- docs: 文档更新
- style: 代码格式（不影响代码运行的变动）
- refactor: 重构（既不是新增功能，也不是修改bug的代码变动）
- test: 增加测试
- chore: 构建过程或辅助工具的变动

### 代码风格

- 使用 ESLint 和 Prettier 进行代码格式化
- 遵循 TypeScript 最佳实践
- 组件使用函数式组件和 Hooks
- 使用 CSS Modules 或 Tailwind CSS 进行样式管理

### 测试规范

- 单元测试覆盖核心业务逻辑
- 集成测试覆盖主要功能流程
- 端到端测试覆盖关键用户场景

## 部署指南

### 前端部署

1. 构建生产版本：
```bash
pnpm run build
```

2. 将 `dist` 目录部署到 Web 服务器

### 后端部署

1. 安装生产依赖：
```bash
pnpm install --production
```

2. 构建生产版本：
```bash
pnpm run build
```

3. 启动服务：
```bash
pnpm run start
```

## 常见问题

### 1. 开发环境启动失败

- 检查环境变量配置
- 确保数据库服务正常运行
- 检查端口是否被占用

### 2. 数据库连接失败

- 验证数据库配置信息
- 检查数据库服务状态
- 确认网络连接正常

### 3. API 请求失败

- 检查 API 地址配置
- 确认请求参数格式正确
- 查看服务器日志