/**
 * RBAC 权限优先级专项测试。
 *
 * 验证后台脚手架的最小安全闭环：默认拒绝、角色授权、用户直授、用户显式拒绝。
 */
import { initTestEnv, testRunner, cleanupTestData } from './test-utils.js'
import { permissionModel, roleModel, userModel } from '../src/models/index.js'

await initTestEnv()

console.log('🧪 开始 RBAC 权限优先级测试...')

const unique = String(Date.now()).slice(-6)
const user = await userModel.createUser({
  username: `testrbac${unique}`,
  email: `testrbac${unique}@example.com`,
  password: 'password123'
})

const role = await roleModel.create({
  name: `testrbac_role_${unique}`,
  display_name: 'RBAC测试角色',
  description: '用于验证权限优先级'
})

const permission = await permissionModel.create({
  name: `testrbac:${unique}:read`,
  display_name: 'RBAC测试读取',
  resource: 'testrbac',
  action: 'read'
})

await testRunner.test('默认无权限时拒绝访问', async () => {
  const allowed = await permissionModel.hasPermission(user.id, permission.name)
  testRunner.assertEqual(allowed, false, '未配置任何权限时应默认拒绝')
})

await testRunner.test('角色权限可以授予访问', async () => {
  await roleModel.assignRoleToUser(user.id, role.id)
  await permissionModel.assignPermissionToRole(role.id, permission.id)

  const allowed = await permissionModel.hasPermission(user.id, permission.name)
  testRunner.assertEqual(allowed, true, '用户应通过角色继承权限')
})

await testRunner.test('用户显式 deny 覆盖角色权限', async () => {
  await permissionModel.setUserPermission(user.id, permission.id, 'deny', { reason: '专项测试拒绝优先' })

  const allowed = await permissionModel.hasPermission(user.id, permission.name)
  testRunner.assertEqual(allowed, false, '显式拒绝应覆盖角色授权')
})

await testRunner.test('用户显式 grant 可以恢复访问', async () => {
  await permissionModel.setUserPermission(user.id, permission.id, 'grant', { reason: '专项测试恢复授权' })

  const allowed = await permissionModel.hasPermission(user.id, permission.name)
  testRunner.assertEqual(allowed, true, '显式授权应允许访问')
})

await cleanupTestData()
testRunner.printSummary()

if (testRunner.failed > 0) {
  process.exit(1)
}
