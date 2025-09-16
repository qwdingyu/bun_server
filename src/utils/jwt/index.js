import jwt from 'jsonwebtoken'
import { loadConfig } from '../config.js'

const config = loadConfig()

// JWT 配置
const JWT_SECRET = process.env.JWT_SECRET || config.auth?.jwt_secret || 'your-super-secret-jwt-key-change-in-production'
const JWT_EXPIRES_IN = config.auth?.jwt_expires_in || '24h'
const JWT_REFRESH_EXPIRES_IN = config.auth?.jwt_refresh_expires_in || '7d'

/**
 * 生成 access token
 */
export function generateToken(payload, options = {}) {
  const defaultOptions = {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'bun-server-framework',
    audience: 'api-client'
  }

  return jwt.sign(payload, JWT_SECRET, { ...defaultOptions, ...options })
}

/**
 * 生成 refresh token
 */
export function generateRefreshToken(payload, options = {}) {
  const defaultOptions = {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
    issuer: 'bun-server-framework',
    audience: 'api-client'
  }

  return jwt.sign(payload, JWT_SECRET, { ...defaultOptions, ...options })
}

/**
 * 验证 token
 */
export function verifyToken(token, options = {}) {
  try {
    const defaultOptions = {
      issuer: 'bun-server-framework',
      audience: 'api-client'
    }

    return {
      success: true,
      payload: jwt.verify(token, JWT_SECRET, { ...defaultOptions, ...options }),
      error: null
    }
  } catch (error) {
    return {
      success: false,
      payload: null,
      error: {
        name: error.name,
        message: error.message,
        expired: error.name === 'TokenExpiredError'
      }
    }
  }
}

/**
 * 解码 token（不验证签名）
 */
export async function decodeToken(token) {
  try {
    return jwt.decode(token, { complete: true })
  } catch (error) {
    return null
  }
}

/**
 * 生成用户 token 对
 */
export function generateTokenPair(user) {
  const payload = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role || 'user'
  }

  const accessToken = generateToken(payload)
  const refreshToken = generateRefreshToken({ id: user.id })

  return {
    accessToken,
    refreshToken,
    expiresIn: JWT_EXPIRES_IN,
    tokenType: 'Bearer'
  }
}

/**
 * 验证并刷新 token
 */
export function refreshTokenPair(refreshToken) {
  const result = verifyToken(refreshToken)

  if (!result.success) {
    return {
      success: false,
      error: 'Invalid refresh token'
    }
  }

  // 这里应该从数据库获取最新的用户信息
  // 简化实现，实际应用中需要查询数据库
  return {
    success: true,
    tokens: generateTokenPair({ id: result.payload.id })
  }
}

/**
 * 提取 Bearer token
 */
export function extractBearerToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  return authHeader.substring(7)
}

/**
 * 检查 token 是否即将过期（15分钟内）
 */
export function isTokenNearExpiry(token) {
  const decoded = decodeToken(token)
  if (!decoded || !decoded.payload.exp) {
    return false
  }

  const expiryTime = decoded.payload.exp * 1000 // 转换为毫秒
  const currentTime = Date.now()
  const fifteenMinutes = 15 * 60 * 1000

  return expiryTime - currentTime <= fifteenMinutes
}

/**
 * 生成安全的随机字符串（用于 JWT secret）
 */
export function generateSecureSecret(length = 64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  let result = ''

  if (typeof crypto !== 'undefined' && crypto.randomBytes) {
    // Node.js/Bun 环境
    const bytes = crypto.randomBytes(length)
    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % chars.length]
    }
  } else {
    // 浏览器环境fallback
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)]
    }
  }

  return result
}

export default {
  generateToken,
  generateRefreshToken,
  verifyToken,
  decodeToken,
  generateTokenPair,
  refreshTokenPair,
  extractBearerToken,
  isTokenNearExpiry,
  generateSecureSecret
}
