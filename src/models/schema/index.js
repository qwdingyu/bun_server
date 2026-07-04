// Dialect-aware schema selector
import { getType } from '../../db/index.js'

let schemaModule
if (getType() === 'mysql') {
  schemaModule = await import('./mysql.js')
} else {
  schemaModule = await import('./sqlite.js')
}

export const {
  users,
  system_config,
  roles,
  permissions,
  user_roles,
  role_permissions,
  user_permissions,
  user_sessions,
  ensureIndexes,
  schema
} = schemaModule

export default schema
