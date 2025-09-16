import { Hono } from 'hono'
import { userController } from '../controllers/UserController.js'
import { authMiddleware, adminMiddleware, requireOwnerOrAdmin, requireRoles } from '../middleware/auth.js'
import { validateBody, validateQuery, validateParams, patterns, schemas } from '../middleware/validation/index.js'

// 创建用户路由
const userRoutes = new Hono()

// 验证模式定义
const loginSchema = {
  type: 'object',
  properties: {
    identifier: {
      type: 'string',
      minLength: 3,
      maxLength: 100
    },
    password: {
      type: 'string',
      minLength: 6
    }
  },
  required: ['identifier', 'password'],
  additionalProperties: false
}

const registerSchema = {
  type: 'object',
  properties: {
    username: {
      type: 'string',
      ...patterns.username
    },
    email: {
      type: 'string',
      ...patterns.email
    },
    password: {
      type: 'string',
      minLength: 6,
      maxLength: 128
    },
    first_name: {
      type: 'string',
      minLength: 1,
      maxLength: 50
    },
    last_name: {
      type: 'string',
      minLength: 1,
      maxLength: 50
    }
  },
  required: ['username', 'email', 'password'],
  additionalProperties: false
}

const updateUserSchema = {
  type: 'object',
  properties: {
    username: {
      type: 'string',
      ...patterns.username
    },
    email: {
      type: 'string',
      ...patterns.email
    },
    password: {
      type: 'string',
      minLength: 6,
      maxLength: 128
    },
    first_name: {
      type: 'string',
      minLength: 1,
      maxLength: 50
    },
    last_name: {
      type: 'string',
      minLength: 1,
      maxLength: 50
    },
    avatar_url: {
      type: 'string',
      ...patterns.url
    },
    status: {
      type: 'string',
      enum: ['active', 'inactive']
    },
    role: {
      type: 'string',
      enum: ['user', 'admin', 'super_admin']
    }
  },
  additionalProperties: false
}

const refreshTokenSchema = {
  type: 'object',
  properties: {
    refreshToken: {
      type: 'string',
      minLength: 1
    }
  },
  required: ['refreshToken'],
  additionalProperties: false
}

const userListQuerySchema = {
  type: 'object',
  properties: {
    page: {
      type: 'integer',
      minimum: 1,
      default: 1
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      default: 20
    },
    status: {
      type: 'string',
      enum: ['active', 'inactive']
    },
    search: {
      type: 'string',
      minLength: 1,
      maxLength: 100
    },
    sort: {
      type: 'string',
      enum: ['id', 'username', 'email', 'created_at', 'updated_at'],
      default: 'created_at'
    },
    order: {
      type: 'string',
      enum: ['asc', 'desc'],
      default: 'desc'
    }
  },
  additionalProperties: false
}

// ====== 公开路由（无需认证） ======

// 认证相关路由
userRoutes.post('/auth/register', validateBody(registerSchema), userController.register)

userRoutes.post('/auth/login', validateBody(loginSchema), userController.login)

userRoutes.post('/auth/refresh', validateBody(refreshTokenSchema), userController.refreshToken)

// 获取用户统计信息（公开）
userRoutes.get('/stats', userController.getUserStats)

// ====== 需要认证的路由 ======

// 认证相关的保护路由
userRoutes.post('/auth/logout', authMiddleware, userController.logout)

// 获取当前用户信息 - 必须在 /:id 之前定义
userRoutes.get('/me', authMiddleware, userController.getCurrentUser)

// 根据ID获取用户详细信息（需要认证）
userRoutes.get('/:id', authMiddleware, validateParams(schemas.id), userController.getUserById)

// 获取用户列表 - 移到后面，避免拦截其他路由
userRoutes.get('/', validateQuery(userListQuerySchema), userController.getUsers)

