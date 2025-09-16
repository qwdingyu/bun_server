# Bun Server Framework

一个基于 **Bun.js** + **Hono** + **Drizzle ORM** 构建的现代 Web 后端框架，专为快速开发 API 服务而设计。

## ✨ 特性

- 🚀 **高性能**: 基于 Bun.js 运行时和 Hono 框架
- 🛡️ **类型安全**: 使用 Drizzle ORM 提供编译时类型检查
- 🗄️ **多数据库支持**: 支持 SQLite 和 MySQL，无缝切换
- 🔐 **用户管理**: 完整的用户注册、登录、CRUD 功能
- 📊 **健康检查**: 内置系统和服务健康监控
- 🛠️ **开发友好**: 热重载、结构化日志、服务管理脚本
- 📦 **生产就绪**: 完整的构建、部署、监控工具链

## 🏗️ 技术栈

- **Runtime**: [Bun.js](https://bun.sh/) (现代 JavaScript 运行时)
- **Web Framework**: [Hono](https://hono.dev/) (轻量级、高性能 Web 框架)
- **Database ORM**: [Drizzle ORM](https://orm.drizzle.team/) (类型安全的 ORM)
- **Database**: 支持 SQLite (默认) 和 MySQL
- **Authentication**: 密码哈希、基础认证中间件
- **Package Manager**: Bun

## 🚀 快速开始

### 1. 安装依赖

```bash
cd bun_server
bun install
```

### 2. 环境配置

```bash
# 复制环境变量配置文件
cp .env.example .env

# 根据需要修改配置
nano .env
```

### 3. 初始化数据库

```bash
# 初始化数据库表结构
bun run db:init

# 或者重置数据库（开发环境）
bun run db:reset
```

### 4. 启动服务

```bash
# 开发模式（热重载）
bun run dev

# 生产模式
bun run start

# 使用服务管理脚本
bun run service:start
```

### 5. 验证安装

访问以下端点验证服务是否正常运行：

- **根路径**: http://localhost:5050/
- **健康检查**: http://localhost:5050/api/health
- **用户列表**: http://localhost:5050/api/users

## 📁 项目结构

```
bun_server/
├── src/                      # 源代码目录
│   ├── config/               # 配置管理
│   │   ├── database.js       # 数据库初始化配置
│   │   └── ...
│   ├── controllers/          # 控制器层
│   │   ├── UserController.js  # 用户控制器
│   │   └── HealthController.js # 健康检查控制器
│   ├── models/              # 数据模型层
│   │   ├── BaseModel.js      # 基础模型类
│   │   ├── UserModel.js      # 用户模型
│   │   ├── SystemConfigModel.js # 系统配置模型
│   │   ├── schema/          # 数据库表结构定义
│   │   └── index.js         # 模型导出
│   ├── routes/              # 路由定义
│   │   ├── users.js         # 用户路由
│   │   ├── health.js        # 健康检查路由
│   │   └── ...
│   ├── middleware/          # 中间件
│   │   └── auth.js         # 认证中间件
│   ├── utils/               # 工具函数
│   │   ├── config.js        # 配置文件读取
│   │   ├── env.js           # 环境变量管理
│   │   ├── paths.js        # 路径解析
│   │   ├── auth.js         # 认证工具
│   │   └── AppError.js     # 错误处理
│   ├── db/                  # 数据库配置
│   │   ├── index.js         # 数据库连接管理
│   │   └── sqlite-schema.sql  # 数据库结构
│   └── main.js             # 应用入口文件
├── scripts/                 # 脚本工具
│   ├── init-db.mjs         # 数据库初始化
│   ├── reset-db.mjs        # 数据库重置
│   └── service.mjs         # 服务管理
├── config.yaml             # 配置文件
├── .env.example           # 环境变量示例
├── package.json           # 依赖配置
└── README.md             # 项目说明
```

## 🛠️ 开发指南

### 1. 创建新的数据模型

```javascript
// src/models/PostModel.js
import BaseModel from './BaseModel.js';
import { posts } from '../models/schema/index.js';

class PostModel extends BaseModel {
  constructor() {
    super('posts', posts);
    this.searchableFields = ['title', 'content'];
    this.safeFields = ['id', 'title', 'content', 'author_id', 'status', 'created_at', 'updated_at'];
  }

  async beforeCreate(data) {
    // 自定义创建前的验证和处理
    return data;
  }

  async beforeUpdate(data) {
    // 自定义更新前的验证和处理
    return data;
  }
}

export default PostModel;
```

### 2. 创建新的控制器

```javascript
// src/controllers/PostController.js
import { postModel } from '../models/index.js';
import AppError from '../utils/AppError.js';

class PostController {
  async getPosts(c) {
    try {
      const page = parseInt(c.req.query('page')) || 1;
      const limit = parseInt(c.req.query('limit')) || 20;

      const result = await postModel.getPosts(page, limit);
      return c.json({
        success: true,
        data: result
      });
    } catch (error) {
      return c.json({ success: false, error: error.message }, 500);
    }
  }

  async createPost(c) {
    try {
      const body = await c.req.json();
      const post = await postModel.create(body);

      return c.json({
        success: true,
        message: '帖子创建成功',
        data: post
      }, 201);
    } catch (error) {
      return c.json({ success: false, error: error.message }, 500);
    }
  }
}

export default new PostController();
```

### 3. 创建新的路由

```javascript
// src/routes/posts.js
import { Hono } from 'hono';
import { postController } from '../controllers/PostController.js';
import { authMiddleware } from '../middleware/auth.js';

const postRoutes = new Hono();

// 公开路由
postRoutes.get('/', postController.getPosts.bind(postController));

// 需要认证的路由
postRoutes.use('*', authMiddleware);
postRoutes.post('/', postController.createPost.bind(postController));
postRoutes.put('/:id', postController.updatePost.bind(postController));
postRoutes.delete('/:id', postController.deletePost.bind(postController));

export default postRoutes;
```

### 4. 注册路由

```javascript
// src/main.js
import postRoutes from './routes/posts.js';

// 在应用中挂载路由
app.route('/api/posts', postRoutes);
```

## 📚 API 文档

### 用户管理 API

#### 获取用户列表
```http
GET /api/users?page=1&limit=20&status=active
```

#### 获取用户详情
```http
GET /api/users/:id
Authorization: Bearer <token>
```

#### 创建用户
```http
POST /api/users
Content-Type: application/json

{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "password123",
  "first_name": "John",
  "last_name": "Doe"
}
```

#### 更新用户
```http
PUT /api/users/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "first_name": "John",
  "last_name": "Smith"
}
```

#### 删除用户
```http
DELETE /api/users/:id
Authorization: Bearer <token>
```

#### 用户登录
```http
POST /api/users/auth/login
Content-Type: application/json

{
  "identifier": "john_doe",
  "password": "password123"
}
```

#### 用户注册
```http
POST /api/users/auth/register
Content-Type: application/json

{
  "username": "new_user",
  "email": "newuser@example.com",
  "password": "password123"
}
```

### 健康检查 API

#### 系统健康状态
```http
GET /api/health
```

#### 数据库健康状态
```http
GET /api/health/db
```

#### 系统详细信息
```http
GET /api/health/system
```

## ⚙️ 配置

### 环境变量

主要环境变量配置：

```bash
# 基础配置
NODE_ENV=development           # 环境：development/production
HOST=0.0.0.0              # 服务主机
PORT=5050                  # 服务端口

# 数据库配置
DATABASE_TYPE=sqlite          # 数据库类型：sqlite/mysql
DATABASE_PATH=./data/app.db  # SQLite 数据库路径
DB_HOST=localhost            # MySQL 主机
DB_PORT=3306               # MySQL 端口
DB_NAME=bun_server          # MySQL 数据库名
DB_USER=root               # MySQL 用户名
DB_PASSWORD=password        # MySQL 密码

# 日志配置
LOG_LEVEL=info             # 日志级别
LOG_DIRECTORY=./logs       # 日志目录
DB_LOG_DEBUG=false         # 数据库调试日志
```

### 配置文件

可以通过 `config.yaml` 文件进行配置：

```yaml
server:
  host: 0.0.0.0
  port: 5050

database:
  type: sqlite
  path: ./data/app.db

logging:
  level: info
  log_directory: ./logs
```

配置优先级：**环境变量 > 配置文件 > 默认值**

## 🗄️ 数据库

### 支持的数据库

#### SQLite（默认）
- 适用于开发和中小型应用
- 零配置，即开即用
- 数据库文件存储在 `./data/app.db`

#### MySQL
- 适用于生产环境
- 需要手动创建数据库
- 支持连接池和主从配置

### 数据库迁移

数据库结构通过 SQL 文件定义，支持自动迁移：

- SQLite: `src/db/sqlite-schema.sql`
- MySQL: `src/models/schema/mysql.js`

### 索引优化

已为主要表创建索引，确保查询性能：

```sql
-- 用户表索引
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_created_at ON users(created_at);
```

## 🔧 部署

### 1. 本地构建

```bash
# 构建可执行文件
bun run build

# 构建不同平台的可执行文件
bun run build:linux   # Linux
bun run build:macos   # macOS
bun run build:windows # Windows
```

### 2. Docker 部署

```dockerfile
FROM oven/bun:latest

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install

COPY . .
RUN bun run build

EXPOSE 5050
CMD ["./dist/server"]
```

### 3. 服务管理

```bash
# 启动服务
bun run service:start

# 停止服务
bun run service:stop

# 重启服务
bun run service:restart

# 查看服务状态
bun run service:status
```

## 🧪 测试

```bash
# 运行测试
bun test

# 运行特定测试文件
bun test test/users.test.js
```

## 📊 监控

### 健康检查

内置三个级别的健康检查：

1. **基础健康**: 服务状态、运行时间、内存使用
2. **数据库健康**: 数据库连接状态
3. **系统健康**: 详细的系统资源信息

### 结构化日志

框架支持结构化日志输出：

```javascript
// 示例日志格式
{
  "timestamp": "2024-01-01T00:00:00Z",
  "level": "info",
  "method": "GET",
  "path": "/api/users",
  "statusCode": 200,
  "duration": 150,
  "ip": "127.0.0.1"
}
```

## 🛡️ 安全特性

### 密码安全

- 使用 SHA-256 哈希算法存储密码
- 密码强度验证（最少6位）
- 防止密码泄露（返回数据中移除密码哈希）

### 输入验证

- 用户名格式验证（3-20位字母、数字、下划线）
- 邮箱格式验证
- SQL 注入防护（通过 ORM 参数化查询）

### 访问控制

- 基于中间件的认证系统
- 支持可选认证和强制认证
- 预留管理员权限控制

## 🚀 性能优化

### 数据库优化

- 连接池管理（MySQL）
- 索引优化
- 查询缓存（开发环境）

### 应用优化

- 轻量级 Hono 框架
- 异步非阻塞 I/O
- 内存使用监控

### 缓存策略

- 预留缓存中间件接口
- 数据库查询结果缓存
- 静态文件缓存

## 🤝 扩展指南

### 1. 添加新的中间件

```javascript
// src/middleware/rateLimiter.js
export async function rateLimiterMiddleware(c, next) {
  // 实现速率限制逻辑
  await next();
}
```

### 2. 集成新的数据库

```javascript
// src/db/postgres.js
export async function initPostgres() {
  // 实现 PostgreSQL 初始化
}
```

### 3. 添加认证方式

```javascript
// src/middleware/jwt.js
export async function jwtMiddleware(c, next) {
  // 实现 JWT 认证
  await next();
}
```

## 🐛 故障排除

### 常见问题

1. **数据库连接失败**
   - 检查数据库服务是否启动
   - 验证连接参数配置
   - 查看日志中的详细错误信息

2. **端口占用**
   - 更改 `PORT` 环境变量
   - 使用 `lsof -i :5050` 查看端口占用情况

3. **权限问题**
   - 确保 `data/` 目录有写权限
   - 检查数据库文件权限设置

### 调试模式

启用调试日志：

```bash
export DB_LOG_DEBUG=true
export LOG_LEVEL=debug
bun run dev
```

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 支持

如有问题，请通过以下方式联系：

- 提交 GitHub Issue
- 查看项目文档
- 发送邮件至维护者

---

**Bun Server Framework** - 现代化、高性能的 Web 后端开发框架