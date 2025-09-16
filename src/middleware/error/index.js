import { loadConfig } from '../../utils/config.js'
import AppError from '../../utils/AppError.js'

const config = loadConfig()

/**
 * 全局错误处理中间件
 */
export async function globalErrorHandler(error, c) {
  // 设置默认错误信息
  let statusCode = 500
  let message = '服务器内部错误'
  let errorCode = 'INTERNAL_SERVER_ERROR'
  let details = null

  // 处理已知的应用错误
  if (error instanceof AppError) {
    statusCode = error.statusCode
    message = error.message
    errorCode = error.code || 'APP_ERROR'
  }
  // 处理 Drizzle ORM 错误
  else if (error.name === 'DrizzleError' || error.message?.includes('drizzle')) {
    statusCode = 400
    message = '数据操作失败'
    errorCode = 'DATABASE_ERROR'
    if (process.env.NODE_ENV !== 'production') {
      details = error.message
    }
  }
  // 处理 JWT 错误
  else if (error.name === 'JsonWebTokenError') {
    statusCode = 401
    message = '认证令牌无效'
    errorCode = 'INVALID_TOKEN'
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401
    message = '认证令牌已过期'
    errorCode = 'TOKEN_EXPIRED'
  }
  // 处理验证错误
  else if (error.name === 'ValidationError' || error.name === 'ZodError') {
    statusCode = 400
    message = '请求数据验证失败'
    errorCode = 'VALIDATION_ERROR'
    details = error.errors || error.issues
  }
  // 处理权限错误
  else if (error.name === 'ForbiddenError') {
    statusCode = 403
    message = '权限不足'
    errorCode = 'FORBIDDEN'
  }
  // 处理未找到错误
  else if (error.name === 'NotFoundError') {
    statusCode = 404
    message = '资源未找到'
    errorCode = 'NOT_FOUND'
  }
  // 处理其他未知错误
  else {
    console.error('未处理的错误:', error)

    // 开发环境显示详细错误信息
    if (process.env.NODE_ENV !== 'production') {
      message = error.message || '服务器内部错误'
      details = {
        name: error.name,
        stack: error.stack,
        cause: error.cause
      }
    }
  }

  // 记录错误日志
  const errorLog = {
    timestamp: new Date().toISOString(),
    level: 'error',
    statusCode,
    errorCode,
    message: error.message || message,
    path: c.req.path,
    method: c.req.method,
    userAgent: c.req.header('user-agent'),
    ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
  }

  // 在生产环境中，错误详情不包含在日志中以防敏感信息泄露
  if (process.env.NODE_ENV !== 'production' && error.stack) {
    errorLog.stack = error.stack
  }

  console.error('[ERROR]', JSON.stringify(errorLog))

  // 构建错误响应
  const errorResponse = {
    success: false,
    error: {
      code: errorCode,
      message,
      timestamp: new Date().toISOString()
    }
  }

  // 仅在非生产环境添加错误详情
  if (process.env.NODE_ENV !== 'production' && details) {
    errorResponse.error.details = details
  }

  // 添加请求ID（如果存在）
  const requestId = c.get('requestId')
  if (requestId) {
    errorResponse.error.requestId = requestId
  }

  return c.json(errorResponse, statusCode)
}

/**
 * 异步错误捕获包装器
 */
export function asyncHandler(fn) {
  return async (c, next) => {
    try {
      const result = await fn(c, next)
      return result
    } catch (error) {
      return globalErrorHandler(error, c)
    }
  }
}

/**
 * 404 处理中间件
 */
export async function notFoundHandler(c) {
  return c.json(
    {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `路由 ${c.req.method} ${c.req.path} 不存在`,
        timestamp: new Date().toISOString()
      }
    },
    404
  )
}

/**
 * 方法不允许处理中间件
 */
export async function methodNotAllowedHandler(c) {
  return c.json(
    {
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: `方法 ${c.req.method} 不被允许`,
        timestamp: new Date().toISOString()
      }
    },
    405
  )
}

/**
 * 请求超时处理中间件
 */
export function timeoutHandler(timeout = 30000) {
  return async (c, next) => {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Request timeout'))
      }, timeout)
    })

    try {
      await Promise.race([next(), timeoutPromise])
    } catch (error) {
      if (error.message === 'Request timeout') {
        return c.json(
          {
            success: false,
            error: {
              code: 'REQUEST_TIMEOUT',
              message: '请求超时',
              timestamp: new Date().toISOString()
            }
          },
          408
        )
      }
      throw error
    }
  }
}

export default {
  globalErrorHandler,
  asyncHandler,
  notFoundHandler,
  methodNotAllowedHandler,
  timeoutHandler
}
