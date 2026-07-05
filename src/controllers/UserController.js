import { auditLogModel, permissionModel, sessionModel, userModel } from '../models/index.js'
import { generateTokenPair, verifyToken } from '../utils/jwt/index.js'
import { asyncHandler } from '../middleware/error/index.js'
import { validateBody, validateQuery, validateParams, patterns, schemas } from '../middleware/validation/index.js'
import AppError from '../utils/AppError.js'
import * as logger from '../utils/logger/index.js'
import { buildUserMenuTree } from '../modules/rbac/menu.js'

function getRequestMeta(c) {
  return {
    ipAddress: c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown',
    userAgent: c.req.header('user-agent') || 'unknown'
  }
}

async function recordAudit(c, entry) {
  const user = c.get('user')
  const meta = getRequestMeta(c)
  await auditLogModel.record({
    userId: entry.userId === undefined ? user?.id : entry.userId,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    ...entry
  })
}

class UserController {
  /**
   * 获取用户列表
   */
  getUsers = asyncHandler(async (c) => {
    const startTime = Date.now()

    try {
      const page = parseInt(c.req.query('page')) || 1
      const limit = Math.min(parseInt(c.req.query('limit')) || 20, 100) // 限制最大100
      const status = c.req.query('status')
      const search = c.req.query('search')

      const filter = {}
      if (status && ['active', 'inactive'].includes(status)) {
        filter.status = status
      }

      const result = await userModel.getUserList(filter, page, limit, search)

      const duration = Date.now() - startTime
      logger.performance('getUserList', duration, {
        page,
        limit,
        total: result.pagination.total
      })

      logger.business('user_list_viewed', {
        user_id: c.get('user')?.id,
        filter,
        page,
        limit,
        total: result.pagination.total
      })

      return c.json({
        success: true,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          duration: `${duration}ms`
        }
      })
    } catch (error) {
      logger.error('获取用户列表失败', error)
      throw error
    }
  })

  /**
   * 根据ID获取用户
   */
  getUserById = asyncHandler(async (c) => {
    const startTime = Date.now()

    try {
      const id = parseInt(c.req.param('id'))
      if (isNaN(id) || id <= 0) {
        throw new AppError('用户ID格式不正确', 400, 'INVALID_USER_ID')
      }

      const user = await userModel.findById(id)
      if (!user) {
        throw new AppError('用户不存在', 404, 'USER_NOT_FOUND')
      }

      const duration = Date.now() - startTime
      logger.performance('getUserById', duration, { user_id: id })

      logger.business('user_profile_viewed', {
        viewer_id: c.get('user')?.id,
        target_user_id: id
      })

      return c.json({
        success: true,
        data: user,
        meta: {
          timestamp: new Date().toISOString(),
          duration: `${duration}ms`
        }
      })
    } catch (error) {
      if (!(error instanceof AppError)) {
        logger.error('获取用户失败', error)
      }
      throw error
    }
  })

  /**
   * 创建用户
   */
  createUser = asyncHandler(async (c) => {
    const startTime = Date.now()

    try {
      const body = await c.req.json()

      // 验证必要字段
      const requiredFields = ['username', 'email', 'password']
      for (const field of requiredFields) {
        if (!body[field]) {
          throw new AppError(`字段 ${field} 是必需的`, 400, 'MISSING_REQUIRED_FIELD')
        }
      }

      // 验证邮箱格式
      const emailRegex = new RegExp(patterns.email.pattern)
      if (!emailRegex.test(body.email)) {
        throw new AppError(patterns.email.patternMessage, 400, 'INVALID_EMAIL')
      }

      // 验证用户名格式
      const usernameRegex = new RegExp(patterns.username.pattern)
      if (!usernameRegex.test(body.username)) {
        throw new AppError(patterns.username.patternMessage, 400, 'INVALID_USERNAME')
      }

      const user = await userModel.createUser(body)

      const duration = Date.now() - startTime
      logger.performance('createUser', duration, { user_id: user.id })

      logger.business('user_created', {
        user_id: user.id,
        username: user.username,
        email: user.email,
        created_by: c.get('user')?.id || 'system'
      })

      logger.info('用户创建成功', {
        user_id: user.id,
        username: user.username,
        email: user.email
      })

      return c.json(
        {
          success: true,
          message: '用户创建成功',
          data: user,
          meta: {
            timestamp: new Date().toISOString(),
            duration: `${duration}ms`
          }
        },
        201
      )
    } catch (error) {
      if (!(error instanceof AppError)) {
        logger.error('创建用户失败', error)
      }
      throw error
    }
  })

  /**
   * 更新用户
   */
  updateUser = asyncHandler(async (c) => {
    const startTime = Date.now()

    try {
      const id = parseInt(c.req.param('id'))
      if (isNaN(id) || id <= 0) {
        throw new AppError('用户ID格式不正确', 400, 'INVALID_USER_ID')
      }

      const body = await c.req.json()

      // 检查权限：只能更新自己的信息或管理员权限
      const currentUser = c.get('user')
      const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin'
      const isOwner = currentUser?.id === id

      if (!isOwner && !isAdmin) {
        throw new AppError('权限不足', 403, 'FORBIDDEN')
      }

      const user = await userModel.updateUser(id, body)

      if (!user) {
        throw new AppError('用户不存在', 404, 'USER_NOT_FOUND')
      }

      const duration = Date.now() - startTime
      logger.performance('updateUser', duration, { user_id: id })

      logger.business('user_updated', {
        user_id: id,
        updated_by: currentUser?.id,
        updated_fields: Object.keys(body)
      })

      logger.info('用户更新成功', {
        user_id: id,
        updated_by: currentUser?.id,
        updated_fields: Object.keys(body)
      })

      await recordAudit(c, {
        action: 'users.update',
        resourceType: 'users',
        resourceId: id,
        newValues: { updated_fields: Object.keys(body) }
      })

      return c.json({
        success: true,
        message: '用户更新成功',
        data: user,
        meta: {
          timestamp: new Date().toISOString(),
          duration: `${duration}ms`
        }
      })
    } catch (error) {
      if (!(error instanceof AppError)) {
        logger.error('更新用户失败', error)
      }
      throw error
    }
  })

  /**
   * 删除用户
   */
  deleteUser = asyncHandler(async (c) => {
    const startTime = Date.now()

    try {
      const id = parseInt(c.req.param('id'))
      if (isNaN(id) || id <= 0) {
        throw new AppError('用户ID格式不正确', 400, 'INVALID_USER_ID')
      }

      // 检查管理员权限
      const currentUser = c.get('user')
      const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin'

      if (!isAdmin) {
        throw new AppError('需要管理员权限', 403, 'ADMIN_REQUIRED')
      }

      // 防止删除自己
      if (currentUser?.id === id) {
        throw new AppError('不能删除自己的账户', 400, 'CANNOT_DELETE_SELF')
      }

      await userModel.softDeleteUser(id)

      const duration = Date.now() - startTime
      logger.performance('deleteUser', duration, { user_id: id })

      logger.business('user_deleted', {
        user_id: id,
        deleted_by: currentUser?.id
      })

      logger.warn('用户被删除', {
        user_id: id,
        deleted_by: currentUser?.id
      })

      await recordAudit(c, {
        action: 'users.delete',
        resourceType: 'users',
        resourceId: id
      })

      return c.json({
        success: true,
        message: '用户删除成功',
        meta: {
          timestamp: new Date().toISOString(),
          duration: `${duration}ms`
        }
      })
    } catch (error) {
      if (!(error instanceof AppError)) {
        logger.error('删除用户失败', error)
      }
      throw error
    }
  })

  /**
   * 切换用户状态
   */
  toggleStatus = asyncHandler(async (c) => {
    const startTime = Date.now()

    try {
      const id = parseInt(c.req.param('id'))
      if (isNaN(id) || id <= 0) {
        throw new AppError('用户ID格式不正确', 400, 'INVALID_USER_ID')
      }

      // 检查管理员权限
      const currentUser = c.get('user')
      const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin'

      if (!isAdmin) {
        throw new AppError('需要管理员权限', 403, 'ADMIN_REQUIRED')
      }

      // 防止操作自己
      if (currentUser?.id === id) {
        throw new AppError('不能修改自己的状态', 400, 'CANNOT_MODIFY_SELF')
      }

      const user = await userModel.toggleStatus(id)

      const duration = Date.now() - startTime
      logger.performance('toggleUserStatus', duration, { user_id: id })

      logger.business('user_status_changed', {
        user_id: id,
        new_status: user.status,
        changed_by: currentUser?.id
      })

      logger.info(`用户状态已${user.status === 'active' ? '激活' : '禁用'}`, {
        user_id: id,
        new_status: user.status,
        changed_by: currentUser?.id
      })

      await recordAudit(c, {
        action: 'users.toggle_status',
        resourceType: 'users',
        resourceId: id,
        newValues: { status: user.status }
      })

      return c.json({
        success: true,
        message: `用户状态已${user.status === 'active' ? '激活' : '禁用'}`,
        data: user,
        meta: {
          timestamp: new Date().toISOString(),
          duration: `${duration}ms`
        }
      })
    } catch (error) {
      if (!(error instanceof AppError)) {
        logger.error('切换用户状态失败', error)
      }
      throw error
    }
  })

  /**
   * 验证邮箱
   */
  verifyEmail = asyncHandler(async (c) => {
    const startTime = Date.now()

    try {
      const id = parseInt(c.req.param('id'))
      if (isNaN(id) || id <= 0) {
        throw new AppError('用户ID格式不正确', 400, 'INVALID_USER_ID')
      }

      // 检查权限：只能验证自己的邮箱或管理员权限
      const currentUser = c.get('user')
      const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin'
      const isOwner = currentUser?.id === id

      if (!isOwner && !isAdmin) {
        throw new AppError('权限不足', 403, 'FORBIDDEN')
      }

      const user = await userModel.verifyEmail(id)

      const duration = Date.now() - startTime
      logger.performance('verifyEmail', duration, { user_id: id })

      logger.business('email_verified', {
        user_id: id,
        verified_by: currentUser?.id
      })

      logger.info('邮箱验证成功', {
        user_id: id,
        verified_by: currentUser?.id
      })

      return c.json({
        success: true,
        message: '邮箱验证成功',
        data: user,
        meta: {
          timestamp: new Date().toISOString(),
          duration: `${duration}ms`
        }
      })
    } catch (error) {
      if (!(error instanceof AppError)) {
        logger.error('验证邮箱失败', error)
      }
      throw error
    }
  })

  /**
   * 用户登录
   */
  login = asyncHandler(async (c) => {
    const startTime = Date.now()
    const clientIp = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
    const userAgent = c.req.header('user-agent') || 'unknown'
    let body = {}

    try {
      body = await c.req.json()
      const { identifier, password } = body

      if (!identifier || !password) {
        throw new AppError('用户名/邮箱和密码是必需的', 400, 'MISSING_CREDENTIALS')
      }

      const user = await userModel.authenticate(identifier, password)

      // 生成JWT token对
      const tokenPair = generateTokenPair(user)
      await sessionModel.createSession({
        userId: user.id,
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresAt: tokenPair.refreshTokenExpiresAt,
        userAgent,
        ipAddress: clientIp
      })

      const duration = Date.now() - startTime
      logger.performance('userLogin', duration, { user_id: user.id })

      logger.auth('login', user.id, true, {
        client_ip: clientIp,
        user_agent: userAgent,
        login_method: 'password'
      })

      logger.business('user_logged_in', {
        user_id: user.id,
        username: user.username,
        client_ip: clientIp,
        user_agent: userAgent
      })

      return c.json({
        success: true,
        message: '登录成功',
        data: {
          user,
          ...tokenPair
        },
        meta: {
          timestamp: new Date().toISOString(),
          duration: `${duration}ms`
        }
      })
    } catch (error) {
      const duration = Date.now() - startTime

      // 记录失败的登录尝试
      logger.auth('login', null, false, {
        identifier: body?.identifier,
        client_ip: clientIp,
        user_agent: userAgent,
        error: error.message,
        duration
      })

      logger.security('failed_login_attempt', 'medium', {
        identifier: body?.identifier,
        client_ip: clientIp,
        user_agent: userAgent,
        error: error.message
      })

      if (!(error instanceof AppError)) {
        logger.error('用户登录失败', error)
      }
      throw error
    }
  })

  /**
   * 刷新token
   */
  refreshToken = asyncHandler(async (c) => {
    const startTime = Date.now()

    try {
      const body = await c.req.json()
      const { refreshToken } = body

      if (!refreshToken) {
        throw new AppError('刷新令牌是必需的', 400, 'MISSING_REFRESH_TOKEN')
      }

      const tokenResult = verifyToken(refreshToken)
      if (!tokenResult.success) {
        throw new AppError('刷新令牌无效或已过期', 401, 'INVALID_REFRESH_TOKEN')
      }

      const session = await sessionModel.findActiveByRefreshToken(refreshToken)
      if (!session) {
        throw new AppError('刷新令牌已失效或会话已登出', 401, 'REFRESH_SESSION_REVOKED')
      }

      const user = await userModel.findById(tokenResult.payload.id)

      if (!user || user.status !== 'active' || session.user_id !== user.id) {
        throw new AppError('用户不存在或已被禁用', 401, 'USER_INVALID')
      }

      const newTokenPair = generateTokenPair(user)
      await sessionModel.rotateRefreshToken(session.id, {
        accessToken: newTokenPair.accessToken,
        refreshToken: newTokenPair.refreshToken,
        expiresAt: newTokenPair.refreshTokenExpiresAt
      })

      const duration = Date.now() - startTime
      logger.performance('refreshToken', duration, { user_id: user.id })

      logger.auth('token_refresh', user.id, true)

      return c.json({
        success: true,
        message: '令牌刷新成功',
        data: newTokenPair,
        meta: {
          timestamp: new Date().toISOString(),
          duration: `${duration}ms`
        }
      })
    } catch (error) {
      logger.auth('token_refresh', null, false, {
        error: error.message
      })

      if (!(error instanceof AppError)) {
        logger.error('刷新令牌失败', error)
      }
      throw error
    }
  })

  /**
   * 用户注册
   */
  register = asyncHandler(async (c) => {
    const startTime = Date.now()
    const clientIp = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
    const userAgent = c.req.header('user-agent') || 'unknown'
    let body = {}

    try {
      body = await c.req.json()

      // 验证必要字段
      const requiredFields = ['username', 'email', 'password']
      for (const field of requiredFields) {
        if (!body[field]) {
          throw new AppError(`字段 ${field} 是必需的`, 400, 'MISSING_REQUIRED_FIELD')
        }
      }

      // 验证邮箱格式
      const emailRegex = new RegExp(patterns.email.pattern)
      if (!emailRegex.test(body.email)) {
        throw new AppError(patterns.email.patternMessage, 400, 'INVALID_EMAIL')
      }

      // 验证用户名格式
      const usernameRegex = new RegExp(patterns.username.pattern)
      if (!usernameRegex.test(body.username)) {
        throw new AppError(patterns.username.patternMessage, 400, 'INVALID_USERNAME')
      }

      const user = await userModel.createUser(body)

      // 生成JWT token对
      const tokenPair = generateTokenPair(user)
      await sessionModel.createSession({
        userId: user.id,
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresAt: tokenPair.refreshTokenExpiresAt,
        userAgent,
        ipAddress: clientIp
      })

      const duration = Date.now() - startTime
      logger.performance('userRegister', duration, { user_id: user.id })

      logger.business('user_registered', {
        user_id: user.id,
        username: user.username,
        email: user.email,
        client_ip: clientIp,
        user_agent: userAgent
      })

      logger.info('用户注册成功', {
        user_id: user.id,
        username: user.username,
        email: user.email,
        client_ip: clientIp
      })

      return c.json(
        {
          success: true,
          message: '注册成功',
          data: {
            user,
            ...tokenPair
          },
          meta: {
            timestamp: new Date().toISOString(),
            duration: `${duration}ms`
          }
        },
        201
      )
    } catch (error) {
      logger.security('failed_registration_attempt', 'low', {
        username: body?.username,
        email: body?.email,
        client_ip: clientIp,
        user_agent: userAgent,
        error: error.message
      })

      if (!(error instanceof AppError)) {
        logger.error('用户注册失败', error)
      }
      throw error
    }
  })

  /**
   * 用户登出
   */
  logout = asyncHandler(async (c) => {
    const startTime = Date.now()

    try {
      const user = c.get('user')
      let refreshToken = null

      try {
        const body = await c.req.json()
        refreshToken = body?.refreshToken || null
      } catch (_) {
        refreshToken = null
      }

      if (refreshToken) {
        await sessionModel.revokeByRefreshToken(refreshToken)
      }

      const duration = Date.now() - startTime
      logger.performance('userLogout', duration, { user_id: user?.id })

      logger.auth('logout', user?.id, true)

      logger.business('user_logged_out', {
        user_id: user?.id,
        username: user?.username
      })

      return c.json({
        success: true,
        message: '登出成功',
        meta: {
          timestamp: new Date().toISOString(),
          duration: `${duration}ms`
        }
      })
    } catch (error) {
      if (!(error instanceof AppError)) {
        logger.error('用户登出失败', error)
      }
      throw error
    }
  })

  /**
   * 获取当前用户信息
   */
  getCurrentUser = asyncHandler(async (c) => {
    const startTime = Date.now()

    try {
      const user = c.get('user')

      if (!user) {
        throw new AppError('用户未认证', 401, 'UNAUTHENTICATED')
      }

      // 从数据库获取最新用户信息
      const currentUser = await userModel.findById(user.id)

      if (!currentUser) {
        throw new AppError('用户不存在', 404, 'USER_NOT_FOUND')
      }

      const duration = Date.now() - startTime
      logger.performance('getCurrentUser', duration, { user_id: user.id })

      return c.json({
        success: true,
        data: currentUser,
        meta: {
          timestamp: new Date().toISOString(),
          duration: `${duration}ms`
        }
      })
    } catch (error) {
      if (!(error instanceof AppError)) {
        logger.error('获取当前用户信息失败', error)
      }
      throw error
    }
  })

  /**
   * 获取用户统计
   */
  getUserStats = asyncHandler(async (c) => {
    const startTime = Date.now()

    try {
      const stats = await userModel.getUserStats()

      const duration = Date.now() - startTime
      logger.performance('getUserStats', duration)

      return c.json({
        success: true,
        data: stats,
        meta: {
          timestamp: new Date().toISOString(),
          duration: `${duration}ms`
        }
      })
    } catch (error) {
      logger.error('获取用户统计失败', error)
      throw error
    }
  })

  /**
   * 批量更新用户状态
   */
  batchUpdateStatus = asyncHandler(async (c) => {
    const startTime = Date.now()

    try {
      const { userIds, status } = c.get('validatedBody')
      const currentUser = c.get('user')

      if (userIds.includes(currentUser?.id)) {
        throw new AppError('不能批量修改自己的状态', 400, 'CANNOT_MODIFY_SELF')
      }

      const result = await userModel.batchUpdateStatus(userIds, status)
      const duration = Date.now() - startTime

      logger.performance('batchUpdateUserStatus', duration, {
        requested: userIds.length,
        affected: result.affected
      })

      logger.business('users_status_batch_updated', {
        requested_ids: userIds,
        affected_ids: result.ids,
        status,
        changed_by: currentUser?.id
      })

      await recordAudit(c, {
        action: 'users.batch_update_status',
        resourceType: 'users',
        resourceId: result.ids.join(','),
        newValues: { requested_ids: userIds, affected_ids: result.ids, status }
      })

      return c.json({
        success: true,
        message: '批量更新用户状态成功',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          duration: `${duration}ms`
        }
      })
    } catch (error) {
      if (!(error instanceof AppError)) {
        logger.error('批量更新用户状态失败', error)
      }
      throw error
    }
  })

  /**
   * 批量软删除用户
   */
  batchDeleteUsers = asyncHandler(async (c) => {
    const startTime = Date.now()

    try {
      const { userIds } = c.get('validatedBody')
      const currentUser = c.get('user')

      if (userIds.includes(currentUser?.id)) {
        throw new AppError('不能批量删除自己的账户', 400, 'CANNOT_DELETE_SELF')
      }

      const result = await userModel.batchSoftDeleteUsers(userIds)
      const duration = Date.now() - startTime

      logger.performance('batchDeleteUsers', duration, {
        requested: userIds.length,
        affected: result.affected
      })

      logger.business('users_batch_deleted', {
        requested_ids: userIds,
        affected_ids: result.ids,
        deleted_by: currentUser?.id
      })

      await recordAudit(c, {
        action: 'users.batch_delete',
        resourceType: 'users',
        resourceId: result.ids.join(','),
        newValues: { requested_ids: userIds, affected_ids: result.ids }
      })

      return c.json({
        success: true,
        message: '批量删除用户成功',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          duration: `${duration}ms`
        }
      })
    } catch (error) {
      if (!(error instanceof AppError)) {
        logger.error('批量删除用户失败', error)
      }
      throw error
    }
  })

  /**
   * 获取当前用户有效权限
   */
  getCurrentUserPermissions = asyncHandler(async (c) => {
    const startTime = Date.now()

    try {
      const user = c.get('user')
      if (!user) {
        throw new AppError('用户未认证', 401, 'UNAUTHENTICATED')
      }

      const permissions = await permissionModel.getUserPermissions(user.id)
      const permissionNames = permissions.map((permission) => permission.name)
      const duration = Date.now() - startTime

      logger.performance('getCurrentUserPermissions', duration, { user_id: user.id })

      return c.json({
        success: true,
        data: {
          permissions,
          permissionNames
        },
        meta: {
          timestamp: new Date().toISOString(),
          duration: `${duration}ms`
        }
      })
    } catch (error) {
      if (!(error instanceof AppError)) {
        logger.error('获取当前用户权限失败', error)
      }
      throw error
    }
  })

  /**
   * 获取当前用户菜单和按钮权限
   */
  getCurrentUserMenus = asyncHandler(async (c) => {
    const startTime = Date.now()

    try {
      const user = c.get('user')
      if (!user) {
        throw new AppError('用户未认证', 401, 'UNAUTHENTICATED')
      }

      const permissions = await permissionModel.getUserPermissions(user.id)
      const permissionNames = permissions.map((permission) => permission.name)
      const menus = buildUserMenuTree(permissionNames)
      const duration = Date.now() - startTime

      logger.performance('getCurrentUserMenus', duration, { user_id: user.id })

      return c.json({
        success: true,
        data: {
          menus,
          permissionNames
        },
        meta: {
          timestamp: new Date().toISOString(),
          duration: `${duration}ms`
        }
      })
    } catch (error) {
      if (!(error instanceof AppError)) {
        logger.error('获取当前用户菜单失败', error)
      }
      throw error
    }
  })
}

// 创建实例并导出
const userController = new UserController()

export { userController }
export default userController
