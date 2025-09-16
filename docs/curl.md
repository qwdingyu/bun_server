```
现在需要针对我们讨论的需求、方案、技术（纯JavaScript+ccs，后端使用bunjs+bun内置的sqlite+drizzle-orm,我有一套标准的框架）我需要帮我写一个完整的需求，针对高级其他扩展除表格之外的功能，放在第二阶段
。我想快速的实现一个纯前端的版本，用户自己填写api_key用户跑通整个流程，看看实际的效果。然后再考虑扩展后端，否则，功能实现不理想，再强悍的后端也解决不了问题。
我希望基于目前的核心诉求，结合之前的文档，重新全面的梳理一遍，明确需求，技术，和我们落地的技术细节，然后再给出计划分解。请使用spec-kit工具将相关的文档保存到docs目录中。
```

### 快速启动

```shell
  cd bun_server
  bun install
  cp .env.example .env
  bun run db:init
  bun run dev


```

### 可用端点

- GET / - 框架信息
- GET /api/health - 健康检查
- GET /api/users - 用户列表
- POST /api/users - 创建用户
- POST /api/users/auth/login - 用户登录
- POST /api/users/auth/register - 用户注册

### 基础端点

- 返回框架基本信息

```shell
  curl http://localhost:5050/
```

### 健康检查

- 返回系统健康状态

```shell
  curl http://localhost:5050/api/health

```

### 用户列表（公开）

- 返回用户列表（初始为空）

```shell
  curl http://localhost:5050/api/users
```

### 创建用户

```shell
curl -X POST http://localhost:5050/api/users \
    -H "Content-Type: application/json" \
    -d '{
      "username": "testuser",
      "email": "test@example.com",
      "password": "password123",
      "first_name": "Test",
      "last_name": "User"
    }'

curl -X POST http://localhost:5050/api/users \
    -H "Content-Type: application/json" \
    -d '{
      "username": "admin",
      "email": "admin@example.com",
      "password": "password123",
      "first_name": "Test",
      "last_name": "User"
    }'
```

### 用户登录

```shell
  curl -X POST http://localhost:5050/api/users/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "identifier": "testuser",
      "password": "password123"
    }'

# 5. 获取用户统计
curl http://localhost:5050/api/users/stats

# 6. 测试分页和过滤
curl "http://localhost:5050/api/users?page=1&limit=10&status=active"
```
