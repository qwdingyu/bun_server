import { loadConfig } from '../../utils/config.js'

const config = loadConfig()

/**
 * CORS 中间件
 */
export function corsMiddleware(options = {}) {
  const defaultOptions = {
    origin: config.cors?.origin || ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173'],
    methods: config.cors?.methods || ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: config.cors?.allowed_headers || [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-API-Key',
      'Accept'
    ],
    credentials: config.cors?.credentials === true,
    maxAge: config.cors?.max_age || 86400 // 24小时
  }

  const corsOptions = { ...defaultOptions, ...options }

  return async (c, next) => {
    const origin = c.req.header('Origin')
    const method = c.req.method

    // 处理预检请求
    if (method === 'OPTIONS') {
      const allowedOrigin = getOrigin(origin, corsOptions.origin, corsOptions.credentials)
      // 设置 CORS 头
      c.header('Access-Control-Allow-Origin', allowedOrigin)
      c.header('Access-Control-Allow-Methods', corsOptions.methods.join(', '))
      c.header('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(', '))
      c.header('Access-Control-Max-Age', corsOptions.maxAge.toString())
      c.header('Vary', 'Origin')

      if (corsOptions.credentials && allowedOrigin !== '*') {
        c.header('Access-Control-Allow-Credentials', 'true')
      }

      return c.text('', 204)
    }

    // 设置 CORS 头
    const allowedOrigin = getOrigin(origin, corsOptions.origin, corsOptions.credentials)
    c.header('Access-Control-Allow-Origin', allowedOrigin)
    c.header('Vary', 'Origin')
    if (corsOptions.credentials && allowedOrigin !== '*') {
      c.header('Access-Control-Allow-Credentials', 'true')
    }

    await next()
  }
}

/**
 * 获取允许的源
 */
function getOrigin(requestOrigin, allowedOrigin, allowCredentials = false) {
  if (allowedOrigin === '*') {
    return allowCredentials ? (requestOrigin || 'null') : '*'
  }

  if (Array.isArray(allowedOrigin)) {
    return allowedOrigin.includes(requestOrigin) ? requestOrigin : 'null'
  }

  if (typeof allowedOrigin === 'function') {
    return allowedOrigin(requestOrigin) ? requestOrigin : 'null'
  }

  return allowedOrigin === requestOrigin ? requestOrigin : 'null'
}

/**
 * 安全头中间件
 */
export function securityHeadersMiddleware(options = {}) {
  const defaultHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    ...config.security?.headers
  }

  const headers = { ...defaultHeaders, ...options }

  return async (c, next) => {
    // 设置安全头
    Object.entries(headers).forEach(([name, value]) => {
      if (value !== null && value !== undefined) {
        c.header(name, value)
      }
    })

    await next()
  }
}

/**
 * 内容安全策略中间件
 */
export function cspMiddleware(policy = null) {
  const defaultPolicy = config.security?.csp || {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    'style-src': ["'self'"],
    'img-src': ["'self'", "data:", "https:"],
    'font-src': ["'self'"],
    'connect-src': ["'self'"],
    'frame-ancestors': ["'none'"]
  }

  const cspPolicy = policy || defaultPolicy

  return async (c, next) => {
    const policyString = Object.entries(cspPolicy)
      .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
      .join('; ')

    c.header('Content-Security-Policy', policyString)
    await next()
  }
}

/**
 * 速率限制中间件
 */
export function rateLimitMiddleware(options = {}) {
  const defaultOptions = {
    windowMs: 15 * 60 * 1000, // 15分钟
    maxRequests: 100, // 最大请求数
    message: '请求过于频繁，请稍后重试',
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    keyGenerator: (c) => {
      return c.req.header('x-forwarded-for') ||
             c.req.header('x-real-ip') ||
             c.req.header('remote-addr') ||
             'unknown'
    },
    ...config.security?.rate_limit
  }

  const settings = { ...defaultOptions, ...options }
  const store = new Map() // 简单的内存存储，生产环境建议使用Redis

  return async (c, next) => {
    const key = settings.keyGenerator(c)
    const now = Date.now()
    const windowStart = now - settings.windowMs

    // 清理过期记录
    for (const [storeKey, data] of store.entries()) {
      if (data.resetTime <= now) {
        store.delete(storeKey)
      }
    }

    // 获取当前窗口的请求记录
    let record = store.get(key)
    if (!record || record.resetTime <= now) {
      record = {
        count: 0,
        resetTime: now + settings.windowMs
      }
    }

    record.count++
    store.set(key, record)

    // 设置响应头
    c.header('X-RateLimit-Limit', settings.maxRequests.toString())
    c.header('X-RateLimit-Remaining', Math.max(0, settings.maxRequests - record.count).toString())
    c.header('X-RateLimit-Reset', new Date(record.resetTime).toISOString())

    // 检查是否超出限制
    if (record.count > settings.maxRequests) {
      c.header('Retry-After', Math.ceil(settings.windowMs / 1000).toString())

      return c.json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: settings.message,
          timestamp: new Date().toISOString(),
          retryAfter: Math.ceil(settings.windowMs / 1000)
        }
      }, 429)
    }

    await next()
  }
}

