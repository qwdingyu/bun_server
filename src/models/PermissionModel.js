import BaseModel from './BaseModel.js'
import { permissions, role_permissions, roles, user_permissions, user_roles } from '../models/schema/index.js'
import { eq, and, isNull, or, sql, desc, asc } from 'drizzle-orm'
import { getDrizzleInstance } from '../config/database.js'
import AppError from '../utils/AppError.js'

class PermissionModel extends BaseModel {
  constructor() {
    super('permissions', permissions)
    this.searchableFields = ['name', 'display_name', 'description', 'resource', 'action']
    this.safeFields = ['id', 'name', 'display_name', 'description', 'resource', 'action', 'is_system', 'created_at', 'updated_at']
    this.safeOrderFields = ['id', 'name', 'resource', 'action', 'created_at', 'updated_at']
  }

  /**
   * 创建前的验证和数据处理
   */
  async beforeCreate(data) {
    // 验证权限名称
    if (!data.name || data.name.trim() === '') {
      throw new AppError('权限名称不能为空', 400)
    }

    // 验证权限显示名称
    if (!data.display_name || data.display_name.trim() === '') {
      throw new AppError('权限显示名称不能为空', 400)
    }

    // 验证资源和操作
    if (!data.resource || data.resource.trim() === '') {
      throw new AppError('资源名称不能为空', 400)
    }

    if (!data.action || data.action.trim() === '') {
      throw new AppError('操作名称不能为空', 400)
    }

    // 检查权限名称唯一性
    const isNameUnique = await this.isUnique('name', data.name)
    if (!isNameUnique) {
      throw new AppError('权限名称已存在', 409)
    }

    // 设置默认值
    if (data.is_system === undefined) {
      data.is_system = 0
    }

    return data
  }

  /**
   * 更新前的验证和数据处理
   */
  async beforeUpdate(data) {
    // 验证权限名称（如果被更新）
    if (data.name) {
      if (data.name.trim() === '') {
        throw new AppError('权限名称不能为空', 400)
      }

      // 检查权限名称唯一性
      const existingPermission = await this.findOne({ name: data.name })
      if (existingPermission && existingPermission.id !== data.id) {
        throw new AppError('权限名称已存在', 409)
      }
    }

    // 验证资源和操作（如果被更新）
    if (data.resource && data.resource.trim() === '') {
      throw new AppError('资源名称不能为空', 400)
    }

    if (data.action && data.action.trim() === '') {
      throw new AppError('操作名称不能为空', 400)
    }

    // 验证权限显示名称（如果被更新）
    if (data.display_name && data.display_name.trim() === '') {
      throw new AppError('权限显示名称不能为空', 400)
    }

    return data
  }

  /**
   * 获取用户的所有权限
   * @param {number} userId - 用户ID
   * @returns {Promise<Array>} - 权限数组，包含直接权限和通过角色获得的权限
   */
  async getUserPermissions(userId) {
    try {
      const db = getDrizzleInstance()

      // 获取用户通过角色获得的权限
      const rolePermissionsQuery = db
        .select({
          id: permissions.id,
          name: permissions.name,
          display_name: permissions.display_name,
          resource: permissions.resource,
          action: permissions.action,
          source: sql`'role'`.as('source'),
          permission_type: sql`'grant'`.as('permission_type')
        })
        .from(permissions)
        .innerJoin(role_permissions, eq(role_permissions.permission_id, permissions.id))
        .innerJoin(
          user_roles,
          and(
            eq(user_roles.role_id, role_permissions.role_id),
            eq(user_roles.user_id, userId),
            eq(user_roles.is_active, 1),
            or(isNull(user_roles.expires_at), sql`${user_roles.expires_at} > strftime('%s','now')`)
          )
        )
        .innerJoin(roles, and(eq(roles.id, user_roles.role_id), eq(roles.status, 'active')))
        .where(and(eq(role_permissions.is_active, 1)))

      // 获取用户直接被授予的权限
      const directPermissionsQuery = db
        .select({
          id: permissions.id,
          name: permissions.name,
          display_name: permissions.display_name,
          resource: permissions.resource,
          action: permissions.action,
          source: sql`'direct'`.as('source'),
          permission_type: user_permissions.permission_type
        })
        .from(permissions)
        .innerJoin(user_permissions, eq(user_permissions.permission_id, permissions.id))
        .where(
          and(
            eq(user_permissions.user_id, userId),
            eq(user_permissions.is_active, 1),
            or(isNull(user_permissions.expires_at), sql`${user_permissions.expires_at} > strftime('%s','now')`)
          )
        )

      // 合并查询结果
      const [rolePermissions, directPermissions] = await Promise.all([rolePermissionsQuery, directPermissionsQuery])

      // 创建权限映射，优先使用直接权限
      const permissionsMap = new Map()

      // 先添加角色权限
      for (const perm of rolePermissions) {
        permissionsMap.set(perm.name, perm)
      }

      // 然后添加直接权限（会覆盖角色权限）
      for (const perm of directPermissions) {
        permissionsMap.set(perm.name, perm)
      }

      // 过滤出有效权限（只保留授权的，移除拒绝的）
      const effectivePermissions = Array.from(permissionsMap.values()).filter((perm) => perm.permission_type === 'grant')

      return effectivePermissions
    } catch (error) {
      console.error('获取用户权限失败:', error)
      throw error
    }
  }

