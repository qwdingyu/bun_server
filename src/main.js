#!/usr/bin/env bun

import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { loadConfig, validateConfig } from './utils/config.js'
import { loadEnvToProcess } from './utils/env.js'
import { initializeDatabase } from './config/database.js'
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from 'fs'
import { resolveProjectPath } from './utils/paths.js'

// 导入中间件
import { globalErrorHandler, notFoundHandler, timeoutHandler } from './middleware/error/index.js'
import { corsMiddleware, securityHeadersMiddleware, rateLimitMiddleware, requestSizeLimitMiddleware } from './middleware/security/index.js'
import { optionalAuthMiddleware } from './middleware/auth.js'

// 导入路由模块
import userRoutes from './routes/users.js'
import healthRoutes from './routes/health.js'

// 导入日志系统
import * as logger from './utils/logger/index.js'

// 先将项目根 .env 注入到 process.env（不覆盖系统已有变量）
loadEnvToProcess()

// 加载配置
const config = loadConfig()

// 验证配置
const configErrors = validateConfig(config)
if (configErrors.length > 0) {
  console.error('❌ Configuration errors:')
  configErrors.forEach((error) => console.error(`  - ${error}`))
  console.error('Please fix the configuration file and restart the server.')
  process.exit(1)
}

// 初始化数据库
try {
  await initializeDatabase()
  logger.info('数据库初始化成功')
} catch (e) {
  logger.warn('数据库初始化失败，继续运行但数据库功能不可用', {
    error: e?.message || e
  })
  console.warn('⚠️ Database initialization failed, continuing without DB:', e?.message || e)
}

// 创建Hono应用
const app = new Hono()

// 全局错误处理
app.onError(globalErrorHandler)
app.notFound(notFoundHandler)

// 请求ID中间件
app.use('*', async (c, next) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  c.set('requestId', requestId)
  c.header('X-Request-ID', requestId)
  await next()
})

// 安全中间件
app.use('*', corsMiddleware())
app.use('*', securityHeadersMiddleware())
app.use('*', requestSizeLimitMiddleware())

// 速率限制中间件（可选，基于配置）
if (config.security?.rate_limit?.enable !== false) {
  app.use('*', rateLimitMiddleware())
}

// 请求超时中间件
app.use('*', timeoutHandler(config.server?.timeout || 30000))

// 请求日志中间件
app.use('*', async (c, next) => {
  const start = Date.now()
  const method = c.req.method
  const path = c.req.path
  const requestId = c.get('requestId')
  const userAgent = c.req.header('user-agent') || ''
  const clientIp = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'

  try {
    await next()

    const duration = Date.now() - start
    const statusCode = c.res.status

    // 记录请求日志
    logger.request(method, path, statusCode, duration, {
      requestId,
      userAgent,
      clientIp,
      contentLength: c.req.header('content-length') || 0
    })

    // 开发环境控制台输出
    if (process.env.NODE_ENV !== 'production') {
      const statusColor =
        statusCode >= 500
          ? '\x1b[31m' // 红色
          : statusCode >= 400
            ? '\x1b[33m' // 黄色
            : statusCode >= 300
              ? '\x1b[36m' // 青色
              : '\x1b[32m' // 绿色
      const reset = '\x1b[0m'

      console.log(`${statusColor}[${method}]${reset} ${path} - ${statusColor}${statusCode}${reset} (${duration}ms) [${requestId}]`)
    }
  } catch (error) {
    const duration = Date.now() - start

    // 记录错误请求日志
    logger.request(method, path, 500, duration, {
      requestId,
      userAgent,
      clientIp,
      error: error.message
    })

    throw error
  }
})

// 可选认证中间件（为需要的路由添加用户上下文）
app.use('*', optionalAuthMiddleware)

