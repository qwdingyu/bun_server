/**
 * 用户批量接口路由测试。
 *
 * 防止 /batch 被动态 /:id 路由抢匹配，并验证批量状态更新与软删除的最小闭环。
 */
import { Hono } from 'hono'
import userRoutes from '../src/routes/users.js'
import { initTestEnv, testRunner, cleanupTestData } from './test-utils.js'
import { roleModel, userModel } from '../src/models/index.js'
import { generateTokenPair } from '../src/utils/jwt/index.js'

await initTestEnv()

console.log('🧪 开始用户批量接口测试...')

const unique = String(Date.now()).slice(-6)
const superAdmin = await userModel.createUser({
  username: `testsuper${unique}`,
  email: `testsuper${unique}@example.com`,
  password: 'password123'
})
const targetOne = await userModel.createUser({
  username: `testbatcha${unique}`,
  email: `testbatcha${unique}@example.com`,
  password: 'password123'
})
const targetTwo = await userModel.createUser({
  username: `testbatchb${unique}`,
  email: `testbatchb${unique}@example.com`,
  password: 'password123'
})

const superAdminRole = await roleModel.findOne({ name: 'super_admin' })
await roleModel.assignRoleToUser(superAdmin.id, superAdminRole.id)

const tokenPair = generateTokenPair(superAdmin)
const app = new Hono()
app.route('/api/users', userRoutes)

await testRunner.test('批量更新状态命中静态路由并成功执行', async () => {
  const response = await app.request('/api/users/batch/update-status', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenPair.accessToken}`
    },
    body: JSON.stringify({ userIds: [targetOne.id, targetTwo.id], status: 'inactive' })
  })

  const body = await response.json()
  testRunner.assertStatus(response, 200, `批量更新状态应该成功: ${JSON.stringify(body)}`)
  testRunner.assertEqual(body.data.affected, 2, '应该更新两个用户')

  const updated = await userModel.findById(targetOne.id)
  testRunner.assertEqual(updated.status, 'inactive', '目标用户状态应被更新')
})

await testRunner.test('批量删除命中静态路由并执行软删除', async () => {
  const response = await app.request('/api/users/batch', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenPair.accessToken}`
    },
    body: JSON.stringify({ userIds: [targetOne.id, targetTwo.id] })
  })

  const body = await response.json()
  testRunner.assertStatus(response, 200, `批量删除应该成功: ${JSON.stringify(body)}`)
  testRunner.assertEqual(body.data.affected, 2, '应该软删除两个用户')

  const deleted = await userModel.findById(targetTwo.id, [...userModel.safeFields, 'deleted_at'])
  testRunner.assert(deleted.deleted_at, '目标用户应有软删除时间')
})

await cleanupTestData()
testRunner.printSummary()

if (testRunner.failed > 0) {
  process.exit(1)
}