  /**
   * 检查用户是否拥有特定权限
   * @param {number} userId - 用户ID
   * @param {string|Array} permNames - 权限名称或权限名称数组
   * @returns {Promise<boolean>} - 是否拥有权限
   */
  async hasPermission(userId, permNames) {
    try {
      const permNamesArray = Array.isArray(permNames) ? permNames : [permNames]
      const db = getDrizzleInstance()

      const directPermissions = await db
        .select({ name: permissions.name, permission_type: user_permissions.permission_type })
        .from(permissions)
        .innerJoin(user_permissions, eq(user_permissions.permission_id, permissions.id))
        .where(
          and(
            eq(user_permissions.user_id, userId),
            eq(user_permissions.is_active, 1),
            or(isNull(user_permissions.expires_at), sql`${user_permissions.expires_at} > strftime('%s','now')`)
          )
        )

      const directMatches = directPermissions.filter((permission) => permNamesArray.includes(permission.name))

      // 后台权限的安全默认规则：显式 deny 优先级最高，能覆盖用户直授 grant 与角色继承权限。
      if (directMatches.some((permission) => permission.permission_type === 'deny')) {
        return false
      }

      if (directMatches.some((permission) => permission.permission_type === 'grant')) {
        return true
      }

      const rolePermissions = await db
        .select({ name: permissions.name })
        .from(permissions)
        .innerJoin(role_permissions, eq(role_permissions.permission_id, permissions.id))
        .innerJoin(
          user_roles,
          and(
            eq(user_roles.role_id, role_permissions.role_id),
            eq(user_roles.user_id, userId),
            eq(user_roles.is_active, 1),
            or(isNull(user_roles.expires_at), sql`${user_roles.expires_at} > strftime('%s','now')`)
          )
        )
        .innerJoin(roles, and(eq(roles.id, user_roles.role_id), eq(roles.status, 'active')))
        .where(and(eq(role_permissions.is_active, 1)))

      return rolePermissions.some((permission) => permNamesArray.includes(permission.name))
    } catch (error) {
      console.error('检查用户权限失败:', error)
      throw error
    }
  }

  /**
   * 为用户授予或拒绝权限
   * @param {number} userId - 用户ID
   * @param {number} permissionId - 权限ID
   * @param {string} permissionType - 权限类型：'grant'或'deny'
   * @param {Object} options - 选项
   * @returns {Promise<Object>} - 创建的用户权限记录
   */
  async setUserPermission(userId, permissionId, permissionType, options = {}) {
    try {
      const { grantedBy = null, expiresAt = null, reason = null } = options

      if (!['grant', 'deny'].includes(permissionType)) {
        throw new AppError('权限类型必须是 grant 或 deny', 400)
      }

      const db = getDrizzleInstance()

      // 检查用户是否已有此权限记录
      const existingUserPerm = await db
        .select()
        .from(user_permissions)
        .where(and(eq(user_permissions.user_id, userId), eq(user_permissions.permission_id, permissionId)))
        .limit(1)

      if (existingUserPerm.length > 0) {
        // 如果已存在，更新记录
        const result = await db
          .update(user_permissions)
          .set({
            permission_type: permissionType,
            expires_at: expiresAt,
            granted_by: grantedBy,
            granted_at: Math.floor(Date.now() / 1000),
            reason: reason,
            is_active: 1
          })
          .where(eq(user_permissions.id, existingUserPerm[0].id))
          .returning()

        return result[0]
      } else {
        // 创建新记录
        const result = await db
          .insert(user_permissions)
          .values({
            user_id: userId,
            permission_id: permissionId,
            permission_type: permissionType,
            granted_by: grantedBy,
            expires_at: expiresAt,
            reason: reason,
            is_active: 1
          })
          .returning()

        return result[0]
      }
    } catch (error) {
      console.error('设置用户权限失败:', error)
      throw error
    }
  }

