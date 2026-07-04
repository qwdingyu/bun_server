/**
 * 输入验证中间件
 * 支持请求体、查询参数、路径参数的验证
 */

import AppError from '../../utils/AppError.js'

/**
 * 简单的JSON Schema验证器
 */
class SimpleValidator {
  static validate(data, schema) {
    const errors = []
    this._validateObject(data, schema, '', errors)
    return {
      valid: errors.length === 0,
      errors
    }
  }

  static _validateObject(data, schema, path, errors) {
    if (!schema || typeof schema !== 'object') return

    // 检查必需字段
    if (schema.required && Array.isArray(schema.required)) {
      for (const field of schema.required) {
        if (data[field] === undefined || data[field] === null) {
          errors.push({
            field: path ? `${path}.${field}` : field,
            message: `字段 '${field}' 是必需的`
          })
        }
      }
    }

    // 检查字段类型和规则
    if (schema.properties) {
      for (const [field, fieldSchema] of Object.entries(schema.properties)) {
        const fieldPath = path ? `${path}.${field}` : field
        const value = data[field]

        if (value !== undefined && value !== null) {
          this._validateField(value, fieldSchema, fieldPath, errors)
        }
      }
    }

    // 检查不允许的额外字段
    if (schema.additionalProperties === false && data && typeof data === 'object') {
      const allowedFields = Object.keys(schema.properties || {})
      for (const field of Object.keys(data)) {
        if (!allowedFields.includes(field)) {
          errors.push({
            field: path ? `${path}.${field}` : field,
            message: `不允许的字段 '${field}'`
          })
        }
      }
    }
  }

  static _validateField(value, schema, path, errors) {
    // 类型验证
    if (schema.type) {
      const actualType = this._getType(value)
      const expectedType = schema.type === 'integer' ? 'number' : schema.type
      if (actualType !== expectedType) {
        errors.push({
          field: path,
          message: `字段类型错误，期望 ${schema.type}，实际 ${actualType}`
        })
        return
      }
    }

    // 字符串验证
    if (schema.type === 'string') {
      if (schema.minLength && value.length < schema.minLength) {
        errors.push({
          field: path,
          message: `字符串长度不能少于 ${schema.minLength} 个字符`
        })
      }
      if (schema.maxLength && value.length > schema.maxLength) {
        errors.push({
          field: path,
          message: `字符串长度不能超过 ${schema.maxLength} 个字符`
        })
      }
      if (schema.pattern) {
        const regex = new RegExp(schema.pattern)
        if (!regex.test(value)) {
          errors.push({
            field: path,
            message: schema.patternMessage || `字段格式不正确`
          })
        }
      }
      if (schema.enum && !schema.enum.includes(value)) {
        errors.push({
          field: path,
          message: `字段值必须是以下之一: ${schema.enum.join(', ')}`
        })
      }
    }

    // 数字验证
    if (schema.type === 'number' || schema.type === 'integer') {
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push({
          field: path,
          message: `数值不能小于 ${schema.minimum}`
        })
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push({
          field: path,
          message: `数值不能大于 ${schema.maximum}`
        })
      }
      if (schema.type === 'integer' && !Number.isInteger(value)) {
        errors.push({
          field: path,
          message: '必须是整数'
        })
      }
    }

    // 数组验证
    if (schema.type === 'array') {
      if (schema.minItems && value.length < schema.minItems) {
        errors.push({
          field: path,
          message: `数组元素不能少于 ${schema.minItems} 个`
        })
      }
      if (schema.maxItems && value.length > schema.maxItems) {
        errors.push({
          field: path,
          message: `数组元素不能超过 ${schema.maxItems} 个`
        })
      }
      if (schema.items) {
        value.forEach((item, index) => {
          this._validateField(item, schema.items, `${path}[${index}]`, errors)
        })
      }
    }

    // 对象验证
    if (schema.type === 'object') {
      this._validateObject(value, schema, path, errors)
    }

    // 自定义验证函数
    if (schema.validate && typeof schema.validate === 'function') {
      try {
        const result = schema.validate(value)
        if (result !== true) {
          errors.push({
            field: path,
            message: result || '自定义验证失败'
          })
        }
      } catch (error) {
        errors.push({
          field: path,
          message: '验证过程发生错误'
        })
      }
    }
  }

  static _getType(value) {
    if (value === null) return 'null'
    if (Array.isArray(value)) return 'array'
    return typeof value
  }
}

/**
 * 请求体验证中间件
 */
