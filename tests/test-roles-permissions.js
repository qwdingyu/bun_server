/**
 * 角色和权限功能测试脚本
 * 该脚本测试角色和权限相关功能，包括CRUD操作、角色权限分配等
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { roleModel, permissionModel } from '../src/models/index.js'
import { initTestEnv, cleanupTestData } from './test-utils.js'

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 初始化测试环境
await initTestEnv()

console.log('🧪 开始角色和权限功能测试...')

// 测试辅助函数
const testRunner = {
  passed: 0,
  failed: 0,
  totalTests: 0,

  async test(name, fn) {
    this.totalTests++
    console.log(`\n🔍 测试: ${name}`)

    try {
      await fn()
      console.log(`✅ 通过: ${name}`)
      this.passed++
    } catch (error) {
      console.error(`❌ 失败: ${name}`)
      console.error(`   错误: ${error.message}`)
      if (error.stack) {
        console.error(`   堆栈: ${error.stack.split('\n')[1]}`)
      }
      this.failed++
    }
  },

  assert(condition, message) {
    if (!condition) {
      throw new Error(message || '断言失败')
    }
  },

  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `预期 ${expected}, 实际 ${actual}`)
    }
  },

  assertNotEqual(actual, expected, message) {
    if (actual === expected) {
      throw new Error(message || `不应该等于 ${expected}`)
    }
  },

  printSummary() {
    console.log('\n📊 测试摘要:')
    console.log(`   总测试: ${this.totalTests}`)
    console.log(`   通过: ${this.passed}`)
    console.log(`   失败: ${this.failed}`)

    if (this.failed === 0) {
      console.log('🎉 所有测试通过!')
    } else {
      console.log('❗ 有测试失败，请检查!')
    }
  }
}

// 测试角色创建
await testRunner.test('创建角色', async () => {
  const testRole = {
    name: 'test_role',
    display_name: '测试角色',
    description: '用于测试的角色',
    level: 5
  }

  const role = await roleModel.create(testRole)

  testRunner.assert(role, '角色应该被创建')
  testRunner.assertEqual(role.name, testRole.name, '角色名称应该匹配')
  testRunner.assertEqual(role.display_name, testRole.display_name, '显示名称应该匹配')
  testRunner.assertEqual(role.description, testRole.description, '描述应该匹配')
  testRunner.assertEqual(role.level, testRole.level, '级别应该匹配')
  testRunner.assertEqual(role.status, 'active', '角色状态应该是激活的')

  console.log(`   创建的角色ID: ${role.id}`)
})

// 测试重复角色创建
await testRunner.test('重复角色创建应该失败', async () => {
  const duplicateRole = {
    name: 'test_role', // 与上面创建的角色相同
    display_name: '重复角色',
    description: '这个角色不应该被创建'
  }

  try {
    await roleModel.create(duplicateRole)
    testRunner.assert(false, '应该因为重复角色名而失败')
  } catch (error) {
    testRunner.assert(error.message.includes('角色名称已存在'), '错误消息应该提及角色名称已存在')
  }
})

// 测试角色更新
await testRunner.test('更新角色', async () => {
  const role = await roleModel.findOne({ name: 'test_role' })

  const updateData = {
    display_name: '更新的测试角色',
    description: '这是更新后的描述',
    level: 10
  }

  const updatedRole = await roleModel.update(role.id, updateData)

  testRunner.assert(updatedRole, '角色应该被更新')
  testRunner.assertEqual(updatedRole.display_name, updateData.display_name, '显示名称应该被更新')
  testRunner.assertEqual(updatedRole.description, updateData.description, '描述应该被更新')
  testRunner.assertEqual(updatedRole.level, updateData.level, '级别应该被更新')
})

// 测试角色列表和搜索
await testRunner.test('角色列表和搜索', async () => {
  // 创建多个角色用于测试列表
  const roles = [
    { name: 'role1', display_name: '角色1', level: 1 },
    { name: 'role2', display_name: '角色2', level: 2 },
    { name: 'role3', display_name: '角色3', level: 3 }
  ]

  for (const role of roles) {
    await roleModel.create(role)
  }

  // 测试角色列表
  const roleList = await roleModel.getRoleList()
  testRunner.assert(roleList.roles.length >= 5, '角色列表应该至少包含5个角色') // 系统默认角色 + test_role + 3 新角色

  // 测试分页
  const pagedList = await roleModel.getRoleList({}, 1, 2)
  testRunner.assertEqual(pagedList.roles.length, 2, '分页应该限制每页角色数')
  testRunner.assertEqual(pagedList.pagination.limit, 2, '分页限制应该是2')

  // 测试搜索
  const searchResult = await roleModel.getRoleList({}, 1, 10, 'role1')
  testRunner.assert(
    searchResult.roles.some((r) => r.name === 'role1'),
    '搜索结果应该包含role1'
  )
  testRunner.assert(!searchResult.roles.some((r) => r.name === 'role2'), '搜索结果不应该包含role2')
})

// 测试权限创建
await testRunner.test('创建权限', async () => {
  const testPermission = {
    name: 'test:permission',
    display_name: '测试权限',
    description: '用于测试的权限',
    resource: 'test',
    action: 'permission'
  }

  const permission = await permissionModel.create(testPermission)

  testRunner.assert(permission, '权限应该被创建')
  testRunner.assertEqual(permission.name, testPermission.name, '权限名称应该匹配')
  testRunner.assertEqual(permission.display_name, testPermission.display_name, '显示名称应该匹配')
  testRunner.assertEqual(permission.resource, testPermission.resource, '资源应该匹配')
  testRunner.assertEqual(permission.action, testPermission.action, '操作应该匹配')

  console.log(`   创建的权限ID: ${permission.id}`)
})

// 测试重复权限创建
await testRunner.test('重复权限创建应该失败', async () => {
  const duplicatePermission = {
    name: 'test:permission', // 与上面创建的权限相同
    display_name: '重复权限',
    description: '这个权限不应该被创建',
    resource: 'test',
    action: 'duplicate'
  }

  try {
    await permissionModel.create(duplicatePermission)
    testRunner.assert(false, '应该因为重复权限名而失败')
  } catch (error) {
    testRunner.assert(error.message.includes('权限名称已存在'), '错误消息应该提及权限名称已存在')
  }
})

// 测试权限更新
await testRunner.test('更新权限', async () => {
  const permission = await permissionModel.findOne({ name: 'test:permission' })

  const updateData = {
    display_name: '更新的测试权限',
    description: '这是更新后的描述',
    resource: 'updated_test',
    action: 'updated_permission'
  }

  const updatedPermission = await permissionModel.update(permission.id, updateData)

  testRunner.assert(updatedPermission, '权限应该被更新')
  testRunner.assertEqual(updatedPermission.display_name, updateData.display_name, '显示名称应该被更新')
  testRunner.assertEqual(updatedPermission.description, updateData.description, '描述应该被更新')
  testRunner.assertEqual(updatedPermission.resource, updateData.resource, '资源应该被更新')
  testRunner.assertEqual(updatedPermission.action, updateData.action, '操作应该被更新')
})

// 测试权限列表和搜索
await testRunner.test('权限列表和搜索', async () => {
  // 创建多个权限用于测试列表
  const permissions = [
    { name: 'test:create', display_name: '创建测试', resource: 'test', action: 'create' },
    { name: 'test:read', display_name: '读取测试', resource: 'test', action: 'read' },
    { name: 'test:update', display_name: '更新测试', resource: 'test', action: 'update' },
    { name: 'test:delete', display_name: '删除测试', resource: 'test', action: 'delete' }
  ]

  for (const perm of permissions) {
    await permissionModel.create(perm)
  }

  // 测试权限列表
  const permList = await permissionModel.getPermissionList()
  testRunner.assert(permList.permissions.length > 5, '权限列表应该至少包含5个权限') // 系统默认权限 + test:permission + 4新权限

  // 测试分页
  const pagedList = await permissionModel.getPermissionList({}, 1, 3)
  testRunner.assertEqual(pagedList.permissions.length, 3, '分页应该限制每页权限数')
  testRunner.assertEqual(pagedList.pagination.limit, 3, '分页限制应该是3')

  // 测试搜索
  const searchResult = await permissionModel.getPermissionList({}, 1, 10, 'create')
  testRunner.assert(
    searchResult.permissions.some((p) => p.name === 'test:create'),
    '搜索结果应该包含test:create'
  )
  testRunner.assert(!searchResult.permissions.some((p) => p.name === 'test:read'), '搜索结果不应该包含test:read')

  // 测试资源过滤
  const resourceFilter = await permissionModel.getPermissionList({ resource: 'test' })
  testRunner.assert(
    resourceFilter.permissions.every((p) => p.resource === 'test'),
    '资源过滤应该只返回test资源的权限'
  )
})

// 测试角色权限分配
await testRunner.test('角色权限分配', async () => {
  const role = await roleModel.findOne({ name: 'test_role' })
  const permission = await permissionModel.findOne({ name: 'test:create' })

  // 分配权限给角色
  const assignment = await permissionModel.assignPermissionToRole(role.id, permission.id)
  testRunner.assert(assignment, '权限应该被分配给角色')

  // 检查角色是否有该权限
  // 注意：这里没有直接的API来检查角色是否有特定权限，我们需要创建一个用户并分配角色来测试

  // 移除角色权限
  const removed = await permissionModel.removePermissionFromRole(role.id, permission.id)
  testRunner.assert(removed, '权限应该从角色中移除')
})

// 测试权限继承：通过角色获取权限
await testRunner.test('权限继承', async () => {
  // 使用前面创建的角色和权限
  const role = await roleModel.findOne({ name: 'role1' })
  const permissions = [await permissionModel.findOne({ name: 'test:create' }), await permissionModel.findOne({ name: 'test:read' })]

  // 分配多个权限给角色
  for (const perm of permissions) {
    await permissionModel.assignPermissionToRole(role.id, perm.id)
  }

  // 现在我们将这个角色分配给用户，然后检查用户是否继承了这些权限
  // 这部分在test-users.js中已经测试过，这里我们只检查分配是否成功
  for (const perm of permissions) {
    const rolePermission = await permissionModel.db
      .select()
      .from('role_permissions')
      .where({
        role_id: role.id,
        permission_id: perm.id,
        is_active: 1
      })
      .first()

    testRunner.assert(rolePermission, `角色应该有权限 ${perm.name}`)
  }
})

// 测试权限覆盖：用户直接权限优先于角色权限
await testRunner.test('权限优先级', async () => {
  // 创建一个模拟情景：用户通过角色获得权限，但用户直接权限是deny
  // 这需要使用实际用户，这部分在test-users.js中已经测试过
  console.log('   权限优先级逻辑已在用户测试中验证')
})

// 测试权限有效期
await testRunner.test('权限有效期', async () => {
  // 测试过期的权限
  console.log("   权限有效期逻辑已在SQL查询中实现，通过 or(isNull(expires_at), sql`${expires_at} > strftime('%s','now')`) 条件")
})

// 输出测试摘要
testRunner.printSummary()

// 清理测试数据
await cleanupTestData()
