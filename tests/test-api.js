/**
 * API接口测试脚本
 * 该脚本测试RESTful API接口的功能，包括用户、角色、权限和配置的API
 */
import { Hono } from 'hono'
import { userModel, roleModel, permissionModel } from '../src/models/index.js'
import { verifyToken } from '../src/utils/jwt/index.js'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log('🧪 开始API接口测试...')

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
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(message || `预期 ${JSON.stringify(expected)}, 实际 ${JSON.stringify(actual)}`)
    }
  },

  assertStatus(response, status, message) {
    if (response.status !== status) {
      throw new Error(message || `预期状态码 ${status}, 实际 ${response.status}`)
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

// 创建一个独立的Hono应用实例用于测试
let app
let adminToken
let userToken
let testUserId

// 在测试前初始化应用
async function setupApp() {
  // 导入应用主文件
  const appModule = await import('../src/main.js')
  app = appModule.default

  console.log('📱 应用实例已创建')
  return app
}

// 测试用户认证和获取令牌
await testRunner.test('用户登录和获取JWT令牌', async () => {
  await setupApp()

  // 管理员登录
  const adminLoginResponse = await app.request('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      identifier: 'admin',
      password: 'admin'
    })
  })

  testRunner.assertStatus(adminLoginResponse, 200)
  const adminData = await adminLoginResponse.json()
  testRunner.assert(adminData.success, '登录应该成功')
  testRunner.assert(adminData.data.token, '应该返回JWT令牌')
  adminToken = adminData.data.token
  console.log(`   获取到管理员令牌: ${adminToken.substring(0, 15)}...`)

  // 创建一个测试用户
  const createUserResponse = await app.request('/api/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      username: 'apitest',
      email: 'apitest@example.com',
      password: 'password123',
      first_name: 'API',
      last_name: 'Test'
    })
  })

  testRunner.assertStatus(createUserResponse, 201)
  const userData = await createUserResponse.json()
  testRunner.assert(userData.success, '创建用户应该成功')
  testUserId = userData.data.id
  console.log(`   创建测试用户ID: ${testUserId}`)

  // 测试用户登录
  const userLoginResponse = await app.request('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      identifier: 'apitest',
      password: 'password123'
    })
  })

  testRunner.assertStatus(userLoginResponse, 200)
  const userLoginData = await userLoginResponse.json()
  testRunner.assert(userLoginData.success, '用户登录应该成功')
  testRunner.assert(userLoginData.data.token, '应该返回JWT令牌')
  userToken = userLoginData.data.token
  console.log(`   获取到用户令牌: ${userToken.substring(0, 15)}...`)

  // 验证JWT令牌
  const adminTokenVerify = verifyToken(adminToken)
  testRunner.assert(adminTokenVerify.success, '管理员令牌应该有效')
  testRunner.assertEqual(adminTokenVerify.payload.username, 'admin', '令牌应该包含正确的用户名')

  const userTokenVerify = verifyToken(userToken)
  testRunner.assert(userTokenVerify.success, '用户令牌应该有效')
  testRunner.assertEqual(userTokenVerify.payload.username, 'apitest', '令牌应该包含正确的用户名')
})

// 测试用户API
await testRunner.test('用户API接口', async () => {
  // 获取用户列表（需要管理员权限）
  const listResponse = await app.request('/api/users', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  })

  testRunner.assertStatus(listResponse, 200)
  const listData = await listResponse.json()
  testRunner.assert(listData.success, '获取用户列表应该成功')
  testRunner.assert(Array.isArray(listData.data.users), '应该返回用户数组')
  testRunner.assert(listData.data.users.length > 0, '用户数组不应该为空')

  // 获取单个用户
  const getUserResponse = await app.request(`/api/users/${testUserId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  })

  testRunner.assertStatus(getUserResponse, 200)
  const userData = await getUserResponse.json()
  testRunner.assert(userData.success, '获取用户应该成功')
  testRunner.assertEqual(userData.data.username, 'apitest', '应该返回正确的用户')

  // 没有权限的用户尝试获取用户列表
  const unauthorizedListResponse = await app.request('/api/users', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${userToken}`
    }
  })

  // 注意：具体状态码取决于权限设计，可能是403或401
  testRunner.assert([401, 403].includes(unauthorizedListResponse.status), '无权限的请求应该被拒绝')

  // 更新用户
  const updateResponse = await app.request(`/api/users/${testUserId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      first_name: 'Updated',
      last_name: 'Name'
    })
  })

  testRunner.assertStatus(updateResponse, 200)
  const updateData = await updateResponse.json()
  testRunner.assert(updateData.success, '更新用户应该成功')
  testRunner.assertEqual(updateData.data.first_name, 'Updated', '名字应该被更新')
  testRunner.assertEqual(updateData.data.last_name, 'Name', '姓氏应该被更新')

  // 用户更新自己的信息
  const selfUpdateResponse = await app.request(`/api/users/${testUserId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({
      first_name: 'Self',
      last_name: 'Updated'
    })
  })

  testRunner.assertStatus(selfUpdateResponse, 200)
  const selfUpdateData = await selfUpdateResponse.json()
  testRunner.assert(selfUpdateData.success, '用户更新自己的信息应该成功')

  // 用户尝试更新其他用户的信息（应该失败）
  const otherUsersResponse = await app.request('/api/users/1', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({
      first_name: 'Hacked'
    })
  })

  testRunner.assert([401, 403].includes(otherUsersResponse.status), '用户不应该能更新其他用户')
})