// API 文档路由（开发环境）
if (process.env.NODE_ENV !== 'production' && config.api?.enable_docs !== false) {
  app.get('/docs', (c) => {
    return c.html(`
<!DOCTYPE html>
<html>
<head>
    <title>Bun Server Framework - API Documentation</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
        .endpoint { margin-bottom: 30px; padding: 20px; border-left: 4px solid #007acc; background: #f8f9fa; }
        .method { display: inline-block; padding: 4px 8px; color: white; font-weight: bold; border-radius: 3px; }
        .get { background: #28a745; }
        .post { background: #007bff; }
        .put { background: #ffc107; color: #212529; }
        .delete { background: #dc3545; }
        .patch { background: #6f42c1; }
        code { background: #e9ecef; padding: 2px 4px; border-radius: 3px; }
        .auth-required { color: #dc3545; font-weight: bold; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 Bun Server Framework</h1>
        <p>轻量级现代化后端框架 API 文档</p>
        <p><strong>版本:</strong> 1.0.0 | <strong>环境:</strong> ${process.env.NODE_ENV || 'development'}</p>
    </div>

    <h2>🔐 认证说明</h2>
    <p>需要认证的接口请在请求头中包含: <code>Authorization: Bearer &lt;token&gt;</code></p>

    <h2>📋 API 接口</h2>

    <div class="endpoint">
        <h3><span class="method get">GET</span> /health</h3>
        <p>系统健康检查</p>
    </div>

    <div class="endpoint">
        <h3><span class="method post">POST</span> /api/users/auth/login</h3>
        <p>用户登录</p>
        <p><strong>参数:</strong> <code>{ "identifier": "username_or_email", "password": "password" }</code></p>
    </div>

    <div class="endpoint">
        <h3><span class="method post">POST</span> /api/users/auth/register</h3>
        <p>用户注册</p>
        <p><strong>参数:</strong> <code>{ "username": "string", "email": "string", "password": "string" }</code></p>
    </div>

    <div class="endpoint">
        <h3><span class="method post">POST</span> /api/users/auth/refresh</h3>
        <p>刷新访问令牌</p>
        <p><strong>参数:</strong> <code>{ "refreshToken": "string" }</code></p>
    </div>

    <div class="endpoint">
        <h3><span class="method post">POST</span> /api/users/auth/logout</h3>
        <p>用户登出 <span class="auth-required">🔒 需要认证</span></p>
    </div>

    <div class="endpoint">
        <h3><span class="method get">GET</span> /api/users/me</h3>
        <p>获取当前用户信息 <span class="auth-required">🔒 需要认证</span></p>
    </div>

    <div class="endpoint">
        <h3><span class="method get">GET</span> /api/users</h3>
        <p>获取用户列表</p>
        <p><strong>查询参数:</strong> page, limit, status, search</p>
    </div>

    <div class="endpoint">
        <h3><span class="method get">GET</span> /api/users/:id</h3>
        <p>根据ID获取用户 <span class="auth-required">🔒 需要认证</span></p>
    </div>

    <div class="endpoint">
        <h3><span class="method put">PUT</span> /api/users/:id</h3>
        <p>更新用户信息 <span class="auth-required">🔒 需要认证</span></p>
    </div>

    <div class="endpoint">
        <h3><span class="method delete">DELETE</span> /api/users/:id</h3>
        <p>删除用户 <span class="auth-required">🔒 管理员权限</span></p>
    </div>

    <div class="endpoint">
        <h3><span class="method get">GET</span> /api/users/stats</h3>
        <p>获取用户统计信息</p>
    </div>

    <h2>📊 监控端点</h2>

    <div class="endpoint">
        <h3><span class="method get">GET</span> /metrics</h3>
        <p>系统指标（Prometheus格式）</p>
    </div>

    <h2>🛠️ 开发工具</h2>
    <ul>
        <li><strong>日志:</strong> 查看 ${config.logging?.log_directory || './logs'} 目录</li>
        <li><strong>配置:</strong> 修改 config.yaml 文件</li>
        <li><strong>热重载:</strong> 修改代码后自动重启</li>
    </ul>

    <footer style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #ccc; color: #666;">
        <p>Generated at: ${new Date().toISOString()}</p>
        <p>Framework: Bun.js + Hono + Drizzle ORM</p>
    </footer>
</body>
</html>
    `)
  })
}

// 系统指标端点
if (config.monitoring?.enable_metrics !== false) {
  app.get('/metrics', (c) => {
    const memUsage = process.memoryUsage()
    const uptime = process.uptime()

    // 简单的 Prometheus 格式指标
    const metrics = `
# HELP process_uptime_seconds Process uptime in seconds
# TYPE process_uptime_seconds gauge
process_uptime_seconds ${uptime}

# HELP process_memory_usage_bytes Process memory usage in bytes
# TYPE process_memory_usage_bytes gauge
process_memory_usage_bytes{type="rss"} ${memUsage.rss}
process_memory_usage_bytes{type="heapTotal"} ${memUsage.heapTotal}
process_memory_usage_bytes{type="heapUsed"} ${memUsage.heapUsed}
process_memory_usage_bytes{type="external"} ${memUsage.external}

# HELP process_start_time_seconds Process start time in seconds since epoch
# TYPE process_start_time_seconds gauge
process_start_time_seconds ${Date.now() / 1000 - uptime}
`.trim()

    c.header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
    return c.text(metrics)
  })
}

