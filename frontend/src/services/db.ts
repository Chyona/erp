/**
 * 数据存储层 — 全部走后端 API（/openapi/erp/v1）
 */
import type {
  Account,
  Attachment,
  AuditLog,
  ExportData,
  Setting,
  StoreName,
  Voucher
} from '../types';
import { apiRequest, pingBackend } from './apiClient';

type StoreRecordMap = {
  vouchers: Voucher;
  accounts: Account;
  auditLogs: AuditLog;
  settings: Setting;
  attachments: Attachment;
};

const STORE_PATHS: Record<StoreName, string> = {
  accounts: '/accounts',
  vouchers: '/vouchers',
  attachments: '/attachments',
  auditLogs: '/audit-logs',
  settings: '/settings'
};

let opened = false;

async function open(): Promise<void> {
  if (opened) return;
  await pingBackend();
  opened = true;
}

async function getAll<K extends StoreName>(storeName: K): Promise<StoreRecordMap[K][]> {
  await open();
  if (storeName === 'settings') {
    return (await apiRequest<Setting[]>('GET', STORE_PATHS.settings)) as StoreRecordMap[K][];
  }
  if (storeName === 'auditLogs') {
    return (await apiRequest<AuditLog[]>('GET', `${STORE_PATHS.auditLogs}?limit=0`)) as StoreRecordMap[K][];
  }
  return apiRequest<StoreRecordMap[K][]>('GET', STORE_PATHS[storeName]);
}

async function get<K extends StoreName>(
  storeName: K,
  key: string
): Promise<StoreRecordMap[K] | undefined> {
  await open();
  if (storeName === 'settings') {
    const result = await apiRequest<{ key: string; value: unknown }>(
      'GET',
      `${STORE_PATHS.settings}/${encodeURIComponent(key)}`
    );
    return { key: result.key, value: result.value } as StoreRecordMap[K];
  }
  try {
    return await apiRequest<StoreRecordMap[K]>(
      'GET',
      `${STORE_PATHS[storeName]}/${encodeURIComponent(key)}`
    );
  } catch (err) {
    if (err instanceof Error && /不存在|404|not found/i.test(err.message)) {
      return undefined;
    }
    throw err;
  }
}

async function put<K extends StoreName>(
  storeName: K,
  data: StoreRecordMap[K]
): Promise<string> {
  await open();
  if (storeName === 'settings') {
    const setting = data as Setting;
    await apiRequest('PUT', `${STORE_PATHS.settings}/${encodeURIComponent(setting.key)}`, {
      value: setting.value
    });
    return setting.key;
  }
  const record = data as { id: string };
  await apiRequest('PUT', `${STORE_PATHS[storeName]}/${encodeURIComponent(record.id)}`, data);
  return record.id;
}

async function remove(storeName: StoreName, key: string): Promise<void> {
  await open();
  const path =
    storeName === 'settings'
      ? `${STORE_PATHS.settings}/${encodeURIComponent(key)}`
      : `${STORE_PATHS[storeName]}/${encodeURIComponent(key)}`;
  await apiRequest('DELETE', path);
}

async function clear(storeName: StoreName): Promise<void> {
  await open();
  await apiRequest('DELETE', STORE_PATHS[storeName]);
}

/** 生成业务主键（UUID v4）。 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // 极少数旧环境兜底
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function getSetting(key: string): Promise<unknown> {
  await open();
  const result = await apiRequest<{ key: string; value: unknown }>(
    'GET',
    `${STORE_PATHS.settings}/${encodeURIComponent(key)}`
  );
  return result.value ?? null;
}

async function setSetting(key: string, value: unknown): Promise<string> {
  await open();
  await apiRequest('PUT', `${STORE_PATHS.settings}/${encodeURIComponent(key)}`, { value });
  return key;
}

async function addAuditLog(action: string, target: string, details: string): Promise<AuditLog> {
  await open();
  return apiRequest<AuditLog>('POST', STORE_PATHS.auditLogs, { action, target, details });
}

async function exportAll(): Promise<ExportData> {
  await open();
  return apiRequest<ExportData>('GET', '/data/export');
}

async function importAll(data: Partial<ExportData>): Promise<void> {
  await open();
  await apiRequest('POST', '/data/import', {
    version: data.version ?? 1,
    exportedAt: data.exportedAt ?? new Date().toISOString(),
    vouchers: data.vouchers ?? [],
    accounts: data.accounts ?? [],
    auditLogs: data.auditLogs ?? [],
    settings: data.settings ?? [],
    attachments: data.attachments ?? []
  });
}

export const DB = {
  open,
  getAll,
  get,
  put,
  remove,
  clear,
  generateId,
  getSetting,
  setSetting,
  addAuditLog,
  exportAll,
  importAll
};
