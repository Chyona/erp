import type { Account } from '../types';
import { apiRequest } from './apiClient';

/** 轻量校验登录态：任意已登录用户均可访问科目列表。 */
export async function validateSession(): Promise<void> {
  await apiRequest<Account[]>('GET', '/accounts');
}
