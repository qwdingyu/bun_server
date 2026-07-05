import { auditLogModel, permissionModel, roleModel, userModel } from '../models/index.js'
import { asyncHandler } from '../middleware/error/index.js'
import AppError from '../utils/AppError.js'
import * as logger from '../utils/logger/index.js'

function getRequestUserId(c) {
  return c.get('user')?.id || null
}

function getRequestMeta(c) {
  return {
    ipAddress: c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown',
    userAgent: c.req.header('user-agent') || 'unknown'
  }
}

async function recordRbacAudit(c, entry) {
  const meta = getRequestMeta(c)
  await auditLogModel.record({
    userId: getRequestUserId(c),
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    ...entry
  })
}

class RbacController {
  /**
   * 查询角色列表。后台脚手架默认只提供轻量管理面，避免每个项目重复实现 RBAC 基础列表。
   */
  getRoles = asyncHandler(async (c) => {
    const page = parseInt(c.req.query('page')) || 1
    const limit = Math.min(parseInt(c.req.query('limit')) || 20, 100)
    const search = c.req.query('search') || null
    const status = c.req.query('status')
    const isSystem = c.req.query('is_system')

    const filter = {}
    if (status) filter.status = status
    if (isSystem !== undefined) filter.is_system = isSystem === 'true' || isSystem === '1' ? 1 : 0

    const result = await roleModel.getRoleList(filter, page, limit, search)
    logger.business('rbac_roles_listed', { user_id: getRequestUserId(c), page, limit })

    return c.json({ success: true, data: result, meta: { timestamp: new Date().toISOString() } })
  })

  /**
   * 查询权限列表，用于后台权限配置页、脚手架验收和前端枚举初始化。
   */
  getPermissions = asyncHandler(async (c) => {
    const page = parseInt(c.req.query('page')) || 1
    const limit = Math.min(parseInt(c.req.query('limit')) || 20, 100)
    const search = c.req.query('search') || null
    const resource = c.req.query('resource')
    const action = c.req.query('action')
    const isSystem = c.req.query('is_system')

    const filter = {}
    if (resource) filter.resource = resource
    if (action) filter.action = action
    if (isSystem !== undefined) filter.is_system = isSystem === 'true' || isSystem === '1' ? 1 : 0

    const result = await permissionModel.getPermissionList(filter, page, limit, search)
    logger.business('rbac_permissions_listed', { user_id: getRequestUserId(c), page, limit })

    return c.json({ success: true, data: result, meta: { timestamp: new Date().toISOString() } })
  })

  /**
   * 查询单个用户当前有效角色，便于后台用户详情页展示授权状态。
   */
  getUserRoles = asyncHandler(async (c) => {
    const userId = Number(c.req.param('userId'))
    await this.ensureUserExists(userId)

    const userRoles = await roleModel.getUserRoles(userId)
    return c.json({ success: true, data: { userId, roles: userRoles }, meta: { timestamp: new Date().toISOString() } })
  })

  /**
   * 给用户分配角色。只暴露脚手架复用最高频的 grant/revoke，不引入复杂审批流。
   */
  assignRoleToUser = asyncHandler(async (c) => {
    const userId = Number(c.req.param('userId'))
    const { roleId, expiresAt = null } = await c.req.json()

    await this.ensureUserExists(userId)
    await this.ensureRoleExists(roleId)

    const assignment = await roleModel.assignRoleToUser(userId, roleId, {
      assignedBy: getRequestUserId(c),
      expiresAt
    })

    logger.business('rbac_user_role_assigned', {
      user_id: getRequestUserId(c),
      target_user_id: userId,
      role_id: roleId
    })
    await recordRbacAudit(c, {
      action: 'rbac.user_role.assign',
      resourceType: 'user_role',
      resourceId: `${userId}:${roleId}`,
      newValues: { userId, roleId, expiresAt }
    })

    return c.json({ success: true, data: assignment, meta: { timestamp: new Date().toISOString() } })
  })

  removeRoleFromUser = asyncHandler(async (c) => {
    const userId = Number(c.req.param('userId'))
    const roleId = Number(c.req.param('roleId'))

    await this.ensureUserExists(userId)
    await this.ensureRoleExists(roleId)
    await roleModel.removeRoleFromUser(userId, roleId)

    logger.business('rbac_user_role_removed', {
      user_id: getRequestUserId(c),
      target_user_id: userId,
      role_id: roleId
    })
    await recordRbacAudit(c, {
      action: 'rbac.user_role.remove',
      resourceType: 'user_role',
      resourceId: `${userId}:${roleId}`,
      oldValues: { userId, roleId, isActive: true },
      newValues: { userId, roleId, isActive: false }
    })

    return c.json({ success: true, data: { userId, roleId, removed: true }, meta: { timestamp: new Date().toISOString() } })
  })

  /**
   * 给角色授予权限，用于维护后台菜单、按钮和接口权限的默认角色集合。
   */
  assignPermissionToRole = asyncHandler(async (c) => {
    const roleId = Number(c.req.param('roleId'))
    const { permissionId } = await c.req.json()

    await this.ensureRoleExists(roleId)
    await this.ensurePermissionExists(permissionId)

    const assignment = await permissionModel.assignPermissionToRole(roleId, permissionId, getRequestUserId(c))
    logger.business('rbac_role_permission_assigned', { user_id: getRequestUserId(c), role_id: roleId, permission_id: permissionId })
    await recordRbacAudit(c, {
      action: 'rbac.role_permission.assign',
      resourceType: 'role_permission',
      resourceId: `${roleId}:${permissionId}`,
      newValues: { roleId, permissionId }
    })

    return c.json({ success: true, data: assignment, meta: { timestamp: new Date().toISOString() } })
  })

  removePermissionFromRole = asyncHandler(async (c) => {
    const roleId = Number(c.req.param('roleId'))
    const permissionId = Number(c.req.param('permissionId'))

    await this.ensureRoleExists(roleId)
    await this.ensurePermissionExists(permissionId)
    await permissionModel.removePermissionFromRole(roleId, permissionId)

    logger.business('rbac_role_permission_removed', { user_id: getRequestUserId(c), role_id: roleId, permission_id: permissionId })
    await recordRbacAudit(c, {
      action: 'rbac.role_permission.remove',
      resourceType: 'role_permission',
      resourceId: `${roleId}:${permissionId}`,
      oldValues: { roleId, permissionId, isActive: true },
      newValues: { roleId, permissionId, isActive: false }
    })

    return c.json({ success: true, data: { roleId, permissionId, removed: true }, meta: { timestamp: new Date().toISOString() } })
  })

  async ensureUserExists(userId) {
    const user = await userModel.findById(userId)
    if (!user) throw new AppError('用户不存在', 404, 'USER_NOT_FOUND')
    return user
  }

  async ensureRoleExists(roleId) {
    const role = await roleModel.findById(roleId)
    if (!role) throw new AppError('角色不存在', 404, 'ROLE_NOT_FOUND')
    return role
  }

  async ensurePermissionExists(permissionId) {
    const permission = await permissionModel.findById(permissionId)
    if (!permission) throw new AppError('权限不存在', 404, 'PERMISSION_NOT_FOUND')
    return permission
  }
}

export const rbacController = new RbacController()
export default rbacController
