import { eq, and, isNull, desc, asc, sql } from 'drizzle-orm'
import { getDrizzleInstance } from '../config/database.js'
import schemaTables from './schema/index.js'

const drizzleColumnsSymbol = Symbol.for('drizzle:Columns')

/**
 * 将外部传入的表引用（字符串或Drizzle表对象）解析为Drizzle表对象
 * @param {string|Object} tableRef - 表名称或表对象
 * @returns {Object|null}
 */
function resolveTable(tableRef) {
  if (!tableRef) {
    return null
  }

  if (typeof tableRef === 'string') {
    return schemaTables?.[tableRef] || null
  }

  return tableRef
}

/**
 * 获取指定表的列定义映射
 * @param {Object|null} table - Drizzle表对象
 * @returns {Object}
 */
function getTableColumns(table) {
  if (!table || typeof table !== 'object') {
    return {}
  }

  return table[drizzleColumnsSymbol] || {}
}

/**
 * 基于表结构构建通用的 where 条件
 * @param {Object|null} table - Drizzle表对象
 * @param {Object} filter - 查询过滤条件
 * @returns {import('drizzle-orm').SQL<unknown>|undefined}
 */
function buildTableWhereClause(table, filter) {
  if (!filter || typeof filter !== 'object') {
    return undefined
  }

  const columns = getTableColumns(table)
  const conditions = []

  Object.entries(filter).forEach(([key, value]) => {
    const column = columns[key]
    if (!column) {
      return
    }

    if (value === null) {
      conditions.push(isNull(column))
    } else if (typeof value === 'string' && value.includes('%')) {
      conditions.push(sql`${column} LIKE ${value}`)
    } else {
      conditions.push(eq(column, value))
    }
  })

  if (conditions.length === 0) {
    return undefined
  }

  return conditions.reduce((acc, condition) => (acc ? and(acc, condition) : condition), undefined)
}

/**
 * 创建兼容旧测试脚本的数据库访问对象
 * 支持 update(...).set(...).where(...) 以及 select().from(...).where(...).first()
 * @returns {Object}
 */
function createCompatDb() {
  return {
    update(tableRef) {
      const table = resolveTable(tableRef)

      return {
        set(setData = {}) {
          return {
            where: async (filter = {}) => {
              const db = getDrizzleInstance()
              if (!table) {
                throw new Error('无法解析更新操作的表名称')
              }

              const whereClause = buildTableWhereClause(table, filter)
              let query = db.update(table).set(setData)
              if (whereClause) {
                query = query.where(whereClause)
              }
              return await query
            }
          }
        }
      }
    },

    select(selectFields = null) {
      return {
        from(tableRef) {
          const table = resolveTable(tableRef)
          if (!table) {
            throw new Error('无法解析查询操作的表名称')
          }

          const executeQuery = async (filter = {}) => {
            const db = getDrizzleInstance()
            const whereClause = buildTableWhereClause(table, filter)
            const columns = selectFields || getTableColumns(table)

            let query = db.select(columns).from(table)
            if (whereClause) {
              query = query.where(whereClause)
            }

            return await query
          }

          const wrapResult = (rowsPromise) => ({
            first: async () => {
              const rows = await rowsPromise
              return rows[0] || null
            },
            all: async () => await rowsPromise
          })

          return {
            where(filter = {}) {
              return wrapResult(executeQuery(filter))
            },
            first: async () => {
              const rows = await executeQuery()
              return rows[0] || null
            },
            all: async () => await executeQuery()
          }
        }
      }
    }
  }
}
import { getCurrentTimestamp } from '../utils/datetime.js'

export default class BaseModel {
  constructor(tableName, schema) {
    this.tableName = tableName
    this.schema = schema
    this.searchableFields = []
    // 使用简化的字段列表，避免类型推断
    this.safeFields = this.getSimpleFieldList()
    this.safeOrderFields = ['id', 'created_at', 'updated_at']
    // 通过惰性 getter 暴露兼容旧有测试脚本的数据库访问接口
    Object.defineProperty(this, 'db', {
      enumerable: true,
      get: () => createCompatDb()
    })
  }

  /**
   * 获取简化的字段列表，避免 Drizzle 类型推断
   */
  getSimpleFieldList() {
    // 基于表名返回字段列表，避免复杂的类型推断
    const fieldMap = {
      users: ['id', 'username', 'email', 'password_hash', 'first_name', 'last_name', 'avatar_url', 'status', 'email_verified', 'last_login_at', 'created_at', 'updated_at'],
      system_config: ['id', 'config_key', 'config_value', 'updated_at']
    }

    return fieldMap[this.tableName] || ['id', 'created_at', 'updated_at']
  }