// 健康检查端点（增强版）
app.get('/health', async (c) => {
  const startTime = Date.now()

  try {
    // 基础健康检查
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    }

    // 内存使用情况
    const memUsage = process.memoryUsage()
    health.memory = {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
    }

    // 数据库健康检查
    try {
      const { userModel } = await import('./models/index.js')
      // 简单的数据库连接测试 - 尝试获取用户统计
      const stats = await userModel.getUserStats()
      health.database = {
        status: 'healthy',
        type: config.database?.type || 'sqlite',
        records: stats.total
      }
    } catch (dbError) {
      health.database = {
        status: 'unhealthy',
        error: dbError.message,
        type: config.database?.type || 'sqlite'
      }
      health.status = 'degraded'
    }

    // 响应时间
    const duration = Date.now() - startTime
    health.responseTime = `${duration}ms`

    // 系统负载（如果可用）
    if (typeof process.getloadavg === 'function') {
      health.loadAverage = process.getloadavg()
    }

    logger.debug('健康检查完成', health)

    return c.json(health)
  } catch (error) {
    logger.error('健康检查失败', error)

    return c.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
        responseTime: `${Date.now() - startTime}ms`
      },
      500
    )
  }
})

// 挂载路由
const apiPrefix = config.api?.prefix || '/api'
app.route(`${apiPrefix}/users`, userRoutes)
app.route(`${apiPrefix}/health`, healthRoutes)

// 根路径
app.get('/', (c) => {
  return c.json({
    message: '🚀 Bun Server Framework',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      health: '/health',
      metrics: config.monitoring?.enable_metrics !== false ? '/metrics' : null,
      docs: process.env.NODE_ENV !== 'production' && config.api?.enable_docs !== false ? '/docs' : null,
      api: `${apiPrefix}`
    },
    features: [
      '✅ JWT Authentication',
      '✅ Input Validation',
      '✅ Rate Limiting',
      '✅ CORS Support',
      '✅ Security Headers',
      '✅ Structured Logging',
      '✅ Error Handling',
      '✅ Health Checks',
      '✅ API Documentation'
    ]
  })
})

// 写入 PID 文件
function writePidFile() {
  try {
    const dir = resolveProjectPath('data')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const pidFile = resolveProjectPath('data', 'service.pid')
    writeFileSync(pidFile, String(process.pid))

    const cleanup = () => {
      try {
        if (existsSync(pidFile)) unlinkSync(pidFile)
      } catch {}
      logger.info('服务已停止')
    }

    process.on('exit', cleanup)
    process.on('SIGINT', () => {
      logger.info('收到 SIGINT 信号，正在关闭服务...')
      cleanup()
      process.exit(0)
    })
    process.on('SIGTERM', () => {
      logger.info('收到 SIGTERM 信号，正在关闭服务...')
      cleanup()
      process.exit(0)
    })

    // 捕获未处理的异常
    process.on('uncaughtException', (error) => {
      logger.error('未捕获的异常', error)
      cleanup()
      process.exit(1)
    })

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('未处理的Promise拒绝', { reason, promise })
    })
  } catch (error) {
    logger.warn('写入PID文件失败', { error: error.message })
  }
}

// 启动服务器
logger.info('🚀 启动 Bun Server Framework')
logger.info(`🌐 服务器: http://${config.server.host}:${config.server.port}`)
logger.info(`🩺 健康检查: http://${config.server.host}:${config.server.port}/health`)
if (process.env.NODE_ENV !== 'production') {
  logger.info(`📚 API文档: http://${config.server.host}:${config.server.port}/docs`)
}
if (config.monitoring?.enable_metrics !== false) {
  logger.info(`📊 系统指标: http://${config.server.host}:${config.server.port}/metrics`)
}

// 导出用于测试 & Bun 的默认 fetch 处理
export default app
export const fetch = app.fetch

if (import.meta.main) {
  writePidFile()

  // 在 Bun 环境优先使用 Bun.serve，否则使用 node-server
  if (typeof globalThis.Bun !== 'undefined' && typeof Bun.serve === 'function') {
    Bun.serve({
      fetch: app.fetch,
      port: config.server.port,
      hostname: config.server.host,
      development: process.env.NODE_ENV !== 'production'
    })
    logger.info(`✅ 服务器运行在 http://${config.server.host}:${config.server.port}`)
    console.log(`✅ Server running on http://${config.server.host}:${config.server.port}`)
  } else {
    serve(
      {
        fetch: app.fetch,
        port: config.server.port,
        hostname: config.server.host
      },
      (info) => {
        logger.info(`✅ 服务器运行在 http://${info.address}:${info.port}`)
        console.log(`✅ Server running on http://${info.address}:${info.port}`)
      }
    )
  }
}
