import { serve } from '@hono/node-server'
import { writeFileSync, existsSync, unlinkSync, mkdirSync } from 'fs'
import { resolveProjectPath } from './utils/paths.js'
import * as logger from './utils/logger/index.js'

// 写入 PID 文件，并集中注册进程级退出/异常处理，避免 app 创建逻辑夹杂运行时副作用。
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

export function startServer(app, config) {
  logger.info('🚀 启动 Bun Server Framework')
  logger.info(`🌐 服务器: http://${config.server.host}:${config.server.port}`)
  logger.info(`🩺 健康检查: http://${config.server.host}:${config.server.port}/health`)

  if (process.env.NODE_ENV !== 'production') {
    logger.info(`📚 API文档: http://${config.server.host}:${config.server.port}/docs`)
  }

  if (config.monitoring?.enable_metrics !== false) {
    logger.info(`📊 系统指标: http://${config.server.host}:${config.server.port}/metrics`)
  }

  writePidFile()

  // 在 Bun 环境优先使用 Bun.serve，否则使用 node-server，保持本地与 Node 兼容部署路径一致。
  if (typeof globalThis.Bun !== 'undefined' && typeof Bun.serve === 'function') {
    Bun.serve({
      fetch: app.fetch,
      port: config.server.port,
      hostname: config.server.host,
      development: process.env.NODE_ENV !== 'production'
    })
    logger.info(`✅ 服务器运行在 http://${config.server.host}:${config.server.port}`)
    console.log(`✅ Server running on http://${config.server.host}:${config.server.port}`)
    return
  }

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

export default startServer