  /**
   * 获取 select 字段对象，将字符串字段名转换为列对象
   */
  getSelectFields(fields = null) {
    const fieldNames = fields || this.safeFields
    const selectFields = {}

    fieldNames.forEach((fieldName) => {
      if (this.schema[fieldName]) {
        selectFields[fieldName] = this.schema[fieldName]
      }
    })

    return selectFields
  }

  /**
   * 检查模式是否包含特定字段
   * @param {string} fieldName - 字段名称
   * @returns {boolean} - 字段是否存在
   */
  hasField(fieldName) {
    return !!this.schema[fieldName]
  }

  /**
   * 构建基础的 where 条件，避免复杂类型推断
   */
  buildWhereClause(filter) {
    // 使用条件数组逐项拼接查询条件，确保始终引用 Drizzle 定义的列对象
    const conditions = []

    Object.keys(filter).forEach((key) => {
      // 仅允许访问白名单字段，避免 SQL 注入风险
      if (!this.safeFields.includes(key) || !this.schema[key]) {
        return
      }

      const value = filter[key]

      if (value === null) {
        // 等价于 column IS NULL
        conditions.push(isNull(this.schema[key]))
      } else if (typeof value === 'string' && value.includes('%')) {
        // LIKE 查询需要使用 sql 模板插入列对象
        conditions.push(sql`${this.schema[key]} LIKE ${value}`)
      } else {
        // 默认使用等值匹配
        conditions.push(eq(this.schema[key], value))
      }
    })

    if (conditions.length === 0) {
      return undefined
    }

    if (conditions.length === 1) {
      return conditions[0]
    }

    // 多个条件时使用 and 逐个拼接，避免 and() 空参数导致的异常
    let whereClause = conditions[0]
    for (let i = 1; i < conditions.length; i += 1) {
      whereClause = and(whereClause, conditions[i])
    }

    return whereClause
  }

  /**
   * 查找多条记录 - 使用 Drizzle 的安全方法
   */
  async findMany(filter = {}, orderBy = 'id', order = 'asc', fields = null) {
    try {
      const db = getDrizzleInstance()
      const selectedFields = this.getSelectFields(fields)

      let query = db.select(selectedFields).from(this.schema)

      // 检查 filter 是否是 Drizzle 表达式或普通对象
      if (filter && typeof filter === 'object') {
        if (filter._ && filter._.brand) {
          // 这是一个 Drizzle 表达式，直接使用
          query = query.where(filter)
        } else if (Object.keys(filter).length > 0) {
          // 这是一个普通对象，使用 buildWhereClause 处理
          const whereClause = this.buildWhereClause(filter)
          if (whereClause) {
            query = query.where(whereClause)
          }
        }
      }

      // 添加排序
      if (orderBy && this.safeOrderFields.includes(orderBy)) {
        const orderFn = order === 'asc' ? asc : desc
        query = query.orderBy(orderFn(this.schema[orderBy]))
      }

      return await query
    } catch (error) {
      console.error(`Error in ${this.tableName}.findMany:`, error)
      throw error
    }
  }

  /**
   * 查找单条记录
   */
  async findOne(filter = {}, fields = null) {
    try {
      const db = getDrizzleInstance()
      const selectedFields = this.getSelectFields(fields)

      let query = db.select(selectedFields).from(this.schema)

      // 检查 filter 是否是 Drizzle 表达式（具有 _: { brand } 属性）
      // 或者是普通对象
      if (filter && typeof filter === 'object') {
        if (filter._ && filter._.brand) {
          // 这是一个 Drizzle 表达式，直接使用
          query = query.where(filter)
        } else if (Object.keys(filter).length > 0) {
          // 这是一个普通对象，使用 buildWhereClause 处理
          const whereClause = this.buildWhereClause(filter)
          if (whereClause) {
            query = query.where(whereClause)
          }
        }
      }

      const result = await query.limit(1)
      return result[0] || null
    } catch (error) {
      console.error(`Error in ${this.tableName}.findOne:`, error)
      throw error
    }
  }

  /**
   * 根据 ID 查找
   */
  async findById(id, fields = null) {
    return await this.findOne({ id }, fields)
  }

