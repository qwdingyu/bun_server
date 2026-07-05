#!/usr/bin/env bun

import { Hono } from 'hono'
import rbacRoutes from '../src/routes/rbac.js'
import { auditLogModel, permissionModel, roleModel, userModel } from '../src/models/index.js'
import { generateTokenPair } from '../src/utils/jwt/index.js'
import { cleanupTestData, initTestEnv, testRunner } from './test-utils.js'

await initTestEnv()

console.log('🧪 开始 RBAC 管理路由测试...')

const unique = String(Date.now()).slice(-6)
const superAdmin = await userModel.createUser({
  username: `testrbacadmin${unique}`,
  email: `testrbacadmin${unique}@example.com`,
  password: 'password123'
})
const normalUser = await userModel.createUser({
  username: `testrbacuser${unique}`,
  email: `testrbacuser${unique}@example.com`,
  password: 'password123'
})
const targetUser = await userModel.createUser({
  username: `testrbactarget${unique}`,
  email: `testrbactarget${unique}@example.com`,
  password: 'password123'
})

const superAdminRole = await roleModel.findOne({ name: 'super_admin' })
const adminRole = await roleModel.findOne({ name: 'admin' })
const usersReadPermission = await permissionModel.findOne({ name: 'users:read' })

await roleModel.assignRoleToUser(superAdmin.id, superAdminRole.id)

const superAdminToken = generateTokenPair(superAdmin).accessToken
const normalUserToken = generateTokenPair(normalUser).accessToken

const app = new Hono()
app.route('/api/rbac', rbacRoutes)

await testRunner.test('普通用户不能访问 RBAC 管理路由', async () => {
  const response = await app.request('/api/rbac/roles', {
    headers: { Authorization: `Bearer ${normalUserToken}` }
  })

  testRunner.assertStatus(response, 403, '普通用户应被 RBAC 管理路由拒绝')
})

await testRunner.test('超级管理员可以查询角色和权限列表', async () => {
  const roleResponse = await app.request('/api/rbac/roles?page=1&limit=10', {
    headers: { Authorization: `Bearer ${superAdminToken}` }
  })
  const roleBody = await roleResponse.json()
  testRunner.assertStatus(roleResponse, 200, `角色列表应成功: ${JSON.stringify(roleBody)}`)
  testRunner.assert(Array.isArray(roleBody.data.roles), '角色列表应返回数组')
  testRunner.assert(roleBody.data.roles.some((role) => role.name === 'super_admin'), '角色列表应包含超级管理员')

  const permissionResponse = await app.request('/api/rbac/permissions?resource=users', {
    headers: { Authorization: `Bearer ${superAdminToken}` }
  })
  const permissionBody = await permissionResponse.json()
  testRunner.assertStatus(permissionResponse, 200, `权限列表应成功: ${JSON.stringify(permissionBody)}`)
  testRunner.assert(permissionBody.data.permissions.some((permission) => permission.name === 'users:read'), '权限列表应支持 resource 过滤')
})

await testRunner.test('超级管理员可以给用户分配和移除角色', async () => {
  const assignResponse = await app.request(`/api/rbac/users/${targetUser.id}/roles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({ roleId: adminRole.id })
  })
  const assignBody = await assignResponse.json()
  testRunner.assertStatus(assignResponse, 200, `用户角色分配应成功: ${JSON.stringify(assignBody)}`)

  const userRoles = await roleModel.getUserRoles(targetUser.id)
  testRunner.assert(userRoles.some((role) => role.name === 'admin'), '目标用户应拥有 admin 角色')

  const removeResponse = await app.request(`/api/rbac/users/${targetUser.id}/roles/${adminRole.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${superAdminToken}` }
  })
  const removeBody = await removeResponse.json()
  testRunner.assertStatus(removeResponse, 200, `用户角色移除应成功: ${JSON.stringify(removeBody)}`)

  const removedRoles = await roleModel.getUserRoles(targetUser.id)
  testRunner.assert(!removedRoles.some((role) => role.name === 'admin'), '目标用户 admin 角色应被移除')

  const auditLog = await auditLogModel.findOne({ action: 'rbac.user_role.assign' })
  testRunner.assert(auditLog, '用户角色分配应写入审计日志')
})

await testRunner.test('超级管理员可以给角色授权和撤销权限', async () => {
  const assignResponse = await app.request(`/api/rbac/roles/${adminRole.id}/permissions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({ permissionId: usersReadPermission.id })
  })
  const assignBody = await assignResponse.json()
  testRunner.assertStatus(assignResponse, 200, `角色权限授权应成功: ${JSON.stringify(assignBody)}`)

  await roleModel.assignRoleToUser(targetUser.id, adminRole.id)
  const hasPermission = await permissionModel.hasPermission(targetUser.id, 'users:read')
  testRunner.assert(hasPermission, '角色授权后目标用户应拥有 users:read')

  const removeResponse = await app.request(`/api/rbac/roles/${adminRole.id}/permissions/${usersReadPermission.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${superAdminToken}` }
  })
  const removeBody = await removeResponse.json()
  testRunner.assertStatus(removeResponse, 200, `角色权限撤销应成功: ${JSON.stringify(removeBody)}`)

  const auditLog = await auditLogModel.findOne({ action: 'rbac.role_permission.assign' })
  testRunner.assert(auditLog, '角色权限授权应写入审计日志')
})

await cleanupTestData()
testRunner.printSummary()

if (testRunner.failed > 0) {
  process.exit(1)
}
