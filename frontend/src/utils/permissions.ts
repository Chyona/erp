export type Role = 'admin' | 'user' | 'readonly';

export type Permission =
  | 'voucher.create'
  | 'voucher.approve'
  | 'voucher.import'
  | 'export'
  | 'backup'
  | 'restore'
  | 'settings'
  | 'users'
  | 'accounts.write'
  | 'closing'
  | 'closing.view'
  | 'audit.view';

export function normalizeRole(role?: string | null): Role {
  if (role === 'admin' || role === 'user' || role === 'readonly') return role;
  return 'user';
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: '管理员',
  user: '普通用户',
  readonly: '只读用户'
};

export function can(role: Role | string | null | undefined, permission: Permission): boolean {
  const r = normalizeRole(role);
  switch (permission) {
    case 'voucher.create':
      return r === 'admin' || r === 'user';
    case 'voucher.approve':
    case 'voucher.import':
    case 'restore':
    case 'settings':
    case 'users':
    case 'accounts.write':
    case 'closing':
      return r === 'admin';
    case 'closing.view':
      return r === 'admin' || r === 'user';
    case 'export':
    case 'backup':
      return r === 'admin' || r === 'user';
    case 'audit.view':
      return true;
    default:
      return false;
  }
}

export function canMutateVoucher(
  role: Role | string | null | undefined,
  accountId: number | null | undefined,
  voucher: { createdByAccountId?: number; status?: string } | null | undefined
): boolean {
  const r = normalizeRole(role);
  if (r === 'readonly') return false;
  if (r === 'admin') return true;
  if (!voucher || !accountId) return false;
  const owner = voucher.createdByAccountId || 0;
  if (!owner || owner !== accountId) return false;
  return voucher.status === 'draft' || !voucher.status;
}
