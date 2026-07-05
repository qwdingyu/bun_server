import { patterns } from '../middleware/validation/index.js'

export const loginSchema = {
  type: 'object',
  properties: {
    identifier: {
      type: 'string',
      minLength: 3,
      maxLength: 100
    },
    password: {
      type: 'string',
      minLength: 6
    }
  },
  required: ['identifier', 'password'],
  additionalProperties: false
}

export const registerSchema = {
  type: 'object',
  properties: {
    username: {
      type: 'string',
      ...patterns.username
    },
    email: {
      type: 'string',
      ...patterns.email
    },
    password: {
      type: 'string',
      minLength: 6,
      maxLength: 128
    },
    first_name: {
      type: 'string',
      minLength: 1,
      maxLength: 50
    },
    last_name: {
      type: 'string',
      minLength: 1,
      maxLength: 50
    }
  },
  required: ['username', 'email', 'password'],
  additionalProperties: false
}

export const updateUserSchema = {
  type: 'object',
  properties: {
    username: {
      type: 'string',
      ...patterns.username
    },
    email: {
      type: 'string',
      ...patterns.email
    },
    password: {
      type: 'string',
      minLength: 6,
      maxLength: 128
    },
    first_name: {
      type: 'string',
      minLength: 1,
      maxLength: 50
    },
    last_name: {
      type: 'string',
      minLength: 1,
      maxLength: 50
    },
    avatar_url: {
      type: 'string',
      ...patterns.url
    },
    status: {
      type: 'string',
      enum: ['active', 'inactive']
    },
    role: {
      type: 'string',
      enum: ['user', 'admin', 'super_admin']
    }
  },
  additionalProperties: false
}

export const refreshTokenSchema = {
  type: 'object',
  properties: {
    refreshToken: {
      type: 'string',
      minLength: 1
    }
  },
  required: ['refreshToken'],
  additionalProperties: false
}

export const userListQuerySchema = {
  type: 'object',
  properties: {
    page: {
      type: 'integer',
      minimum: 1,
      default: 1
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      default: 20
    },
    status: {
      type: 'string',
      enum: ['active', 'inactive']
    },
    search: {
      type: 'string',
      minLength: 1,
      maxLength: 100
    },
    sort: {
      type: 'string',
      enum: ['id', 'username', 'email', 'created_at', 'updated_at'],
      default: 'created_at'
    },
    order: {
      type: 'string',
      enum: ['asc', 'desc'],
      default: 'desc'
    }
  },
  additionalProperties: false
}

export const batchUpdateStatusSchema = {
  type: 'object',
  properties: {
    userIds: {
      type: 'array',
      items: {
        type: 'integer',
        minimum: 1
      },
      minItems: 1,
      maxItems: 100
    },
    status: {
      type: 'string',
      enum: ['active', 'inactive']
    }
  },
  required: ['userIds', 'status'],
  additionalProperties: false
}

export const batchDeleteUsersSchema = {
  type: 'object',
  properties: {
    userIds: {
      type: 'array',
      items: {
        type: 'integer',
        minimum: 1
      },
      minItems: 1,
      maxItems: 50
    }
  },
  required: ['userIds'],
  additionalProperties: false
}
