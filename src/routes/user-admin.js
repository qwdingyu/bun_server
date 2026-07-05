import { Hono } from 'hono'
import { userController } from '../controllers/UserController.js'
import { authMiddleware, adminMiddleware, requireOwnerOrAdmin, requireRoles } from '../middleware/auth.js'
import { validateBody, validateQuery, validateParams, schemas } from '../middleware/validation/index.js'
import { batchDeleteUsersSchema, batchUpdateStatusSchema, registerSchema, updateUserSchema, userListQuerySchema } from './user-schemas.js'

const userAdminRoutes = new Hono()

// 获取用户统计信息（当前仍保持公开契约；生产项目可按需加 users:list 权限）
userAdminRoutes.get('/stats', userController.getUserStats)

// 当前用户信息与前端门禁初始化接口，必须位于 /:id 之前。
userAdminRoutes.get('/me', authMiddleware, userController.getCurrentUser)
userAdminRoutes.get('/me/permissions', authMiddleware, userController.getCurrentUserPermissions)
userAdminRoutes.get('/me/menus', authMiddleware, userController.getCurrentUserMenus)

// 批量操作必须位于 /:id 之前，避免被动态参数路由抢匹配。
userAdminRoutes.post('/batch/update-status', authMiddleware, requireRoles('super_admin'), validateBody(batchUpdateStatusSchema), userController.batchUpdateStatus)
userAdminRoutes.delete('/batch', authMiddleware, requireRoles('super_admin'), validateBody(batchDeleteUsersSchema), userController.batchDeleteUsers)

userAdminRoutes.get('/:id', authMiddleware, validateParams(schemas.id), userController.getUserById)
userAdminRoutes.get('/', validateQuery(userListQuerySchema), userController.getUsers)
userAdminRoutes.put('/:id', authMiddleware, validateParams(schemas.id), validateBody(updateUserSchema), requireOwnerOrAdmin('id'), userController.updateUser)
userAdminRoutes.delete('/:id', authMiddleware, validateParams(schemas.id), adminMiddleware, userController.deleteUser)
userAdminRoutes.post('/:id/toggle-status', authMiddleware, validateParams(schemas.id), adminMiddleware, userController.toggleStatus)
userAdminRoutes.post('/:id/verify-email', authMiddleware, validateParams(schemas.id), requireOwnerOrAdmin('id'), userController.verifyEmail)
userAdminRoutes.post('/', authMiddleware, adminMiddleware, validateBody(registerSchema), userController.createUser)

export default userAdminRoutes
