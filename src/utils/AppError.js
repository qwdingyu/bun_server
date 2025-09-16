/**
 * 应用程序自定义错误类
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = null, details = null) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
    this.isOperational = true
    this.timestamp = new Date().toISOString()

    // 捕获堆栈跟踪
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError)
    }
  }

  /**
   * 转换为JSON格式
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
      stack: process.env.NODE_ENV !== 'production' ? this.stack : undefined
    }
  }

  /**
   * 静态方法：创建400错误
   */
  static badRequest(message = '请求参数错误', code = 'BAD_REQUEST', details = null) {
    return new AppError(message, 400, code, details)
  }

  /**
   * 静态方法：创建401错误
   */
  static unauthorized(message = '未授权访问', code = 'UNAUTHORIZED', details = null) {
    return new AppError(message, 401, code, details)
  }

  /**
   * 静态方法：创建403错误
   */
  static forbidden(message = '禁止访问', code = 'FORBIDDEN', details = null) {
    return new AppError(message, 403, code, details)
  }

  /**
   * 静态方法：创建404错误
   */
  static notFound(message = '资源未找到', code = 'NOT_FOUND', details = null) {
    return new AppError(message, 404, code, details)
  }

  /**
   * 静态方法：创建409错误
   */
  static conflict(message = '资源冲突', code = 'CONFLICT', details = null) {
    return new AppError(message, 409, code, details)
  }

  /**
   * 静态方法：创建422错误
   */
  static unprocessableEntity(message = '无法处理的实体', code = 'UNPROCESSABLE_ENTITY', details = null) {
    return new AppError(message, 422, code, details)
  }

  /**
   * 静态方法：创建429错误
   */
  static tooManyRequests(message = '请求过于频繁', code = 'TOO_MANY_REQUESTS', details = null) {
    return new AppError(message, 429, code, details)
  }

  /**
   * 静态方法：创建500错误
   */
  static internal(message = '服务器内部错误', code = 'INTERNAL_SERVER_ERROR', details = null) {
    return new AppError(message, 500, code, details)
  }

  /**
   * 静态方法：创建503错误
   */
  static serviceUnavailable(message = '服务不可用', code = 'SERVICE_UNAVAILABLE', details = null) {
    return new AppError(message, 503, code, details)
  }

  /**
   * 静态方法：从其他错误创建AppError
   */
  static fromError(error, statusCode = 500, code = null) {
    if (error instanceof AppError) {
      return error
    }

    const appError = new AppError(error.message || '未知错误', statusCode, code)
    appError.stack = error.stack
    appError.originalError = error

    return appError
  }

  /**
   * 检查是否为客户端错误（4xx）
   */
  isClientError() {
    return this.statusCode >= 400 && this.statusCode < 500
  }

  /**
   * 检查是否为服务器错误（5xx）
   */
  isServerError() {
    return this.statusCode >= 500 && this.statusCode < 600
  }

  /**
   * 获取错误级别
   */
  getLevel() {
    if (this.statusCode >= 500) {
      return 'error'
    } else if (this.statusCode >= 400) {
      return 'warn'
    } else {
      return 'info'
    }
  }
}

// 常用错误代码常量
export const ErrorCodes = {
  // 认证相关
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  REFRESH_TOKEN_INVALID: 'REFRESH_TOKEN_INVALID',

  // 用户相关
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  USER_INACTIVE: 'USER_INACTIVE',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  USERNAME_ALREADY_EXISTS: 'USERNAME_ALREADY_EXISTS',

  // 验证相关
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_EMAIL: 'INVALID_EMAIL',
  INVALID_PASSWORD: 'INVALID_PASSWORD',
  INVALID_USERNAME: 'INVALID_USERNAME',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

  // 权限相关
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  ADMIN_REQUIRED: 'ADMIN_REQUIRED',
  OWNER_REQUIRED: 'OWNER_REQUIRED',

  // 资源相关
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
  RESOURCE_IN_USE: 'RESOURCE_IN_USE',

  // 系统相关
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',

  // 通用
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  CONFLICT: 'CONFLICT',
  UNPROCESSABLE_ENTITY: 'UNPROCESSABLE_ENTITY',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE'
}

export default AppError
