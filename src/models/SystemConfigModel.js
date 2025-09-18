import BaseModel from './BaseModel.js'
import { system_config } from '../models/schema/index.js'
import { eq, and, isNull, or } from 'drizzle-orm'
import { getDrizzleInstance } from '../config/database.js'
import AppError from '../utils/AppError.js'
import { getCurrentTimestamp } from '../utils/datetime.js'

class SystemConfigModel extends BaseModel {
  constructor() {
    super('system_config', system_config)
    this.searchableFields = ['config_key']
    this.safeFields = ['id', 'config_key', 'config_value', 'updated_at']
    this.safeOrderFields = ['id', 'config_key', 'updated_at']
    this.cache = new Map() // 配置缓存
  }

  /**
   * 获取配置值
   */
  /**
   * 获取配置值，支持类型转换和默认值
   * @param {string} key - 配置键
   * @param {any} defaultValue - 默认值，当配置不存在时返回
   * @param {Function} transform - 可选的类型转换函数
   * @returns {Promise<any>} - 配置值或默认值
   */
  async getConfig(key, defaultValue = null, transform = null) {
    try {
      // 先从缓存读取
      if (this.cache.has(key)) {
        const value = this.cache.get(key)
        return transform ? transform(value) : value
      }

      // 从数据库读取
      const config = await this.findOne({ config_key: key })

      if (!config) {
        if (defaultValue !== null) {
          return defaultValue
        }
        throw new AppError(`配置不存在: ${key}`, 404)
      }

      // 缓存结果
      this.cache.set(key, config.config_value)

      // 应用类型转换
      return transform ? transform(config.config_value) : config.config_value
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }
      console.error(`获取配置失败 [${key}]:`, error)
      if (defaultValue !== null) {
        return defaultValue
      }
      throw error
    }
  }

  /**
   * 设置配置值
   */
  async setConfig(key, value) {
    try {
      const existing = await this.findOne({ config_key: key })

      const normalizedValue = String(value)

      if (existing) {
        await this.update(existing.id, {
          config_value: normalizedValue,
          updated_at: getCurrentTimestamp()
        })
      } else {
        await this.create({
          config_key: key,
          config_value: normalizedValue,
          updated_at: getCurrentTimestamp()
        })
      }

      // 同步更新内存缓存，避免读取到过期的旧值
      this.cache.set(key, normalizedValue)

      return true
    } catch (error) {
      console.error(`设置配置失败 [${key}]:`, error)
      throw error
    }
  }

  /**
   * 批量获取配置
   */
  async getConfigs(keys = []) {
    try {
      let configs
      if (keys.length > 0) {
        // 使用 Drizzle 的 inArray 或多个 eq 条件
        const db = getDrizzleInstance()
        const selectedFields = this.getSelectFields()

        configs = await db
          .select(selectedFields)
          .from(this.schema)
          .where(
            keys.length === 1
              ? eq(this.schema.config_key, keys[0])
              : keys.reduce((acc, key, index) => {
                  const condition = eq(this.schema.config_key, key)
                  return index === 0 ? condition : or(acc, condition)
                }, null)
          )
          .orderBy(this.schema.config_key)
      } else {
        configs = await this.findMany({}, 'config_key', 'asc')
      }

      const result = {}
      configs.forEach((config) => {
        result[config.config_key] = config.config_value
      })

      return result
    } catch (error) {
      console.error('批量获取配置失败:', error)
      throw error
    }
  }

  /**
   * 批量设置配置
   */
  async setConfigs(configs = {}) {
    try {
      return await this.transaction(async (trx) => {
        for (const [key, value] of Object.entries(configs)) {
          const normalizedValue = String(value)
          const existing = await this.findOne({ config_key: key }, undefined, trx)

          if (existing) {
            await this.update(
              existing.id,
              {
                config_value: normalizedValue,
                updated_at: getCurrentTimestamp()
              },
              trx
            )
          } else {
            await this.create(
              {
                config_key: key,
                config_value: normalizedValue,
                updated_at: getCurrentTimestamp()
              },
              trx
            )
          }

          // 批量操作同样需要刷新缓存中的对应配置值
          this.cache.set(key, normalizedValue)
        }

        return true
      })
    } catch (error) {
      console.error('批量设置配置失败:', error)
      throw error
    }
  }

  /**
   * 删除配置
   */
  /**
   * 删除配置
   * @param {string} key - 要删除的配置键
   * @returns {Promise<boolean>} - 删除成功返回true
   */
  async deleteConfig(key) {
    try {
      const config = await this.findOne({ config_key: key })
      if (!config) {
        return false
      }

      await this.delete(config.id)

      // 从缓存中移除
      this.cache.delete(key)

      return true
    } catch (error) {
      console.error(`删除配置失败 [${key}]:`, error)
      throw error
    }
  }
  /**
   * 获取所有配置
   * @returns {Promise<Object>} - 包含所有配置的对象
   */
  async getAllConfigs() {
    try {
      const configs = await this.findMany({}, 'config_key', 'asc')

      const result = {}
      configs.forEach((config) => {
        result[config.config_key] = config.config_value
        // 更新缓存
        this.cache.set(config.config_key, config.config_value)
      })

      return result
    } catch (error) {
      console.error('获取所有配置失败:', error)
      throw error
    }
  }

  /**
   * 刷新配置缓存
   * @param {string|null} key - 特定要刷新的配置键，不提供则刷新所有
   * @returns {Promise<boolean>} - 刷新成功返回true
   */
  async refreshCache(key = null) {
    try {
      if (key) {
        // 刷新单个配置
        const config = await this.findOne({ config_key: key })
        if (config) {
          this.cache.set(key, config.config_value)
        } else {
          this.cache.delete(key)
        }
      } else {
        // 刷新所有配置
        this.cache.clear()
        await this.getAllConfigs()
      }
      return true
    } catch (error) {
      console.error('刷新配置缓存失败:', error)
      throw error
    }
  }
}

export default SystemConfigModel