  /**
   * 创建记录 - 使用 Drizzle 的安全方法
   */
  async create(data, trx = null) {
    try {
      // 执行创建前处理
      const processedData = await this.beforeCreate(data)

      // 设置创建时间和更新时间（如果存在这些字段）
      const now = getCurrentTimestamp()

      // 直接使用数值类型的时间戳而不是Date对象
      if (this.hasField('created_at') && !processedData.created_at) {
        processedData.created_at = now
      }

      if (this.hasField('updated_at') && !processedData.updated_at) {
        processedData.updated_at = now
      }

      // 清除任何可能导致日期处理问题的空值
      Object.keys(processedData).forEach((key) => {
        if (processedData[key] === undefined) {
          delete processedData[key]
        }
      })

      const database = trx || getDrizzleInstance()
      const result = await database.insert(this.schema).values(processedData).returning()

      return result[0]
    } catch (error) {
      console.error(`Error in ${this.tableName}.create:`, error)
      throw error
    }
  }

  /**
   * 更新记录
   */
  async update(id, data, trx = null) {
    try {
      // 执行更新前处理
      const processedData = await this.beforeUpdate(data)

      // 在应用层处理更新时间，而不是依赖数据库触发器
      if (this.schema.updated_at && !processedData.updated_at) {
        processedData.updated_at = getCurrentTimestamp()
      }

      // 清除任何可能导致日期处理问题的空值
      Object.keys(processedData).forEach((key) => {
        if (processedData[key] === undefined) {
          delete processedData[key]
        }
      })

      const database = trx || getDrizzleInstance()
      const result = await database.update(this.schema).set(processedData).where(eq(this.schema.id, id)).returning()

      return result[0] || null
    } catch (error) {
      console.error(`Error in ${this.tableName}.update:`, error)
      throw error
    }
  }

  /**
   * 软删除记录
   */
  async softDelete(id, trx = null) {
    try {
      const database = trx || getDrizzleInstance()

      // 使用当前时间戳（秒）
      const now = getCurrentTimestamp()
      // 创建更新对象
      const updateData = { deleted_at: now }

      // 只有在字段存在时才添加updated_at
      if (this.hasField('updated_at')) {
        updateData.updated_at = now
      }

      await database.update(this.schema).set(updateData).where(eq(this.schema.id, id))

      return true
    } catch (error) {
      console.error(`Error in ${this.tableName}.softDelete:`, error)
      throw error
    }
  }

  /**
   * 物理删除记录
   */
  async delete(id, trx = null) {
    try {
      const database = trx || getDrizzleInstance()
      await database.delete(this.schema).where(eq(this.schema.id, id))

      return true
    } catch (error) {
      console.error(`Error in ${this.tableName}.delete:`, error)
      throw error
    }
  }

  /**
   * 检查字段唯一性
   */
  async isUnique(field, value, excludeId = null, trx = null) {
    try {
      const database = trx || getDrizzleInstance()
      let query = database.select({ id: this.schema.id }).from(this.schema).where(eq(this.schema[field], value))

      if (excludeId) {
        query = query.where(sql`${this.schema.id} != ${excludeId}`)
      }

      const result = await query.limit(1)
      return !result[0]
    } catch (error) {
      console.error(`Error in ${this.tableName}.isUnique:`, error)
      throw error
    }
  }

  /**
   * 事务执行
   */
  async transaction(callback) {
    try {
      const database = getDrizzleInstance()
      return await database.transaction(callback)
    } catch (error) {
      console.error(`Error in ${this.tableName}.transaction:`, error)
      throw error
    }
  }

  /**
   * 计数查询 - 简化版本避免 Drizzle 类型系统问题
   */
  async count(filter = {}) {
    try {
      const db = getDrizzleInstance()
      const whereClause = this.buildWhereClause(filter)

      let query = db
        .select({
          count: sql`count(*)`.mapWith(Number)
        })
        .from(this.schema)

      if (whereClause) {
        query = query.where(whereClause)
      }

      const result = await query
      return result[0]?.count || 0
    } catch (error) {
      console.error(`Error in ${this.tableName}.count:`, error)
      throw error
    }
  }

  /**
   * 创建前的数据处理（子类可重写）
   */
  async beforeCreate(data) {
    return data
  }

  /**
   * 更新前的数据处理（子类可重写）
   */
  async beforeUpdate(data) {
    return data
  }
}
