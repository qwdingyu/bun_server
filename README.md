# Bun Server Framework

一个基于 **Bun + Hono + Drizzle** 的轻量后台管理脚手架，用于快速搭建多个类似后台项目，减少认证、用户、RBAC、数据库初始化、审计、健康检查等重复开发。

项目目标不是大而全平台，也不是砍掉核心能力的 Lite 模板，而是“小而美的后台瑞士军刀”：默认可运行、可测试、可裁剪、可扩展。

## 核心能力

- **应用入口清晰**：`createApp()`、`bootstrapApp()`、`startServer()` 分离，便于测试和部署。
- **认证闭环**：Local JWT、refresh token 服务端会话、登出撤销、AuthProvider seam。
- **用户管理**：注册、登录、当前用户、列表、创建、更新、软删除、批量状态和批量删除。
- **RBAC 权限**：角色、权限、用户角色、角色权限、用户直授权限、deny 优先、轻量管理接口。
- **前端门禁**：当前用户权限、菜单树、按钮权限接口。
- **数据库支持**：SQLite 默认可用，MySQL 幂等建表和 seed 已通过真实连接验证。
- **审计日志**：用户和 RBAC 高风险写操作记录审计。
- **工程底座**：安全中间件、CORS、CSP、结构化日志、健康检查、统一错误处理。

## 快速开始

### 1. 安装依赖

```bash
bun install
```

### 2. 使用 SQLite 启动

默认配置使用 SQLite：`config.yaml` 中的 `database.type: sqlite`。

```bash
bun run db:init
bun run dev
```

验证：

```bash
curl http://localhost:5050/
curl http://localhost:5050/api/health
```

### 3. 运行测试

```bash
bun run test:all
```

MySQL 真实连接测试必须指向测试库或临时库，禁止指向生产库：

```bash
MYSQL_TEST_DATABASE_URL="mysql://user:pass@127.0.0.1:3306/bun_server_test" bun run test:mysql
```

### 4. 使用 MySQL 启动

先创建专用数据库，例如：

```sql
CREATE DATABASE IF NOT EXISTS bun_server_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

再启动：

```bash
DATABASE_TYPE=mysql \
DATABASE_URL="mysql://user:pass@127.0.0.1:3306/bun_server_test" \
bun run dev
```

应用会默认执行 MySQL 幂等建表和默认 seed。已有生产库请先评估迁移策略，不要直接指向生产库做测试。

## 常用接口

### 认证

```text
POST /api/users/auth/register
POST /api/users/auth/login
POST /api/users/auth/refresh
POST /api/users/auth/logout
```

### 当前用户与前端门禁

```text
GET /api/users/me
GET /api/users/me/permissions
GET /api/users/me/menus
```

### 用户管理

```text
GET    /api/users
GET    /api/users/:id
POST   /api/users
PUT    /api/users/:id
DELETE /api/users/:id
POST   /api/users/:id/toggle-status
POST   /api/users/:id/verify-email
POST   /api/users/batch/update-status
DELETE /api/users/batch
```

### RBAC 管理

```text
GET    /api/rbac/roles
GET    /api/rbac/permissions
GET    /api/rbac/users/:userId/roles
POST   /api/rbac/users/:userId/roles
DELETE /api/rbac/users/:userId/roles/:roleId
POST   /api/rbac/roles/:roleId/permissions
DELETE /api/rbac/roles/:roleId/permissions/:permissionId
```

RBAC 管理接口仅 `super_admin` 可访问。

## 项目结构

```text
src/
  app.js                    # 创建 Hono app，挂载中间件和路由
  main.js                   # bootstrapApp 入口，负责配置和数据库初始化
  server.js                 # startServer，负责监听端口和进程信号
  routes/                   # 路由注册、认证、校验
  controllers/              # 业务流程编排、日志、审计、响应
  models/                   # 数据访问和字段安全
  models/schema/            # SQLite/MySQL Drizzle schema
  db/                       # 数据库 DDL、seed、初始化
  middleware/               # 认证、安全、校验、错误处理
  modules/                  # auth、rbac/menu 等稳定 seam
  utils/                    # 配置、JWT、日志、时间、路径

docs/
  010_后台接口契约_2026-07-05.md
  011_后台前端集成契约_2026-07-05.md
  015_新增后台资源接入指南_2026-07-05.md
  016_项目架构设计与运行流程总览_2026-07-05.md
  017_抽象重构必要性评估_2026-07-05.md
  018_脚手架复用适用性审查_2026-07-05.md
```

## 新项目复用流程

```text
1. 复制或克隆本脚手架。
2. 修改 package.json name、端口、数据库配置、JWT_SECRET。
3. 选择 SQLite 或 MySQL。
4. 执行数据库初始化和测试。
5. 确认默认管理员、默认角色和默认权限。
6. 按 docs/015 新增第一个业务资源。
7. 同步菜单、按钮权限、审计日志、接口契约和测试。
8. 上线前执行全量测试。
```

新增业务资源时优先参考：`docs/015_新增后台资源接入指南_2026-07-05.md`。

## 设计边界

默认不做：

- 完整 IAM 平台。
- 复杂多租户/组织/岗位体系。
- 审批流或工作流引擎。
- 插件市场。
- 低代码菜单/权限设计器。
- 大而全前端管理后台。

这些能力可作为具体项目扩展，不应默认压入脚手架内核。

## 关键文档

- 项目评估：`docs/001_后台管理复用框架评估_2026-07-05.md`
- 开发门禁：`docs/009_开发前门禁实施进度_2026-07-05.md`
- 接口契约：`docs/010_后台接口契约_2026-07-05.md`
- 前端契约：`docs/011_后台前端集成契约_2026-07-05.md`
- RBAC：`docs/012_RBAC权限模型与种子数据_2026-07-05.md`
- MySQL：`docs/014_MySQL初始化与种子数据_2026-07-05.md`
- 新增资源：`docs/015_新增后台资源接入指南_2026-07-05.md`
- 架构总览：`docs/016_项目架构设计与运行流程总览_2026-07-05.md`
- 重构评估：`docs/017_抽象重构必要性评估_2026-07-05.md`
- 脚手架适用性：`docs/018_脚手架复用适用性审查_2026-07-05.md`

## 推荐下一步

当前最应该优先优化脚手架体验，而不是继续堆功能：

1. 增加更直观的 `test:all` 脚本。
2. 提供一个最小业务资源模板。
3. 小步拆分 `AuthController`，保持 URL 和响应不变。
4. 继续把真实项目踩坑记录沉淀到 `docs/`。
