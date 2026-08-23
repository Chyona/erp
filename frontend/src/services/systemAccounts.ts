/**
 * 系统用户管理 API（/openapi/erp/v1/users，仅管理员）。
 */
import { ApiError } from './apiClient';
import { getStoredToken } from '../context/AuthContext';
import { sanitizeUserMessage, toUserMessage } from '../utils/userMessage';
import type { Role } from '../utils/permissions';

const BASE = '/openapi/erp/v1';

export type SystemAccount = {
  id: number;
  username: string;
  email: string;
  nickname: string;
  phone?: string;
  remark?: string;
  role: Role | string;
  status: number;
  must_change_password?: boolean;
  created_at?: string;
  updated_at?: string;
};

type ApiBody<T> = { code: number; message: string; data: T };

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getStoredToken();
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch (err) {
    throw new ApiError(toUserMessage(err, '无法连接服务器，请确认网络或后端服务是否正常'));
  }
  let json: ApiBody<T>;
  try {
    json = (await res.json()) as ApiBody<T>;
  } catch {
    throw new ApiError(res.ok ? '服务器返回了无法识别的内容' : `请求失败（${res.status}）`);
  }
  if (!res.ok || json.code !== 0) {
    throw new ApiError(
      sanitizeUserMessage(json.message || '请求失败'),
      json.code ?? res.status
    );
  }
  return json.data;
}

export async function listSystemAccounts(page = 1, pageSize = 100) {
  return request<{
    list: SystemAccount[];
    total: number;
    page: number;
    page_size: number;
  }>('GET', `/users?page=${page}&page_size=${pageSize}`);
}

export async function createSystemAccount(input: {
  username: string;
  email?: string;
  password: string;
  nickname?: string;
  role: Role;
}) {
  return request<SystemAccount>('POST', '/users', input);
}

export async function updateSystemAccount(
  id: number,
  input: {
    nickname?: string;
    email?: string;
    phone?: string;
    remark?: string;
    role?: Role;
    status?: number;
  }
) {
  return request<SystemAccount>('PUT', `/users/${id}`, input);
}

export async function deleteSystemAccount(id: number) {
  return request<null>('DELETE', `/users/${id}`);
}

export async function resetSystemAccountPassword(id: number, password: string) {
  return request<SystemAccount>('POST', `/users/${id}/reset-password`, { password });
}
