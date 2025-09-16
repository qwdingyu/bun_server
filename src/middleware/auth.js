import { verifyToken, extractBearerToken } from '../utils/jwt/index.js'
import { userModel, roleModel, permissionModel } from '../models/index.js'
import AppError from '../utils/AppError.js'

/**
 * JWT 认证中间件
 */
export async function authMiddleware(c, next) {
  try {
    // 从请求头获取 Authorization
    const authHeader = c.req.header('Authorization')
    const token = extractBearerToken(authHeader)

    if (!token) {
      return c.json(
        {
          success: false,
          error: {
            code: 'MISSING_TOKEN',
            message: '缺少认证令牌',
            timestamp: new Date().toISOString()
          }
        },
        401
      )
    }

    // 验证 JWT token
    const result = verifyToken(token)

    if (!result.success) {
      const errorCode = result.error.expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN'
      const message = result.error.expired ? '认证令牌已过期' : '认证令牌无效'

      return c.json(
        {
          success: false,
          error: {
            code: errorCode,
            message,
            timestamp: new Date().toISOString()
          }
        },
        401
      )
    }

    // 从数据库获取最新的用户信息（可选，用于确保用户仍然有效）
    try {
      const user = await userModel.findById(result.payload.id, ['id', 'username', 'email', 'status'])

      if (!user) {
        return c.json(
          {
            success: false,
            error: {
              code: 'USER_NOT_FOUND',
              message: '用户不存在',
              timestamp: new Date().toISOString()
            }
          },
          401
        )
      }

      if (user.status !== 'active') {
        return c.json(
          {
            success: false,
            error: {
              code: 'USER_INACTIVE',
              message: '用户已被禁用',
              timestamp: new Date().toISOString()
            }
          },
          403
        )
      }

      // 将用户信息添加到请求上下文
      c.set('user', user)
      c.set('tokenPayload', result.payload)
    } catch (dbError) {
      // 数据库查询失败，但token有效，使用token中的信息
      console.warn('无法从数据库验证用户，使用token信息:', dbError.message)
      c.set('user', result.payload)
      c.set('tokenPayload', result.payload)
    }

    await next()
  } catch (error) {
    console.error('认证中间件错误:', error)
    return c.json(
      {
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: '认证过程发生错误',
          timestamp: new Date().toISOString()
        }
      },
      500
    )
  }
}

/**
 * 可选的认证中间件（允许未认证访问）
 */
export async function optionalAuthMiddleware(c, next) {
  try {
    const authHeader = c.req.header('Authorization')
    const token = extractBearerToken(authHeader)

    if (token) {
      const result = verifyToken(token)

      if (result.success) {
        try {
          const user = await userModel.findById(result.payload.id, ['id', 'username', 'email', 'status'])

          if (user && user.status === 'active') {
            c.set('user', user)
            c.set('tokenPayload', result.payload)
          }
        } catch (dbError) {
          // 数据库查询失败，但token有效
          c.set('user', result.payload)
          c.set('tokenPayload', result.payload)
        }
      }
    }

    await next()
  } catch (error) {
    console.error('可选认证中间件错误:', error)
    // 可选认证失败时继续，不阻止请求
    await next()
  }
}

/**
 * 管理员权限中间件
 */
export async function adminMiddleware(c, next) {
  const user = c.get('user')

  if (!user) {
    return c.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '需要认证',
          timestamp: new Date().toISOString()
        }
      },
      401
    )
  }

  try {
    // 检查用户是否具有管理员角色
    const hasAdminRole = await roleModel.hasRole(user.id, ['admin', 'super_admin'])

    if (!hasAdminRole) {
      return c.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: '需要管理员权限',
            timestamp: new Date().toISOString()
          }
        },
        403
      )
    }

    await next()
  } catch (error) {
    console.error('管理员权限验证失败:', error)
    return c.json(
      {
        success: false,
        error: {
          code: 'PERMISSION_ERROR',
          message: '权限验证过程发生错误',
          timestamp: new Date().toISOString()
        }
      },
      500
    )
  }
}

/**
 * 角色权限检查中间件工厂
 */