// 测试角色API
await testRunner.test('角色API接口', async () => {
  // 创建新角色（需要管理员权限）
  const createRoleResponse = await app.request('/api/roles', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      name: 'api_test_role',
      display_name: 'API测试角色',
      description: '用于API测试的角色',
      level: 5
    })
  })

  testRunner.assertStatus(createRoleResponse, 201)
  const roleData = await createRoleResponse.json()
  testRunner.assert(roleData.success, '创建角色应该成功')
  const roleId = roleData.data.id
  console.log(`   创建测试角色ID: ${roleId}`)

  // 获取角色列表
  const listRolesResponse = await app.request('/api/roles', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  })

  testRunner.assertStatus(listRolesResponse, 200)
  const listRolesData = await listRolesResponse.json()
  testRunner.assert(listRolesData.success, '获取角色列表应该成功')
  testRunner.assert(Array.isArray(listRolesData.data.roles), '应该返回角色数组')

  // 获取单个角色
  const getRoleResponse = await app.request(`/api/roles/${roleId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  })

  testRunner.assertStatus(getRoleResponse, 200)
  const getRoleData = await getRoleResponse.json()
  testRunner.assert(getRoleData.success, '获取角色应该成功')
  testRunner.assertEqual(getRoleData.data.name, 'api_test_role', '应该返回正确的角色')

  // 为用户分配角色
  const assignRoleResponse = await app.request(`/api/users/${testUserId}/roles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      role_id: roleId
    })
  })

  testRunner.assertStatus(assignRoleResponse, 200)
  const assignRoleData = await assignRoleResponse.json()
  testRunner.assert(assignRoleData.success, '分配角色应该成功')

  // 获取用户的角色
  const userRolesResponse = await app.request(`/api/users/${testUserId}/roles`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  })

  testRunner.assertStatus(userRolesResponse, 200)
  const userRolesData = await userRolesResponse.json()
  testRunner.assert(userRolesData.success, '获取用户角色应该成功')
  testRunner.assert(userRolesData.data.roles.some(role => role.name === 'api_test_role'), '用户应该有测试角色')
})