  /**
   * 移除用户权限
   * @param {number} userId - 用户ID
   * @param {number} permissionId - 权限ID
   * @returns {Promise<boolean>} - 是否成功移除
   */
  async removeUserPermission(userId, permissionId) {
    try {
      const db = getDrizzleInstance()

      // 更新用户权限状态为非活跃
      await db
        .update(user_permissions)
        .set({ is_active: 0 })
        .where(and(eq(user_permissions.user_id, userId), eq(user_permissions.permission_id, permissionId)))

      return true
    } catch (error) {
      console.error('移除用户权限失败:', error)
      throw error
    }
  }

  /**
   * 为角色授予权限
   * @param {number} roleId - 角色ID
   * @param {number} permissionId - 权限ID
   * @param {number} grantedBy - 授权者ID
   * @returns {Promise<Object>} - 创建的角色权限记录
   */
  async assignPermissionToRole(roleId, permissionId, grantedBy = null) {
    try {
      const db = getDrizzleInstance()

      // 检查角色是否已有此权限
      const existingRolePerm = await db
        .select()
        .from(role_permissions)
        .where(and(eq(role_permissions.role_id, roleId), eq(role_permissions.permission_id, permissionId)))
        .limit(1)

      if (existingRolePerm.length > 0) {
        // 如果已存在，更新记录
        const result = await db
          .update(role_permissions)
          .set({
            granted_by: grantedBy,
            granted_at: Math.floor(Date.now() / 1000),
            is_active: 1
          })
          .where(eq(role_permissions.id, existingRolePerm[0].id))
          .returning()

        return result[0]
      } else {
        // 创建新记录
        const result = await db
          .insert(role_permissions)
          .values({
            role_id: roleId,
            permission_id: permissionId,
            granted_by: grantedBy,
            is_active: 1
          })
          .returning()

        return result[0]
      }
    } catch (error) {
      console.error('为角色授予权限失败:', error)
      throw error
    }
  }

  /**
   * 从角色移除权限
   * @param {number} roleId - 角色ID
   * @param {number} permissionId - 权限ID
   * @returns {Promise<boolean>} - 是否成功移除
   */
  async removePermissionFromRole(roleId, permissionId) {
    try {
      const db = getDrizzleInstance()

      // 更新角色权限状态为非活跃
      await db
        .update(role_permissions)
        .set({ is_active: 0 })
        .where(and(eq(role_permissions.role_id, roleId), eq(role_permissions.permission_id, permissionId)))

      return true
    } catch (error) {
      console.error('从角色移除权限失败:', error)
      throw error
    }
  }

  /**
   * 获取权限列表，支持分页和搜索
   */
  async getPermissionList(filter = {}, page = 1, limit = 20, search = null) {
    try {
      const offset = (page - 1) * limit
      let queryFilter = { ...filter }
      let permissions, total

      const db = getDrizzleInstance()

      if (search && search.trim()) {
        const searchTerm = `%${search.trim()}%`

        // 构建搜索条件
        const searchCondition = or(
          sql`${this.schema.name} LIKE ${searchTerm}`,
          sql`${this.schema.display_name} LIKE ${searchTerm}`,
          sql`${this.schema.description} LIKE ${searchTerm}`,
          sql`${this.schema.resource} LIKE ${searchTerm}`,
          sql`${this.schema.action} LIKE ${searchTerm}`
        )

        // 添加其他过滤条件
        let whereClause = searchCondition
        if (filter.resource) {
          whereClause = and(whereClause, eq(this.schema.resource, filter.resource))
        }
        if (filter.action) {
          whereClause = and(whereClause, eq(this.schema.action, filter.action))
        }
        if (filter.is_system !== undefined) {
          whereClause = and(whereClause, eq(this.schema.is_system, filter.is_system))
        }

        // 获取搜索结果总数
        const countResult = await db
          .select({
            count: sql`count(*)`.mapWith(Number)
          })
          .from(this.schema)
          .where(whereClause)

        total = countResult[0]?.count || 0

        // 获取搜索结果数据
        const selectedFields = this.getSelectFields(this.safeFields)
        permissions = await db.select(selectedFields).from(this.schema).where(whereClause).orderBy(asc(this.schema.resource), asc(this.schema.action)).limit(limit).offset(offset)
      } else {
        // 普通查询
        total = await this.count(queryFilter)
        permissions = await this.findPage(queryFilter, {
          page,
          limit,
          orderBy: 'resource',
          order: 'asc',
          secondaryOrderBy: 'action',
          secondaryOrder: 'asc',
          fields: this.safeFields
        })
      }

      return {
        permissions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        search: search || null
      }
    } catch (error) {
      console.error('获取权限列表失败:', error)
      throw error
    }
  }
}

export default PermissionModel
