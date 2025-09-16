import BaseModel from './BaseModel.js'
import { users } from '../models/schema/index.js'
import { and, eq, isNull, or, sql, desc } from 'drizzle-orm'
import { getDrizzleInstance } from '../config/database.js'
import { hashPassword, verifyPassword, validateEmail, validateUsername, sanitizeUser } from '../utils/auth.js'
import { getCurrentTimestamp } from '../utils/datetime.js'
import AppError from '../utils/AppError.js'

class UserModel extends BaseModel {
  constructor() {
    super('users', users)
    this.searchableFields = ['username', 'email', 'first_name', 'last_name']
    this.safeFields = ['id', 'username', 'email', 'first_name', 'last_name', 'avatar_url', 'status', 'email_verified', 'last_login_at', 'created_at', 'updated_at']
    this.safeOrderFields = ['id', 'username', 'email', 'status', 'created_at', 'updated_at']
  }

  /**
   * 创建前的验证和数据处理
   */
  async beforeCreate(data) {
    // 验证用户名
    if (!data.username || !validateUsername(data.username)) {
      throw new AppError('用户名必须是3-20位字母、数字或下划线', 400)
    }

    // 验证邮箱
    if (!data.email || !validateEmail(data.email)) {
      throw new AppError('邮箱格式不正确', 400)
    }

    // 验证密码
    if (!data.password || data.password.length < 6) {
      throw new AppError('密码至少6位', 400)
    }

    // 检查用户名唯一性
    const isUsernameUnique = await this.isUnique('username', data.username)
    if (!isUsernameUnique) {
      throw new AppError('用户名已存在', 409)
    }

    // 检查邮箱唯一性
    const isEmailUnique = await this.isUnique('email', data.email)
    if (!isEmailUnique) {
      throw new AppError('邮箱已存在', 409)
    }

    // 哈希密码
    if (data.password) {
      data.password_hash = hashPassword(data.password)
      delete data.password
    }

    // 设置默认状态
    if (!data.status) {
      data.status = 'active'
    }

    return data
  }

  /**
   * 更新前的验证和数据处理
   */
  async beforeUpdate(data) {
    // 验证用户名（如果被更新）
    if (data.username) {
      if (!validateUsername(data.username)) {
        throw new AppError('用户名必须是3-20位字母、数字或下划线', 400)
      }

      const existingUser = await this.findOne({ username: data.username })
      if (existingUser && existingUser.id !== data.id) {
        throw new AppError('用户名已存在', 409)
      }
    }

    // 验证邮箱（如果被更新）
    if (data.email) {
      if (!validateEmail(data.email)) {
        throw new AppError('邮箱格式不正确', 400)
      }

      const existingUser = await this.findOne({ email: data.email })
      if (existingUser && existingUser.id !== data.id) {
        throw new AppError('邮箱已存在', 409)
      }
    }

    // 处理密码更新
    if (data.password) {
      if (data.password.length < 6) {
        throw new AppError('密码至少6位', 400)
      }
      data.password_hash = hashPassword(data.password)
      delete data.password
    }

    return data
  }

  /**
   * 用户认证
   */
  async authenticate(identifier, password) {
    try {
      // 通过用户名或邮箱查找用户 - 需要包含password_hash用于验证
      const authFields = [...this.safeFields, 'password_hash']
      const user = await this.findOne(or(eq(this.schema.username, identifier), eq(this.schema.email, identifier)), authFields)

      if (!user) {
        throw new AppError('用户不存在', 404)
      }

      if (user.status !== 'active') {
        throw new AppError('用户已被禁用', 403)
      }

      // 验证密码
      const isValidPassword = verifyPassword(password, user.password_hash)
      if (!isValidPassword) {
        throw new AppError('密码错误', 401)
      }

      // 更新最后登录时间
      await this.update(user.id, { last_login_at: getCurrentTimestamp() })

      return sanitizeUser(user)
    } catch (error) {
      throw error
    }
  }

