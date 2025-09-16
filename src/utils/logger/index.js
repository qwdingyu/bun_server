import { existsSync, mkdirSync, writeFileSync, appendFileSync, readdirSync, statSync, unlinkSync } from 'fs'
import { resolve, join } from 'path'
import { loadConfig } from '../config.js'

const config = loadConfig()

// 日志级别
const LogLevels = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
}

// 日志颜色
const LogColors = {
  DEBUG: '\x1b[36m', // 青色
  INFO: '\x1b[32m',  // 绿色
  WARN: '\x1b[33m',  // 黄色
  ERROR: '\x1b[31m', // 红色
  RESET: '\x1b[0m'   // 重置
}

class Logger {
  constructor(options = {}) {
    this.level = this.getLevelFromString(options.level || config.logging?.level || 'info')
    this.directory = options.directory || config.logging?.log_directory || './logs'
    this.maxFiles = options.maxFiles || config.logging?.max_files || 10
    this.maxSize = options.maxSize || config.logging?.max_size || 10 * 1024 * 1024 // 10MB
    this.format = options.format || config.logging?.format || 'json'
    this.consoleOutput = options.consoleOutput !== undefined ? options.consoleOutput : config.logging?.console_output !== false

    // 确保日志目录存在
    this.ensureLogDirectory()

    // 获取当前日志文件路径
    this.currentLogFile = this.getCurrentLogFile()
  }

  getLevelFromString(levelString) {
    return LogLevels[levelString.toUpperCase()] ?? LogLevels.INFO
  }

  getLevelString(level) {
    return Object.keys(LogLevels).find(key => LogLevels[key] === level) || 'INFO'
  }

  ensureLogDirectory() {
    if (!existsSync(this.directory)) {
      mkdirSync(this.directory, { recursive: true })
    }
  }

  getCurrentLogFile() {
    const date = new Date().toISOString().split('T')[0]
    return join(this.directory, `app-${date}.log`)
  }

  shouldLog(level) {
    return level >= this.level
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString()
    const levelString = this.getLevelString(level)

    if (this.format === 'json') {
      return JSON.stringify({
        timestamp,
        level: levelString.toLowerCase(),
        message,
        ...meta
      })
    } else {
      // 简单文本格式
      const metaString = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : ''
      return `${timestamp} [${levelString}] ${message}${metaString}`
    }
  }

  formatConsoleMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString()
    const levelString = this.getLevelString(level)
    const color = LogColors[levelString]
    const reset = LogColors.RESET

    let consoleMessage = `${color}[${timestamp}] [${levelString}]${reset} ${message}`

    if (Object.keys(meta).length > 0) {
      consoleMessage += ` ${JSON.stringify(meta, null, 2)}`
    }

