import BaseModel from './BaseModel.js'
import { roles, user_roles } from '../models/schema/index.js'
import { eq, and, isNull, or, sql, desc, asc, inArray } from 'drizzle-orm'
import { getDrizzleInstance } from '../config/database.js'
import { getCurrentTimestamp } from '../utils/datetime.js'
import AppError from '../utils/AppError.js'

class RoleModel extends BaseModel {
  constructor() {
    super('roles', roles)
    this.searchableFields = ['name', 'display_name', 'description']
    this.safeFields = ['id', 'name', 'display_name', 'description', 'level', 'is_system', 'status', 'created_at', 'updated_at']
    this.safeOrderFields = ['id', 'name', 'level', 'created_at', 'updated_at']
  }

  /**
   * 创建前的验证和数据处理
   */
  async beforeCreate(data) {
    // 验证角色名称
    if (!data.name || data.name.trim() === '') {
      throw new AppError('角色名称不能为空', 400)
    }

    // 验证角色显示名称
    if (!data.display_name || data.display_name.trim() === '') {
      throw new AppError('角色显示名称不能为空', 400)
    }

    // 检查角色名称唯一性
    const isNameUnique = await this.isUnique('name', data.name)
    if (!isNameUnique) {
      throw new AppError('角色名称已存在', 409)
    }

    // 设置默认值
    if (!data.status) {
      data.status = 'active'
    }

    if (data.level === undefined) {
      data.level = 1
    }

    if (data.is_system === undefined) {
      data.is_system = 0
    }

    return data
  }

  /**
   * 更新前的验证和数据处理
   */
  async beforeUpdate(data) {
    // 验证角色名称（如果被更新）
    if (data.name) {
      if (data.name.trim() === '') {
        throw new AppError('角色名称不能为空', 400)
      }

      // 检查角色名称唯一性
      const existingRole = await this.findOne({ name: data.name })
      if (existingRole && existingRole.id !== data.id) {
        throw new AppError('角色名称已存在', 409)
      }
    }

    // 验证角色显示名称（如果被更新）
    if (data.display_name && data.display_name.trim() === '') {
      throw new AppError('角色显示名称不能为空', 400)
    }

    return data
  }

  /**
   * 获取用户的所有角色
   * @param {number} userId - 用户ID
   * @returns {Promise<Array>} - 角色数组
   */
  async getUserRoles(userId) {
    try {
      const db = getDrizzleInstance()

      // 获取用户的所有有效角色
      const userRolesQuery = db
        .select({
          id: roles.id,
          name: roles.name,
          display_name: roles.display_name,
          description: roles.description,
          level: roles.level,
          is_system: roles.is_system
        })
        .from(roles)
        .innerJoin(
          user_roles,
          and(
            eq(user_roles.role_id, roles.id),
            eq(user_roles.user_id, userId),
            eq(user_roles.is_active, 1),
            or(isNull(user_roles.expires_at), sql`${user_roles.expires_at} > ${getCurrentTimestamp()}`)
          )
        )
        .where(eq(roles.status, 'active'))
        .orderBy(desc(roles.level))

      const userRoles = await userRolesQuery
      return userRoles
    } catch (error) {
      console.error('获取用户角色失败:', error)
      throw error
    }
  }

  /**
   * 检查用户是否具有特定角色
   * @param {number} userId - 用户ID
   * @param {string|Array} roleNames - 角色名称或角色名称数组
   * @returns {Promise<boolean>} - 是否拥有角色
   */
  async hasRole(userId, roleNames) {
    try {
      const db = getDrizzleInstance()
      const roleNamesArray = Array.isArray(roleNames) ? roleNames : [roleNames]

      // 查询用户是否拥有指定角色
      const query = db
        .select({ count: sql`count(*)`.mapWith(Number) })
        .from(roles)
        .innerJoin(
          user_roles,
          and(
            eq(user_roles.role_id, roles.id),
            eq(user_roles.user_id, userId),
            eq(user_roles.is_active, 1),
            or(isNull(user_roles.expires_at), sql`${user_roles.expires_at} > ${getCurrentTimestamp()}`)
          )
        )
        .where(and(eq(roles.status, 'active'), inArray(roles.name, roleNamesArray)))

      const result = await query
      return result[0]?.count > 0
    } catch (error) {
      console.error('检查用户角色失败:', error)
      throw error
    }
  }

