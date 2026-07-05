export const rbacListQuerySchema = {
  type: 'object',
  properties: {
    page: { type: 'integer', minimum: 1, default: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    search: { type: 'string', minLength: 1, maxLength: 100 },
    status: { type: 'string', enum: ['active', 'inactive'] },
    is_system: { type: 'boolean' },
    resource: { type: 'string', minLength: 1, maxLength: 50 },
    action: { type: 'string', minLength: 1, maxLength: 50 }
  },
  additionalProperties: false
}

export const assignRoleSchema = {
  type: 'object',
  properties: {
    roleId: { type: 'integer', minimum: 1 },
    expiresAt: { type: 'integer', minimum: 1 }
  },
  required: ['roleId'],
  additionalProperties: false
}

export const assignPermissionSchema = {
  type: 'object',
  properties: {
    permissionId: { type: 'integer', minimum: 1 }
  },
  required: ['permissionId'],
  additionalProperties: false
}
