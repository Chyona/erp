/**
 * Mock 登录账号与鉴权辅助（仅 VITE_USE_MOCK）。
 */
import type { IncomingMessage } from 'node:http';

export type MockRole = 'admin' | 'user' | 'readonly';

export type MockAuthUser = {
  id: number;
  username: string;
  password: string;
  email: string;
  nickname: string;
  phone?: string;
  remark?: string;
  role: MockRole;
  status: number;
  mustChangePassword: boolean;
};

/** 三角色测试账号（密码与用户名相同） */
export const mockUsers: MockAuthUser[] = [
  {
    id: 1,
    username: 'admin',
    password: 'admin',
    email: 'admin@example.com',
    nickname: '管理员',
    role: 'admin',
    status: 1,
    mustChangePassword: false
  },
  {
    id: 2,
    username: 'user',
    password: 'user',
    email: 'user@example.com',
    nickname: '普通用户',
    role: 'user',
    status: 1,
    mustChangePassword: true
  },
  {
    id: 3,
    username: 'readonly',
    password: 'readonly',
    email: 'readonly@example.com',
    nickname: '只读用户',
    role: 'readonly',
    status: 1,
    mustChangePassword: true
  }
];

export function publicAccount(u: MockAuthUser) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    nickname: u.nickname,
    phone: u.phone || '',
    remark: u.remark || '',
    role: u.role,
    status: u.status,
    must_change_password: u.mustChangePassword
  };
}

export function tokenFor(u: MockAuthUser): string {
  return `mock-token-${u.role}-${u.id}`;
}

export function parseBearer(req: IncomingMessage): { role: MockRole; accountId: number } | null {
  const header = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(header);
  if (!m) return null;
  const token = m[1].trim();
  const parts = /^mock-token-(admin|user|readonly)-(\d+)$/.exec(token);
  if (parts) {
    return { role: parts[1] as MockRole, accountId: Number(parts[2]) };
  }
  if (token === 'mock-token') {
    return { role: 'admin', accountId: 1 };
  }
  return null;
}
