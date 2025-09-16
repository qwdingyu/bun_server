/**
 * 权限工具函数
 */
import { roleModel, permissionModel } from '../models/index.js'

/**
 * 检查用户是否拥有指定角色
 * @param {number} userId - 用户ID
 * @param {string|Array} roles - 角色名称或角色名称数组
 * @returns {Promise<boolean>} - 是否拥有角色
 */
export async function hasRole(userId, roles) {
  return await roleModel.hasRole(userId, roles)
}

/**
 * 获取用户所有角色
 * @param {number} userId - 用户ID
 * @returns {Promise<Array>} - 角色数组
 */
export async function getUserRoles(userId) {
  return await roleModel.getUserRoles(userId)
}

/**
 * 检查用户是否拥有指定权限
 * @param {number} userId - 用户ID
 * @param {string|Array} permissions - 权限名称或权限名称数组
 * @returns {Promise<boolean>} - 是否拥有权限
 */
export async function hasPermission(userId, permissions) {
  return await permissionModel.hasPermission(userId, permissions)
}

/**
 * 检查用户是否有权限对特定资源进行操作
 * @param {number} userId - 用户ID
 * @param {string} resource - 资源名称
 * @param {string} action - 操作名称
 * @returns {Promise<boolean>} - 是否有权限
 */
export async function canAccessResource(userId, resource, action) {
  // 格式化权限名称为 resource:action
  const permissionName = `${resource}:${action}`
  return await hasPermission(userId, permissionName)
}

/**
 * 获取用户所有权限
 * @param {number} userId - 用户ID
 * @returns {Promise<Array>} - 权限数组
 */
export async function getUserPermissions(userId) {
  return await permissionModel.getUserPermissions(userId)
}

/**
 * 为用户分配角色
 * @param {number} userId - 用户ID
 * @param {number} roleId - 角色ID
 * @param {Object} options - 选项
 * @returns {Promise<Object>} - 分配结果
 */
export async function assignRoleToUser(userId, roleId, options = {}) {
  return await roleModel.assignRoleToUser(userId, roleId, options)
}

/**
 * 移除用户角色
 * @param {number} userId - 用户ID
 * @param {number} roleId - 角色ID
 * @returns {Promise<boolean>} - 是否成功
 */
export async function removeRoleFromUser(userId, roleId) {
  return await roleModel.removeRoleFromUser(userId, roleId)
}

/**
 * 为用户设置权限
 * @param {number} userId - 用户ID
 * @param {number} permissionId - 权限ID
 * @param {string} permissionType - 权限类型：'grant'或'deny'
 * @param {Object} options - 选项
 * @returns {Promise<Object>} - 设置结果
 */
export async function setUserPermission(userId, permissionId, permissionType, options = {}) {
  return await permissionModel.setUserPermission(userId, permissionId, permissionType, options)
}

/**
 * 移除用户权限
 * @param {number} userId - 用户ID
 * @param {number} permissionId - 权限ID
 * @returns {Promise<boolean>} - 是否成功
 */
export async function removeUserPermission(userId, permissionId) {
  return await permissionModel.removeUserPermission(userId, permissionId)
}

/**
 * 为角色授予权限
 * @param {number} roleId - 角色ID
 * @param {number} permissionId - 权限ID
 * @param {number} grantedBy - 授权者ID
 * @returns {Promise<Object>} - 授权结果
 */
export async function assignPermissionToRole(roleId, permissionId, grantedBy = null) {
  return await permissionModel.assignPermissionToRole(roleId, permissionId, grantedBy)
}

/**
 * 从角色移除权限
 * @param {number} roleId - 角色ID
 * @param {number} permissionId - 权限ID
 * @returns {Promise<boolean>} - 是否成功
 */
export async function removePermissionFromRole(roleId, permissionId) {
  return await permissionModel.removePermissionFromRole(roleId, permissionId)
}
