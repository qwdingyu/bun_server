const ADMIN_MENU_TREE = [
  {
    key: 'dashboard',
    title: '控制台',
    path: '/dashboard',
    icon: 'dashboard',
    permission: null,
    buttons: []
  },
  {
    key: 'users',
    title: '用户管理',
    path: '/users',
    icon: 'users',
    permission: 'users:read',
    buttons: [
      { key: 'create', title: '新增用户', permission: 'users:create' },
      { key: 'update', title: '编辑用户', permission: 'users:update' },
      { key: 'delete', title: '删除用户', permission: 'users:delete' },
      { key: 'batch-update-status', title: '批量改状态', permission: 'users:update' },
      { key: 'batch-delete', title: '批量删除', permission: 'users:delete' }
    ]
  },
  {
    key: 'roles',
    title: '角色管理',
    path: '/roles',
    icon: 'shield',
    permission: 'roles:read',
    buttons: [
      { key: 'create', title: '新增角色', permission: 'roles:create' },
      { key: 'update', title: '编辑角色', permission: 'roles:update' },
      { key: 'delete', title: '删除角色', permission: 'roles:delete' }
    ]
  },
  {
    key: 'permissions',
    title: '权限管理',
    path: '/permissions',
    icon: 'key',
    permission: 'permissions:read',
    buttons: [
      { key: 'create', title: '新增权限', permission: 'permissions:create' },
      { key: 'update', title: '编辑权限', permission: 'permissions:update' },
      { key: 'delete', title: '删除权限', permission: 'permissions:delete' }
    ]
  },
  {
    key: 'settings',
    title: '系统配置',
    path: '/settings',
    icon: 'settings',
    permission: 'config:read',
    buttons: [{ key: 'update', title: '保存配置', permission: 'config:update' }]
  }
]

function canAccess(permission, permissionSet) {
  return !permission || permissionSet.has(permission)
}

export function buildUserMenuTree(permissionNames = []) {
  const permissionSet = new Set(permissionNames)

  return ADMIN_MENU_TREE.filter((menu) => canAccess(menu.permission, permissionSet)).map((menu) => ({
    ...menu,
    buttons: menu.buttons.filter((button) => canAccess(button.permission, permissionSet))
  }))
}

export function getAdminMenuMetadata() {
  return ADMIN_MENU_TREE
}
