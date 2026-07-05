import BaseModel from './BaseModel.js'
import { audit_logs } from '../models/schema/index.js'
import * as logger from '../utils/logger/index.js'

class AuditLogModel extends BaseModel {
  constructor() {
    super('audit_logs', audit_logs)
    this.safeFields = ['id', 'user_id', 'action', 'resource_type', 'resource_id', 'old_values', 'new_values', 'ip_address', 'user_agent', 'status', 'error_message', 'created_at']
    this.safeOrderFields = ['id', 'created_at']
  }

  async record(entry = {}) {
    try {
      return await this.create({
        user_id: entry.userId || null,
        action: entry.action,
        resource_type: entry.resourceType,
        resource_id: entry.resourceId === undefined || entry.resourceId === null ? null : String(entry.resourceId),
        old_values: entry.oldValues === undefined ? null : JSON.stringify(entry.oldValues),
        new_values: entry.newValues === undefined ? null : JSON.stringify(entry.newValues),
        ip_address: entry.ipAddress || null,
        user_agent: entry.userAgent || null,
        status: entry.status || 'success',
        error_message: entry.errorMessage || null
      })
    } catch (error) {
      logger.warn('审计日志写入失败，主流程继续', {
        action: entry.action,
        resource_type: entry.resourceType,
        resource_id: entry.resourceId,
        error: error.message
      })
      return null
    }
  }
}

export default AuditLogModel
