/**
 * 用户功能测试脚本
 * 该脚本测试用户相关功能，包括用户的CRUD操作、认证和权限
 */
import { userModel, roleModel, permissionModel } from '../src/models/index.js'
import { initTestEnv, testRunner, cleanupTestData } from './test-utils.js'

// 初始化测试环境
await initTestEnv()

console.log('🧪 开始用户功能测试...')

// 测试用户创建
await testRunner.test('创建用户', async () => {
  const testUser = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'password123',
    first_name: 'Test',
    last_name: 'User'
  }

  const user = await userModel.createUser(testUser)

  testRunner.assert(user, '用户应该被创建')
  testRunner.assertEqual(user.username, testUser.username, '用户名应该匹配')
  testRunner.assertEqual(user.email, testUser.email, '邮箱应该匹配')
  testRunner.assertEqual(user.first_name, testUser.first_name, '名字应该匹配')
  testRunner.assertEqual(user.last_name, testUser.last_name, '姓氏应该匹配')
  testRunner.assertEqual(user.status, 'active', '用户状态应该是激活的')
  testRunner.assert(!user.password_hash, '返回的用户不应该包含密码哈希')

  console.log(`   创建的用户ID: ${user.id}`)
})

// 测试重复用户创建（用户名和邮箱唯一性）
await testRunner.test('重复用户创建应该失败', async () => {
  const duplicateUser = {
    username: 'testuser', // 与上面创建的用户相同
    email: 'new@example.com',
    password: 'password123'
  }

  try {
    await userModel.createUser(duplicateUser)
    testRunner.assert(false, '应该因为重复用户名而失败')
  } catch (error) {
    testRunner.assert(error.message.includes('用户名已存在'), '错误消息应该提及用户名已存在')
  }

  const duplicateEmail = {
    username: 'newuser',
    email: 'test@example.com', // 与上面创建的用户相同
    password: 'password123'
  }

  try {
    await userModel.createUser(duplicateEmail)
    testRunner.assert(false, '应该因为重复邮箱而失败')
  } catch (error) {
    testRunner.assert(error.message.includes('邮箱已存在'), '错误消息应该提及邮箱已存在')
  }
})

// 测试用户认证
await testRunner.test('用户认证', async () => {
  // 使用用户名认证
  const userByUsername = await userModel.authenticate('testuser', 'password123')
  testRunner.assert(userByUsername, '应该能使用用户名认证')
  testRunner.assertEqual(userByUsername.username, 'testuser', '认证后返回的用户名应该匹配')

  // 使用邮箱认证
  const userByEmail = await userModel.authenticate('test@example.com', 'password123')
  testRunner.assert(userByEmail, '应该能使用邮箱认证')
  testRunner.assertEqual(userByEmail.username, 'testuser', '认证后返回的用户名应该匹配')

  // 错误密码
  try {
    await userModel.authenticate('testuser', 'wrongpassword')
    testRunner.assert(false, '应该因为错误密码而失败')
  } catch (error) {
    testRunner.assert(error.message.includes('密码错误'), '错误消息应该提及密码错误')
  }

  // 不存在的用户
  try {
    await userModel.authenticate('nonexistentuser', 'password123')
    testRunner.assert(false, '应该因为用户不存在而失败')
  } catch (error) {
    testRunner.assert(error.message.includes('用户不存在'), '错误消息应该提及用户不存在')
  }
})

// 测试用户更新
await testRunner.test('更新用户', async () => {
  const user = await userModel.findByUsername('testuser')

  const updateData = {
    first_name: 'Updated',
    last_name: 'Name',
    avatar_url: 'https://example.com/avatar.jpg'
  }

  const updatedUser = await userModel.updateUser(user.id, updateData)

  testRunner.assert(updatedUser, '用户应该被更新')
  testRunner.assertEqual(updatedUser.first_name, updateData.first_name, '名字应该被更新')
  testRunner.assertEqual(updatedUser.last_name, updateData.last_name, '姓氏应该被更新')
  testRunner.assertEqual(updatedUser.avatar_url, updateData.avatar_url, '头像应该被更新')

  // 验证密码更新
  const passwordUpdate = {
    password: 'newpassword456'
  }

  await userModel.updateUser(user.id, passwordUpdate)

  // 验证新密码能够认证
  const authenticatedUser = await userModel.authenticate('testuser', 'newpassword456')
  testRunner.assert(authenticatedUser, '用户应该使用新密码认证成功')
})