/**
 * IP 白名单中间件
 */
export function ipWhitelistMiddleware(allowedIps = []) {
  const whitelist = config.security?.ip_whitelist || allowedIps

  return async (c, next) => {
    if (whitelist.length === 0) {
      await next()
      return
    }

    const clientIp = c.req.header('x-forwarded-for') ||
                     c.req.header('x-real-ip') ||
                     c.req.header('remote-addr') ||
                     'unknown'

    const ip = clientIp.split(',')[0].trim()

    if (!whitelist.includes(ip) && !whitelist.includes('*')) {
      return c.json({
        success: false,
        error: {
          code: 'IP_NOT_ALLOWED',
          message: 'IP地址不在允许列表中',
          timestamp: new Date().toISOString()
        }
      }, 403)
    }

    await next()
  }
}

/**
 * 用户代理检查中间件
 */
export function userAgentFilterMiddleware(options = {}) {
  const defaultOptions = {
    blockedPatterns: config.security?.blocked_user_agents || [
      /bot/i,
      /crawler/i,
      /spider/i
    ],
    allowedPatterns: config.security?.allowed_user_agents || [],
    blockUnknown: config.security?.block_unknown_user_agents || false
  }

  const settings = { ...defaultOptions, ...options }

  return async (c, next) => {
    const userAgent = c.req.header('User-Agent') || ''

    // 如果没有User-Agent且配置为阻止未知
    if (!userAgent && settings.blockUnknown) {
      return c.json({
        success: false,
        error: {
          code: 'INVALID_USER_AGENT',
          message: '无效的用户代理',
          timestamp: new Date().toISOString()
        }
      }, 403)
    }

    // 检查是否在允许列表中
    if (settings.allowedPatterns.length > 0) {
      const isAllowed = settings.allowedPatterns.some(pattern => pattern.test(userAgent))
      if (!isAllowed) {
        return c.json({
          success: false,
          error: {
            code: 'USER_AGENT_NOT_ALLOWED',
            message: '用户代理不被允许',
            timestamp: new Date().toISOString()
          }
        }, 403)
      }
    }

    // 检查是否在阻止列表中
    if (settings.blockedPatterns.length > 0) {
      const isBlocked = settings.blockedPatterns.some(pattern => pattern.test(userAgent))
      if (isBlocked) {
        return c.json({
          success: false,
          error: {
            code: 'USER_AGENT_BLOCKED',
            message: '用户代理被阻止',
            timestamp: new Date().toISOString()
          }
        }, 403)
      }
    }

    await next()
  }
}

/**
 * 请求大小限制中间件
 */
export function requestSizeLimitMiddleware(maxSize = 1024 * 1024) { // 默认1MB
  const limit = config.security?.max_request_size || maxSize

  return async (c, next) => {
    const contentLength = c.req.header('Content-Length')

    if (contentLength && parseInt(contentLength) > limit) {
      return c.json({
        success: false,
        error: {
          code: 'REQUEST_TOO_LARGE',
          message: `请求体过大，最大允许 ${Math.round(limit / 1024 / 1024)}MB`,
          timestamp: new Date().toISOString()
        }
      }, 413)
    }

    await next()
  }
}

export default {
  corsMiddleware,
  securityHeadersMiddleware,
  cspMiddleware,
  rateLimitMiddleware,
  ipWhitelistMiddleware,
  userAgentFilterMiddleware,
  requestSizeLimitMiddleware
}
