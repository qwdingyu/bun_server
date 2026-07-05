import { Hono } from 'hono'
import { rbacController } from '../controllers/RbacController.js'
import { authMiddleware, requireRoles } from '../middleware/auth.js'
import { validateBody, validateParams, validateQuery, schemas } from '../middleware/validation/index.js'
import { assignPermissionSchema, assignRoleSchema, rbacListQuerySchema } from './rbac-schemas.js'

const rbacRoutes = new Hono()

const idField = schemas.id.properties.id
const userIdParamsSchema = {
  type: 'object',
  properties: { userId: idField },
  required: ['userId'],
  additionalProperties: false
}
const userRoleParamsSchema = {
  type: 'object',
  properties: { userId: idField, roleId: idField },
  required: ['userId', 'roleId'],
  additionalProperties: false
}
const roleIdParamsSchema = {
  type: 'object',
  properties: { roleId: idField },
  required: ['roleId'],
  additionalProperties: false
}
const rolePermissionParamsSchema = {
  type: 'object',
  properties: { roleId: idField, permissionId: idField },
  required: ['roleId', 'permissionId'],
  additionalProperties: false
}

// RBAC 管理路由只开放给超级管理员，保持脚手架轻量但可直接落地后台权限页。
rbacRoutes.use('*', authMiddleware, requireRoles('super_admin'))

rbacRoutes.get('/roles', validateQuery(rbacListQuerySchema), rbacController.getRoles)
rbacRoutes.get('/permissions', validateQuery(rbacListQuerySchema), rbacController.getPermissions)
rbacRoutes.get('/users/:userId/roles', validateParams(userIdParamsSchema), rbacController.getUserRoles)
rbacRoutes.post('/users/:userId/roles', validateParams(userIdParamsSchema), validateBody(assignRoleSchema), rbacController.assignRoleToUser)
rbacRoutes.delete('/users/:userId/roles/:roleId', validateParams(userRoleParamsSchema), rbacController.removeRoleFromUser)
rbacRoutes.post('/roles/:roleId/permissions', validateParams(roleIdParamsSchema), validateBody(assignPermissionSchema), rbacController.assignPermissionToRole)
rbacRoutes.delete('/roles/:roleId/permissions/:permissionId', validateParams(rolePermissionParamsSchema), rbacController.removePermissionFromRole)

export default rbacRoutes