// 测试用户查找
await testRunner.test('查找用户', async () => {
  // 通过用户名查找
  const userByUsername = await userModel.findByUsername('testuser')
  testRunner.assert(userByUsername, '应该能通过用户名找到用户')
  testRunner.assertEqual(userByUsername.username, 'testuser', '找到的用户名应该匹配')

  // 通过邮箱查找
  const userByEmail = await userModel.findByEmail('test@example.com')
  testRunner.assert(userByEmail, '应该能通过邮箱找到用户')
  testRunner.assertEqual(userByEmail.email, 'test@example.com', '找到的邮箱应该匹配')

  // 通过ID查找
  const user = await userModel.findByUsername('testuser')
  const userById = await userModel.findById(user.id)
  testRunner.assert(userById, '应该能通过ID找到用户')
  testRunner.assertEqual(userById.id, user.id, '找到的用户ID应该匹配')
})

// 测试用户列表和搜索
await testRunner.test('用户列表和搜索', async () => {
  // 创建多个用户用于测试列表
  const users = [
    { username: 'user1', email: 'user1@example.com', password: 'password' },
    { username: 'user2', email: 'user2@example.com', password: 'password' },
    { username: 'user3', email: 'user3@example.com', password: 'password' }
  ]

  for (const user of users) {
    await userModel.createUser(user)
  }

  // 测试用户列表
  const userList = await userModel.getUserList()
  testRunner.assert(userList.users.length >= 4, '用户列表应该至少包含4个用户') // admin + testuser + 3 users

  // 测试分页
  const pagedList = await userModel.getUserList({}, 1, 2)
  testRunner.assertEqual(pagedList.users.length, 2, '分页应该限制每页用户数')
  testRunner.assertEqual(pagedList.pagination.limit, 2, '分页限制应该是2')

  // 测试搜索
  const searchResult = await userModel.getUserList({}, 1, 10, 'user1')
  testRunner.assert(
    searchResult.users.some((u) => u.username === 'user1'),
    '搜索结果应该包含user1'
  )
  testRunner.assert(!searchResult.users.some((u) => u.username === 'user2'), '搜索结果不应该包含user2')
})

// 测试用户状态切换
await testRunner.test('切换用户状态', async () => {
  const user = await userModel.findByUsername('user1')

  // 切换状态到inactive
  const updatedUser = await userModel.toggleStatus(user.id)
  testRunner.assertEqual(updatedUser.status, 'inactive', '用户状态应该被切换到inactive')

  // 尝试以inactive用户认证
  try {
    await userModel.authenticate('user1', 'password')
    testRunner.assert(false, '应该因为用户不活跃而失败')
  } catch (error) {
    testRunner.assert(error.message.includes('用户已被禁用'), '错误消息应该提及用户已被禁用')
  }

  // 再次切换回active
  const reactivatedUser = await userModel.toggleStatus(user.id)
  testRunner.assertEqual(reactivatedUser.status, 'active', '用户状态应该被切换回active')

  // 现在应该能认证了
  const authenticatedUser = await userModel.authenticate('user1', 'password')
  testRunner.assert(authenticatedUser, '激活后用户应该能认证')
})

// 测试用户软删除和恢复
await testRunner.test('用户软删除和恢复', async () => {
  const user = await userModel.findByUsername('user2')

  // 软删除用户
  const deleted = await userModel.softDeleteUser(user.id)
  testRunner.assert(deleted, '用户应该被软删除')

  // 尝试查找被删除的用户
  const deletedUser = await userModel.findByUsername('user2')
  testRunner.assert(!deletedUser, '软删除的用户不应该被找到')

  // 恢复用户
  const restoredUser = await userModel.restoreUser(user.id)
  testRunner.assert(restoredUser, '用户应该被恢复')
  testRunner.assertEqual(restoredUser.username, 'user2', '恢复的用户名应该匹配')
})