  /**
   * 根据用户名查找用户
   */
  async findByUsername(username) {
    const user = await this.findOne({ username })
    return user ? sanitizeUser(user) : null
  }

  /**
   * 根据邮箱查找用户
   */
  async findByEmail(email) {
    const user = await this.findOne({ email })
    return user ? sanitizeUser(user) : null
  }

  /**
   * 创建用户
   */
  async createUser(userData) {
    const user = await this.create(userData)
    return sanitizeUser(user)
  }

  /**
   * 更新用户
   */
  async updateUser(id, userData) {
    const user = await this.update(id, userData)
    return user ? sanitizeUser(user) : null
  }

  /**
   * 获取用户列表
   */
  async getUserList(filter = {}, page = 1, limit = 20, search = null) {
    try {
      const offset = (page - 1) * limit

      // 构建查询条件（排除软删除的记录）
      let queryFilter = { ...filter, deleted_at: null }

      // 如果有搜索条件，构建搜索查询
      let users, total

      if (search && search.trim()) {
        const db = getDrizzleInstance()
        const searchTerm = `%${search.trim()}%`

        // 构建搜索条件
        const searchCondition = or(
          sql`${this.schema.username} LIKE ${searchTerm}`,
          sql`${this.schema.email} LIKE ${searchTerm}`,
          sql`${this.schema.first_name} LIKE ${searchTerm}`,
          sql`${this.schema.last_name} LIKE ${searchTerm}`
        )

        // 添加其他过滤条件
        let whereClause = searchCondition
        if (filter.status) {
          whereClause = and(whereClause, eq(this.schema.status, filter.status))
        }
        whereClause = and(whereClause, isNull(this.schema.deleted_at))

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
        users = await db.select(selectedFields).from(this.schema).where(whereClause).orderBy(desc(this.schema.created_at)).limit(limit).offset(offset)
      } else {
        // 普通查询
        total = await this.count(queryFilter)
        users = await this.findMany(queryFilter, 'created_at', 'desc', this.safeFields)

        // 应用分页
        users = users.slice(offset, offset + limit)
      }

      return {
        users: users.map(sanitizeUser),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        search: search || null
      }
    } catch (error) {
      console.error('获取用户列表失败:', error)
      throw error
    }
  }

  /**
   * 获取用户统计
   */
  async getUserStats() {
    try {
      const allUsers = await this.findMany({ deleted_at: null })

      // 获取今天开始时的时间戳
      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)
      const todayTimestamp = Math.floor(startOfToday.getTime() / 1000)

      return {
        total: allUsers.length,
        active: allUsers.filter((u) => u.status === 'active').length,
        inactive: allUsers.filter((u) => u.status === 'inactive').length,
        verified: allUsers.filter((u) => u.email_verified).length,
        created_today: allUsers.filter((u) => u.created_at >= todayTimestamp).length
      }
    } catch (error) {
      console.error('获取用户统计失败:', error)
      throw error
    }
  }

  /**
   * 切换用户状态
   */
  async toggleStatus(id) {
    const user = await this.findById(id)
    if (!user) {
      throw new AppError('用户不存在', 404)
    }

    const newStatus = user.status === 'active' ? 'inactive' : 'active'
    const updatedUser = await this.update(id, { status: newStatus })
    return updatedUser ? sanitizeUser(updatedUser) : null
  }

  /**
   * 验证邮箱
   */
  async verifyEmail(id) {
    const user = await this.update(id, { email_verified: true })
    return user ? sanitizeUser(user) : null
  }

  /**
   * 软删除用户
   */
  async softDeleteUser(id) {
    const user = await this.findById(id)
    if (!user) {
      throw new AppError('用户不存在', 404)
    }

    await this.softDelete(id)
    return true
  }

  /**
   * 恢复软删除的用户
   */
  async restoreUser(id) {
    const database = getDrizzleInstance()
    await database.update(this.schema).set({ deleted_at: null }).where(eq(this.schema.id, id))

    const user = await this.findById(id)
    return user ? sanitizeUser(user) : null
  }
}

export default UserModel