  /**
   * 分配角色给用户
   * @param {number} userId - 用户ID
   * @param {number} roleId - 角色ID
   * @param {Object} options - 选项
   * @returns {Promise<Object>} - 创建的用户角色记录
   */
  async assignRoleToUser(userId, roleId, options = {}) {
    try {
      const { assignedBy = null, expiresAt = null } = options

      const db = getDrizzleInstance()

      // 检查用户是否已有此角色。即使旧记录已被停用，也要复用同一行，避免唯一约束冲突。
      const existingUserRole = await db
        .select()
        .from(user_roles)
        .where(and(eq(user_roles.user_id, userId), eq(user_roles.role_id, roleId)))
        .limit(1)

      if (existingUserRole.length > 0) {
        // 如果已存在，更新记录
        const result = await db
          .update(user_roles)
          .set({
            expires_at: expiresAt,
            assigned_by: assignedBy,
            assigned_at: getCurrentTimestamp(),
            is_active: 1
          })
          .where(eq(user_roles.id, existingUserRole[0].id))
          .returning()

        return result[0]
      } else {
        // 创建新记录
        const result = await db
          .insert(user_roles)
          .values({
            user_id: userId,
            role_id: roleId,
            assigned_by: assignedBy,
            expires_at: expiresAt,
            is_active: 1
          })
          .returning()

        return result[0]
      }
    } catch (error) {
      console.error('分配角色给用户失败:', error)
      throw error
    }
  }

  /**
   * 移除用户的角色
   * @param {number} userId - 用户ID
   * @param {number} roleId - 角色ID
   * @returns {Promise<boolean>} - 是否成功移除
   */
  async removeRoleFromUser(userId, roleId) {
    try {
      const db = getDrizzleInstance()

      // 更新用户角色状态为非活跃
      await db
        .update(user_roles)
        .set({ is_active: 0 })
        .where(and(eq(user_roles.user_id, userId), eq(user_roles.role_id, roleId)))

      return true
    } catch (error) {
      console.error('移除用户角色失败:', error)
      throw error
    }
  }

  /**
   * 获取角色列表，支持分页和搜索
   */
  async getRoleList(filter = {}, page = 1, limit = 20, search = null) {
    try {
      const offset = (page - 1) * limit
      let queryFilter = { ...filter }
      let roles, total

      const db = getDrizzleInstance()

      if (search && search.trim()) {
        const searchTerm = `%${search.trim()}%`

        // 构建搜索条件
        const searchCondition = or(
          sql`${this.schema.name} LIKE ${searchTerm}`,
          sql`${this.schema.display_name} LIKE ${searchTerm}`,
          sql`${this.schema.description} LIKE ${searchTerm}`
        )

        // 添加其他过滤条件
        let whereClause = searchCondition
        if (filter.status) {
          whereClause = and(whereClause, eq(this.schema.status, filter.status))
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
        roles = await db.select(selectedFields).from(this.schema).where(whereClause).orderBy(desc(this.schema.level), asc(this.schema.name)).limit(limit).offset(offset)
      } else {
        // 普通查询
        total = await this.count(queryFilter)
        roles = await this.findPage(queryFilter, {
          page,
          limit,
          orderBy: 'level',
          order: 'desc',
          secondaryOrderBy: 'name',
          secondaryOrder: 'asc',
          fields: this.safeFields
        })
      }

      return {
        roles,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        search: search || null
      }
    } catch (error) {
      console.error('获取角色列表失败:', error)
      throw error
    }
  }
}

export default RoleModel