// 测试用户与角色关联
await testRunner.test('用户角色分配', async () => {
  const user = await userModel.findByUsername('user3')
  const userRole = (await roleModel.findOne({ name: 'user' })).id

  // 分配角色给用户
  const assignment = await roleModel.assignRoleToUser(user.id, userRole)
  testRunner.assert(assignment, '角色应该被分配给用户')

  // 检查用户角色
  const userRoles = await roleModel.getUserRoles(user.id)
  testRunner.assert(userRoles.length > 0, '用户应该有角色')
  testRunner.assert(
    userRoles.some((role) => role.name === 'user'),
    '用户应该有user角色'
  )

  // 检查用户是否有特定角色
  const hasRole = await roleModel.hasRole(user.id, 'user')
  testRunner.assert(hasRole, '用户应该有user角色')

  // 移除用户角色
  const removed = await roleModel.removeRoleFromUser(user.id, userRole)
  testRunner.assert(removed, '角色应该从用户中移除')

  // 验证角色已移除
  const hasRoleAfterRemoval = await roleModel.hasRole(user.id, 'user')
  testRunner.assert(!hasRoleAfterRemoval, '用户不应该再有user角色')
})

// 测试用户与权限关联
await testRunner.test('用户权限管理', async () => {
  const user = await userModel.findByUsername('user3')
  const permission = await permissionModel.findOne({ name: 'users:read' })

  // 直接授予用户权限
  const granted = await permissionModel.setUserPermission(user.id, permission.id, 'grant', { reason: '测试授权' })
  testRunner.assert(granted, '权限应该被授予用户')

  // 检查用户权限
  const hasPermission = await permissionModel.hasPermission(user.id, 'users:read')
  testRunner.assert(hasPermission, '用户应该有users:read权限')

  // 拒绝用户权限
  const denied = await permissionModel.setUserPermission(user.id, permission.id, 'deny')
  testRunner.assert(denied, '权限应该被拒绝')

  // 检查权限应该被拒绝
  const hasPermissionAfterDeny = await permissionModel.hasPermission(user.id, 'users:read')
  testRunner.assert(!hasPermissionAfterDeny, '用户不应该有users:read权限（被拒绝）')

  // 移除用户权限
  const removed = await permissionModel.removeUserPermission(user.id, permission.id)
  testRunner.assert(removed, '权限应该从用户中移除')
})

// 测试复杂权限场景：通过角色获取权限
await testRunner.test('通过角色获取权限', async () => {
  const user = await userModel.findByUsername('user3')
  const userRole = (await roleModel.findOne({ name: 'user' })).id
  const configReadPerm = (await permissionModel.findOne({ name: 'config:read' })).id

  // 分配角色给用户
  await roleModel.assignRoleToUser(user.id, userRole)

  // 检查默认情况下用户应该没有config:read权限
  const hasPermBefore = await permissionModel.hasPermission(user.id, 'config:read')
  testRunner.assert(!hasPermBefore, '用户不应该有config:read权限')

  // 为角色分配权限
  await permissionModel.assignPermissionToRole(userRole, configReadPerm)

  // 现在用户应该通过角色继承了这个权限
  const hasPermAfter = await permissionModel.hasPermission(user.id, 'config:read')
  testRunner.assert(hasPermAfter, '用户应该通过角色获得config:read权限')

  // 从角色移除权限
  await permissionModel.removePermissionFromRole(userRole, configReadPerm)

  // 权限应该被移除
  const hasPermFinal = await permissionModel.hasPermission(user.id, 'config:read')
  testRunner.assert(!hasPermFinal, '权限移除后用户不应该有config:read权限')

  // 清理：移除用户角色
  await roleModel.removeRoleFromUser(user.id, userRole)
})

// 测试获取用户权限列表
await testRunner.test('获取用户权限列表', async () => {
  // 使用管理员用户，它应该有多个权限
  const admin = await userModel.findByUsername('admin')

  const permissions = await permissionModel.getUserPermissions(admin.id)
  testRunner.assert(permissions.length > 0, '管理员应该有权限')

  // 检查权限结构
  const firstPerm = permissions[0]
  testRunner.assert(firstPerm.name, '权限应该有名称')
  testRunner.assert(firstPerm.resource, '权限应该有资源')
  testRunner.assert(firstPerm.action, '权限应该有操作')
})

// 输出测试摘要
testRunner.printSummary()

// 清理测试数据
await cleanupTestData()