// 更新用户信息（只能更新自己的或管理员权限）
userRoutes.put('/:id', authMiddleware, validateParams(schemas.id), validateBody(updateUserSchema), requireOwnerOrAdmin('id'), userController.updateUser)

// ====== 管理员权限路由 ======

// 创建用户（管理员权限）
userRoutes.post('/', authMiddleware, requireRoles('admin', 'super_admin'), validateBody(registerSchema), userController.createUser)

// 删除用户（管理员权限）
userRoutes.delete('/:id', authMiddleware, validateParams(schemas.id), adminMiddleware, userController.deleteUser)

// 切换用户状态（管理员权限）
userRoutes.post('/:id/toggle-status', authMiddleware, validateParams(schemas.id), adminMiddleware, userController.toggleStatus)

// 验证用户邮箱（可以验证自己的或管理员权限）
userRoutes.post('/:id/verify-email', authMiddleware, validateParams(schemas.id), requireOwnerOrAdmin('id'), userController.verifyEmail)

// ====== 超级管理员权限路由 ======

// 批量操作用户（超级管理员权限）
userRoutes.post(
  '/batch/update-status',
  authMiddleware,
  requireRoles('super_admin'),
  validateBody({
    type: 'object',
    properties: {
      userIds: {
        type: 'array',
        items: {
          type: 'integer',
          minimum: 1
        },
        minItems: 1,
        maxItems: 100
      },
      status: {
        type: 'string',
        enum: ['active', 'inactive']
      }
    },
    required: ['userIds', 'status'],
    additionalProperties: false
  }),
  async (c) => {
    // 这里可以添加批量更新用户状态的逻辑
    const { userIds, status } = c.get('validatedBody')

    return c.json(
      {
        success: false,
        error: {
          code: 'NOT_IMPLEMENTED',
          message: '批量操作功能尚未实现',
          timestamp: new Date().toISOString()
        }
      },
      501
    )
  }
)

// 批量删除用户（超级管理员权限）
userRoutes.delete(
  '/batch',
  authMiddleware,
  requireRoles('super_admin'),
  validateBody({
    type: 'object',
    properties: {
      userIds: {
        type: 'array',
        items: {
          type: 'integer',
          minimum: 1
        },
        minItems: 1,
        maxItems: 50
      }
    },
    required: ['userIds'],
    additionalProperties: false
  }),
  async (c) => {
    // 这里可以添加批量删除用户的逻辑
    const { userIds } = c.get('validatedBody')

    return c.json(
      {
        success: false,
        error: {
          code: 'NOT_IMPLEMENTED',
          message: '批量删除功能尚未实现',
          timestamp: new Date().toISOString()
        }
      },
      501
    )
  }
)

// ====== 开发和调试路由（仅开发环境） ======

if (process.env.NODE_ENV !== 'production') {
  // 获取所有路由信息（开发环境）
  userRoutes.get('/debug/routes', (c) => {
    return c.json({
      success: true,
      data: {
        public_routes: ['POST /auth/register - 用户注册', 'POST /auth/login - 用户登录', 'POST /auth/refresh - 刷新令牌', 'GET / - 获取用户列表', 'GET /stats - 获取用户统计'],
        authenticated_routes: [
          'POST /auth/logout - 用户登出',
          'GET /me - 获取当前用户信息',
          'GET /:id - 根据ID获取用户',
          'PUT /:id - 更新用户信息（自己或管理员）',
          'POST /:id/verify-email - 验证邮箱（自己或管理员）'
        ],
        admin_routes: ['POST / - 创建用户', 'DELETE /:id - 删除用户', 'POST /:id/toggle-status - 切换用户状态'],
        super_admin_routes: ['POST /batch/update-status - 批量更新状态', 'DELETE /batch - 批量删除用户'],
        debug_routes: ['GET /debug/routes - 获取路由信息（仅开发环境）']
      },
      meta: {
        total_routes: 15,
        environment: 'development',
        timestamp: new Date().toISOString()
      }
    })
  })
}

export default userRoutes