export function requireRoles(...requiredRoles) {
  return async (c, next) => {
    const user = c.get('user')

    if (!user) {
      return c.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '需要认证',
            timestamp: new Date().toISOString()
          }
        },
        401
      )
    }

    try {
      // 检查用户是否拥有所需角色之一
      const hasRequiredRole = await roleModel.hasRole(user.id, requiredRoles)

      if (!hasRequiredRole) {
        return c.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: `需要以下角色之一: ${requiredRoles.join(', ')}`,
              timestamp: new Date().toISOString()
            }
          },
          403
        )
      }

      await next()
    } catch (error) {
      console.error('角色权限验证失败:', error)
      return c.json(
        {
          success: false,
          error: {
            code: 'PERMISSION_ERROR',
            message: '权限验证过程发生错误',
            timestamp: new Date().toISOString()
          }
        },
        500
      )
    }
  }
}

/**
 * 用户自己或管理员权限中间件
 */
export function requireOwnerOrAdmin(userIdParam = 'id') {
  return async (c, next) => {
    const user = c.get('user')

    if (!user) {
      return c.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '需要认证',
            timestamp: new Date().toISOString()
          }
        },
        401
      )
    }

    try {
      const targetUserId = parseInt(c.req.param(userIdParam))
      const isOwner = user.id === targetUserId

      // 如果是自己的资源，直接放行
      if (isOwner) {
        await next()
        return
      }

      // 否则检查是否有管理员角色
      const hasAdminRole = await roleModel.hasRole(user.id, ['admin', 'super_admin'])

      if (!hasAdminRole) {
        return c.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: '只能访问自己的资源或需要管理员权限',
              timestamp: new Date().toISOString()
            }
          },
          403
        )
      }

      await next()
    } catch (error) {
      console.error('所有者或管理员权限验证失败:', error)
      return c.json(
        {
          success: false,
          error: {
            code: 'PERMISSION_ERROR',
            message: '权限验证过程发生错误',
            timestamp: new Date().toISOString()
          }
        },
        500
      )
    }
  }
}

/**
 * API Key 认证中间件（用于服务间调用）
 */
export function apiKeyAuth(validApiKeys = []) {
  return async (c, next) => {
    const apiKey = c.req.header('X-API-Key') || c.req.query('api_key')

    if (!apiKey) {
      return c.json(
        {
          success: false,
          error: {
            code: 'MISSING_API_KEY',
            message: '缺少 API Key',
            timestamp: new Date().toISOString()
          }
        },
        401
      )
    }

    if (!validApiKeys.includes(apiKey)) {
      return c.json(
        {
          success: false,
          error: {
            code: 'INVALID_API_KEY',
            message: 'API Key 无效',
            timestamp: new Date().toISOString()
          }
        },
        401
      )
    }

    c.set('apiKey', apiKey)
    await next()
  }
}

/**
 * 权限检查中间件工厂
 */
export function requirePermissions(...requiredPermissions) {
  return async (c, next) => {
    const user = c.get('user')

    if (!user) {
      return c.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '需要认证',
            timestamp: new Date().toISOString()
          }
        },
        401
      )
    }

    try {
      // 检查用户是否拥有所需权限之一
      const hasRequiredPermission = await permissionModel.hasPermission(user.id, requiredPermissions)

      if (!hasRequiredPermission) {
        return c.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: `缺少所需权限: ${requiredPermissions.join(', ')}`,
              timestamp: new Date().toISOString()
            }
          },
          403
        )
      }

      await next()
    } catch (error) {
      console.error('权限验证失败:', error)
      return c.json(
        {
          success: false,
          error: {
            code: 'PERMISSION_ERROR',
            message: '权限验证过程发生错误',
            timestamp: new Date().toISOString()
          }
        },
        500
      )
    }
  }
}

/**
 * 资源操作权限检查中间件工厂
 */
export function requireResourcePermission(resource, action) {
  return async (c, next) => {
    const user = c.get('user')

    if (!user) {
      return c.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '需要认证',
            timestamp: new Date().toISOString()
          }
        },
        401
      )
    }

    try {
      // 检查用户权限
      const permName = `${resource}:${action}`
      const hasPermission = await permissionModel.hasPermission(user.id, permName)

      if (!hasPermission) {
        return c.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: `缺少对资源 ${resource} 的 ${action} 权限`,
              timestamp: new Date().toISOString()
            }
          },
          403
        )
      }

      await next()
    } catch (error) {
      console.error('资源权限验证失败:', error)
      return c.json(
        {
          success: false,
          error: {
            code: 'PERMISSION_ERROR',
            message: '权限验证过程发生错误',
            timestamp: new Date().toISOString()
          }
        },
        500
      )
    }
  }
}