export function validateBody(schema) {
  return async (c, next) => {
    try {
      const body = await c.req.json()
      const result = SimpleValidator.validate(body, schema)

      if (!result.valid) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: '请求体验证失败',
              details: result.errors,
              timestamp: new Date().toISOString()
            }
          },
          400
        )
      }

      c.set('validatedBody', body)
      await next()
    } catch (error) {
      if (error.name === 'SyntaxError') {
        return c.json(
          {
            success: false,
            error: {
              code: 'INVALID_JSON',
              message: 'JSON格式错误',
              timestamp: new Date().toISOString()
            }
          },
          400
        )
      }
      throw error
    }
  }
}

/**
 * 查询参数验证中间件
 */
export function validateQuery(schema) {
  return async (c, next) => {
    const query = {}
    const url = new URL(c.req.url)

    // 转换查询参数类型
    for (const [key, value] of url.searchParams.entries()) {
      const fieldSchema = schema.properties?.[key]
      query[key] = convertQueryValue(value, fieldSchema?.type)
    }

    const result = SimpleValidator.validate(query, schema)

    if (!result.valid) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '查询参数验证失败',
            details: result.errors,
            timestamp: new Date().toISOString()
          }
        },
        400
      )
    }

    c.set('validatedQuery', query)
    await next()
  }
}

/**
 * 路径参数验证中间件
 */
export function validateParams(schema) {
  return async (c, next) => {
    const params = {}

    // 获取所有路径参数
    for (const [key, fieldSchema] of Object.entries(schema.properties || {})) {
      const value = c.req.param(key)
      if (value !== undefined) {
        params[key] = convertQueryValue(value, fieldSchema.type)
      }
    }

    const result = SimpleValidator.validate(params, schema)

    if (!result.valid) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '路径参数验证失败',
            details: result.errors,
            timestamp: new Date().toISOString()
          }
        },
        400
      )
    }

    c.set('validatedParams', params)
    await next()
  }
}

/**
 * 转换查询参数值类型
 */
function convertQueryValue(value, type) {
  if (value === undefined || value === null || value === '') {
    return undefined
  }

  switch (type) {
    case 'number':
      const num = Number(value)
      return isNaN(num) ? value : num
    case 'integer':
      const int = parseInt(value, 10)
      return isNaN(int) ? value : int
    case 'boolean':
      return value === 'true' || value === '1'
    case 'array':
      return value.split(',').map((v) => v.trim())
    default:
      return value
  }
}

/**
 * 组合验证中间件
 */
export function validate(schemas = {}) {
  const middlewares = []

  if (schemas.body) {
    middlewares.push(validateBody(schemas.body))
  }
  if (schemas.query) {
    middlewares.push(validateQuery(schemas.query))
  }
  if (schemas.params) {
    middlewares.push(validateParams(schemas.params))
  }

  return async (c, next) => {
    let index = 0

    const dispatch = async (i) => {
      if (i >= middlewares.length) {
        return await next()
      }

      const middleware = middlewares[i]
      return await middleware(c, async () => {
        return await dispatch(i + 1)
      })
    }

    return await dispatch(0)
  }
}

/**
 * 常用验证模式
 */
export const patterns = {
  email: {
    pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
    patternMessage: '邮箱格式不正确'
  },
  password: {
    pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)[a-zA-Z\\d@$!%*?&]{8,}$',
    patternMessage: '密码至少8位，包含大小写字母和数字'
  },
  username: {
    pattern: '^[a-zA-Z0-9_]{3,20}$',
    patternMessage: '用户名只能包含字母、数字和下划线，3-20位'
  },
  phone: {
    pattern: '^1[3-9]\\d{9}$',
    patternMessage: '手机号格式不正确'
  },
  idCard: {
    pattern: '^[1-9]\\d{5}(18|19|20)\\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\\d|3[01])\\d{3}[0-9Xx]$',
    patternMessage: '身份证号格式不正确'
  },
  url: {
    pattern: '^https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)$',
    patternMessage: 'URL格式不正确'
  }
}

/**
 * 常用验证schema
 */
export const schemas = {
  pagination: {
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
      sort: {
        type: 'string',
        pattern: '^[a-zA-Z_]+$'
      },
      order: {
        type: 'string',
        enum: ['asc', 'desc'],
        default: 'desc'
      }
    }
  },
  id: {
    type: 'object',
    properties: {
      id: {
        type: 'integer',
        minimum: 1
      }
    },
    required: ['id']
  }
}

export default {
  validateBody,
  validateQuery,
  validateParams,
  validate,
  patterns,
  schemas,
  SimpleValidator
}
