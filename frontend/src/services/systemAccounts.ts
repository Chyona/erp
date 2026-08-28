/**
 * 系统用户管理 API（/openapi/erp/v1/users，仅管理员）。
 */
import { apiRequest } from './apiClient';
import type { Role } from '../utils/permissions';

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

export async function listSystemAccounts(page = 1, pageSize = 100) {
  return apiRequest<{
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
  return apiRequest<SystemAccount>('POST', '/users', input);
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
  return apiRequest<SystemAccount>('PUT', `/users/${id}`, input);
}

export async function deleteSystemAccount(id: number) {
  return apiRequest<null>('DELETE', `/users/${id}`);
}

export async function resetSystemAccountPassword(id: number, password: string) {
  return apiRequest<SystemAccount>('POST', `/users/${id}/reset-password`, { password });
}
