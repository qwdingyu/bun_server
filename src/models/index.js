import UserModel from '../models/UserModel.js'
import SystemConfigModel from '../models/SystemConfigModel.js'
import RoleModel from '../models/RoleModel.js'
import PermissionModel from '../models/PermissionModel.js'
import SessionModel from '../models/SessionModel.js'
import AuditLogModel from '../models/AuditLogModel.js'
import BaseModel from '../models/BaseModel.js'

// 创建模型实例
const userModel = new UserModel()
const systemConfigModel = new SystemConfigModel()
const roleModel = new RoleModel()
const permissionModel = new PermissionModel()
const sessionModel = new SessionModel()
const auditLogModel = new AuditLogModel()

// 导出所有模型实例
export { userModel, systemConfigModel, roleModel, permissionModel, sessionModel, auditLogModel }

// 重新导出所有模型类（用于扩展）
export { UserModel, SystemConfigModel, RoleModel, PermissionModel, SessionModel, AuditLogModel, BaseModel }