    return consoleMessage
  }

  writeToFile(content) {
    try {
      // 检查当前日志文件是否需要轮转
      this.rotateLogIfNeeded()

      // 获取最新的日志文件路径
      this.currentLogFile = this.getCurrentLogFile()

      // 写入日志文件
      appendFileSync(this.currentLogFile, content + '\n')
    } catch (error) {
      console.error('写入日志文件失败:', error.message)
    }
  }

  rotateLogIfNeeded() {
    try {
      if (!existsSync(this.currentLogFile)) {
        return
      }

      const stats = statSync(this.currentLogFile)

      // 如果文件大小超过限制，进行轮转
      if (stats.size > this.maxSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const rotatedFile = this.currentLogFile.replace('.log', `-${timestamp}.log`)

        // 重命名当前文件
        require('fs').renameSync(this.currentLogFile, rotatedFile)

        // 清理旧日志文件
        this.cleanupOldLogs()
      }
    } catch (error) {
      console.error('日志轮转失败:', error.message)
    }
  }

  cleanupOldLogs() {
    try {
      const files = readdirSync(this.directory)
        .filter(file => file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: join(this.directory, file),
          mtime: statSync(join(this.directory, file)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime)

      // 如果日志文件数量超过限制，删除最旧的
      if (files.length > this.maxFiles) {
        const filesToDelete = files.slice(this.maxFiles)
        for (const file of filesToDelete) {
          unlinkSync(file.path)
        }
      }
    } catch (error) {
      console.error('清理旧日志文件失败:', error.message)
    }
  }

  log(level, message, meta = {}) {
    if (!this.shouldLog(level)) {
      return
    }

    const formattedMessage = this.formatMessage(level, message, meta)

    // 写入文件
    this.writeToFile(formattedMessage)

    // 控制台输出
    if (this.consoleOutput) {
      const consoleMessage = this.formatConsoleMessage(level, message, meta)

      if (level >= LogLevels.ERROR) {
        console.error(consoleMessage)
      } else if (level >= LogLevels.WARN) {
        console.warn(consoleMessage)
      } else {
        console.log(consoleMessage)
      }
    }
  }

  debug(message, meta = {}) {
    this.log(LogLevels.DEBUG, message, meta)
  }

  info(message, meta = {}) {
    this.log(LogLevels.INFO, message, meta)
  }

  warn(message, meta = {}) {
    this.log(LogLevels.WARN, message, meta)
  }

  error(message, meta = {}) {
    // 如果meta是Error对象，提取堆栈信息
    if (meta instanceof Error) {
      meta = {
        name: meta.name,
        message: meta.message,
        stack: meta.stack,
        cause: meta.cause
      }
    }

    this.log(LogLevels.ERROR, message, meta)
  }

  // HTTP请求日志
  request(method, path, statusCode, duration, meta = {}) {
    const message = `${method} ${path} - ${statusCode} (${duration}ms)`
    const level = statusCode >= 500 ? LogLevels.ERROR :
                  statusCode >= 400 ? LogLevels.WARN :
                  LogLevels.INFO

    this.log(level, message, {
      type: 'request',
      method,
      path,
      statusCode,
      duration,
      ...meta
    })
  }

  // 数据库查询日志
  query(sql, duration, meta = {}) {
    this.debug('Database query executed', {
      type: 'database',
      sql: sql.substring(0, 200), // 截断长SQL
      duration,
      ...meta
    })
  }

  // 认证日志
  auth(action, userId, success, meta = {}) {
    const message = `Authentication ${action}: ${success ? 'success' : 'failed'}`
    const level = success ? LogLevels.INFO : LogLevels.WARN

    this.log(level, message, {
      type: 'auth',
      action,
      userId,
      success,
      ...meta
    })
  }

  // 性能日志
  performance(operation, duration, meta = {}) {
    const level = duration > 1000 ? LogLevels.WARN : LogLevels.INFO

    this.log(level, `Performance: ${operation} took ${duration}ms`, {
      type: 'performance',
      operation,
      duration,
      ...meta
    })
  }

  // 业务日志
  business(event, data = {}) {
    this.info(`Business event: ${event}`, {
      type: 'business',
      event,
      ...data
    })
  }

  // 安全日志
  security(event, severity = 'medium', meta = {}) {
    const level = severity === 'high' ? LogLevels.ERROR :
                  severity === 'medium' ? LogLevels.WARN :
                  LogLevels.INFO

    this.log(level, `Security event: ${event}`, {
      type: 'security',
      event,
      severity,
      ...meta
    })
  }

  // 创建子logger（带有默认meta）
  child(defaultMeta = {}) {
    const childLogger = Object.create(this)
    childLogger.defaultMeta = { ...this.defaultMeta, ...defaultMeta }

    // 重写log方法以包含默认meta
    const originalLog = this.log.bind(this)
    childLogger.log = (level, message, meta = {}) => {
      originalLog(level, message, { ...childLogger.defaultMeta, ...meta })
    }

    return childLogger
  }
}

// 创建默认logger实例
const defaultLogger = new Logger()

// 导出便捷方法
export const debug = defaultLogger.debug.bind(defaultLogger)
export const info = defaultLogger.info.bind(defaultLogger)
export const warn = defaultLogger.warn.bind(defaultLogger)
export const error = defaultLogger.error.bind(defaultLogger)
export const request = defaultLogger.request.bind(defaultLogger)
export const query = defaultLogger.query.bind(defaultLogger)
export const auth = defaultLogger.auth.bind(defaultLogger)
export const performance = defaultLogger.performance.bind(defaultLogger)
export const business = defaultLogger.business.bind(defaultLogger)
export const security = defaultLogger.security.bind(defaultLogger)

// 导出Logger类和默认实例
export { Logger, LogLevels }
export default defaultLogger