// 测试权限API
await testRunner.test('权限API接口', async () => {
  // 创建新权限（需要管理员权限）
  const createPermResponse = await app.request('/api/permissions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      name: 'api:test',
      display_name: 'API测试权限',
      description: '用于API测试的权限',
      resource: 'api',
      action: 'test'
    })
  })

  testRunner.assertStatus(createPermResponse, 201)
  const permData = await createPermResponse.json()
  testRunner.assert(permData.success, '创建权限应该成功')
  const permId = permData.data.id
  console.log(`   创建测试权限ID: ${permId}`)

  // 获取权限列表
  const listPermsResponse = await app.request('/api/permissions', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  })

  testRunner.assertStatus(listPermsResponse, 200)
  const listPermsData = await listPermsResponse.json()
  testRunner.assert(listPermsData.success, '获取权限列表应该成功')
  testRunner.assert(Array.isArray(listPermsData.data.permissions), '应该返回权限数组')

  // 获取单个权限
  const getPermResponse = await app.request(`/api/permissions/${permId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  })

  testRunner.assertStatus(getPermResponse, 200)
  const getPermData = await getPermResponse.json()
  testRunner.assert(getPermData.success, '获取权限应该成功')
  testRunner.assertEqual(getPermData.data.name, 'api:test', '应该返回正确的权限')

  // 获取上一个测试中创建的角色ID
  const listRolesResponse = await app.request('/api/roles?search=api_test_role', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  })
  const listRolesData = await listRolesResponse.json()
  const roleId = listRolesData.data.roles.find(role => role.name === 'api_test_role').id

  // 为角色分配权限
  const assignPermResponse = await app.request(`/api/roles/${roleId}/permissions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      permission_id: permId
    })
  })

  testRunner.assertStatus(assignPermResponse, 200)
  const assignPermData = await assignPermResponse.json()
  testRunner.assert(assignPermData.success, '分配权限应该成功')

  // 获取角色的权限
  const rolePermsResponse = await app.request(`/api/roles/${roleId}/permissions`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  })

  testRunner.assertStatus(rolePermsResponse, 200)
  const rolePermsData = await rolePermsResponse.json()
  testRunner.assert(rolePermsData.success, '获取角色权限应该成功')
  testRunner.assert(rolePermsData.data.permissions.some(perm => perm.name === 'api:test'), '角色应该有测试权限')

  // 为用户直接分配权限
  const assignUserPermResponse = await app.request(`/api/users/${testUserId}/permissions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      permission_id: permId,
      permission_type: 'grant'
    })
  })

  testRunner.assertStatus(assignUserPermResponse, 200)
  const assignUserPermData = await assignUserPermResponse.json()
  testRunner.assert(assignUserPermData.success, '为用户分配权限应该成功')

  // 获取用户的权限
  const userPermsResponse = await app.request(`/api/users/${testUserId}/permissions`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  })

  testRunner.assertStatus(userPermsResponse, 200)
  const userPermsData = await userPermsResponse.json()
  testRunner.assert(userPermsData.success, '获取用户权限应该成功')
  testRunner.assert(userPermsData.data.permissions.some(perm => perm.name === 'api:test'), '用户应该有测试权限')
})

// 测试系统配置API
await testRunner.test('系统配置API接口', async () => {
  // 获取所有配置
  const getConfigsResponse = await app.request('/api/config', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  })

  testRunner.assertStatus(getConfigsResponse, 200)
  const configsData = await getConfigsResponse.json()
  testRunner.assert(configsData.success, '获取配置应该成功')
  testRunner.assert(configsData.data.config, '应该返回配置对象')
  testRunner.assert(Object.keys(configsData.data.config).length > 0, '配置对象不应该为空')

  // 设置新配置
  const setConfigResponse = await app.request('/api/config', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      key: 'api.test.config',
      value: 'test value'
    })
  })

  testRunner.assertStatus(setConfigResponse, 200)
  const setConfigData = await setConfigResponse.json()
  testRunner.assert(setConfigData.success, '设置配置应该成功')

  // 获取单个配置
  const getConfigResponse = await app.request('/api/config/api.test.config', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  })

  testRunner.assertStatus(getConfigResponse, 200)
  const getConfigData = await getConfigResponse.json()
  testRunner.assert(getConfigData.success, '获取单个配置应该成功')
  testRunner.assertEqual(getConfigData.data.value, 'test value', '应该返回正确的配置值')

  // 批量设置配置
  const bulkSetResponse = await app.request('/api/config/bulk', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      configs: {
        'api.test.config1': 'value1',
        'api.test.config2': 'value2'
      }
    })
  })

  testRunner.assertStatus(bulkSetResponse, 200)
  const bulkSetData = await bulkSetResponse.json()
  testRunner.assert(bulkSetData.success, '批量设置配置应该成功')

  // 删除配置
  const deleteConfigResponse = await app.request('/api/config/api.test.config', {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  })

  testRunner.assertStatus(deleteConfigResponse, 200)
  const deleteConfigData = await deleteConfigResponse.json()
  testRunner.assert(deleteConfigData.success, '删除配置应该成功')
})

// 测试API响应格式一致性
await testRunner.test('API响应格式一致性', async () => {
  // 测试成功响应格式
  const successResponse = await app.request('/api/health', {
    method: 'GET'
  })

  testRunner.assertStatus(successResponse, 200)
  const successData = await successResponse.json()
  testRunner.assert(successData.hasOwnProperty('success'), '响应应该有success字段')
  testRunner.assert(successData.success === true, 'success字段应该为true')
  testRunner.assert(successData.hasOwnProperty('data'), '响应应该有data字段')

  // 测试错误响应格式
  const errorResponse = await app.request('/api/non-existent-endpoint', {
    method: 'GET'
  })

  testRunner.assert(errorResponse.status >= 400, '不存在的端点应该返回错误状态码')
  const errorData = await errorResponse.json()
  testRunner.assert(errorData.hasOwnProperty('success'), '错误响应应该有success字段')
  testRunner.assert(errorData.success === false, 'success字段应该为false')
  testRunner.assert(errorData.hasOwnProperty('error'), '错误响应应该有error字段')
  testRunner.assert(errorData.error.hasOwnProperty('code'), 'error应该有code字段')
  testRunner.assert(errorData.error.hasOwnProperty('message'), 'error应该有message字段')
})

// 测试API版本控制
await testRunner.test('API版本控制', async () => {
  // 测试无版本号访问
  const noVersionResponse = await app.request('/api/health', {
    method: 'GET'
  })

  testRunner.assertStatus(noVersionResponse, 200)

  // 测试v1版本访问
  const v1Response = await app.request('/api/v1/health', {
    method: 'GET'
  })

  testRunner.assertStatus(v1Response, 200)

  // 测试不存在的版本
  const invalidVersionResponse = await app.request('/api/v999/health', {
    method: 'GET'
  })

  testRunner.assert(invalidVersionResponse.status >= 400, '不存在的API版本应该返回错误')
})

// 输出测试摘要
testRunner.printSummary()
