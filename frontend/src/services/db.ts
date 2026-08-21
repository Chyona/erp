/**
 * 数据存储层 — 全部走后端 API（/openapi/erp/v1）
 *
 * 统一批量入口（单条 = 数组长度 1）：
 *   POST /vouchers/batch     { action: upsert|approve|unapprove|delete, items?|ids? }
 *   POST /accounts/batch     { action: upsert|delete, items?|ids? }
 *   POST /attachments/batch  { action: upsert|delete, items?|ids? }
 *   PUT  /settings/batch     { items: [{ key, value }] }
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

type BatchStore = 'accounts' | 'vouchers' | 'attachments';

const STORE_PATHS: Record<StoreName, string> = {
  accounts: '/accounts',
  vouchers: '/vouchers',
  attachments: '/attachments',
  auditLogs: '/audit-logs',
  settings: '/settings'
};

export type VoucherBatchFailItem = {
  id: string;
  voucherNo?: string;
  message: string;
};

export type VoucherBatchAction = 'upsert' | 'approve' | 'unapprove' | 'delete';

export type VoucherBatchOpResult = {
  action?: VoucherBatchAction;
  approved?: number;
  unapproved?: number;
  deleted?: number;
  skipped: number;
  failed: VoucherBatchFailItem[];
  count?: number;
  items?: Voucher[];
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

function normalizeIds(ids: string | string[]): string[] {
  return [...new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean))];
}

function normalizeItems<T>(items: T | T[]): T[] {
  return Array.isArray(items) ? items : [items];
}

/** 凭证统一批量：upsert / approve / unapprove / delete；传 1 条即单条。 */
async function vouchersBatch(input: {
  action: VoucherBatchAction;
  ids?: string | string[];
  items?: Voucher | Voucher[];
}): Promise<VoucherBatchOpResult> {
  await open();
  const body: { action: VoucherBatchAction; ids?: string[]; items?: Voucher[] } = {
    action: input.action
  };
  if (input.action === 'upsert') {
    body.items = normalizeItems(input.items ?? []);
    if (!body.items.length) {
      return { action: 'upsert', count: 0, items: [], skipped: 0, failed: [] };
    }
  } else {
    body.ids = normalizeIds(input.ids ?? []);
    if (!body.ids.length) {
      return { action: input.action, skipped: 0, failed: [], deleted: 0, approved: 0, unapproved: 0 };
    }
  }
  const result = await apiRequest<VoucherBatchOpResult>('POST', '/vouchers/batch', body);
  return {
    action: result.action ?? input.action,
    approved: result.approved ?? 0,
    unapproved: result.unapproved ?? 0,
    deleted: result.deleted ?? 0,
    skipped: result.skipped ?? 0,
    failed: result.failed ?? [],
    count: result.count,
    items: result.items
  };
}

/** 批量 upsert（accounts / vouchers / attachments）。 */
async function putMany<K extends BatchStore>(
  storeName: K,
  items: StoreRecordMap[K] | StoreRecordMap[K][]
): Promise<void> {
  const list = normalizeItems(items);
  if (!list.length) return;
  await open();
  if (storeName === 'vouchers') {
    await vouchersBatch({ action: 'upsert', items: list as Voucher[] });
    return;
  }
  await apiRequest('POST', `${STORE_PATHS[storeName]}/batch`, {
    action: 'upsert',
    items: list
  });
}

/** 批量删除；凭证删除会附带清关联附件。 */
async function removeMany(
  storeName: BatchStore,
  ids: string | string[]
): Promise<VoucherBatchOpResult | void> {
  const unique = normalizeIds(ids);
  if (!unique.length) {
    return storeName === 'vouchers'
      ? { action: 'delete', deleted: 0, skipped: 0, failed: [] }
      : undefined;
  }
  await open();
  if (storeName === 'vouchers') {
    return vouchersBatch({ action: 'delete', ids: unique });
  }
  await apiRequest('POST', `${STORE_PATHS[storeName]}/batch`, {
    action: 'delete',
    ids: unique
  });
}

async function approveVouchersBatch(ids: string | string[]): Promise<VoucherBatchOpResult> {
  return vouchersBatch({ action: 'approve', ids });
}

async function unapproveVouchersBatch(ids: string | string[]): Promise<VoucherBatchOpResult> {
  return vouchersBatch({ action: 'unapprove', ids });
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

/** 批量写入设置。 */
async function setSettingsBatch(items: Array<{ key: string; value: unknown }>): Promise<void> {
  if (!items.length) return;
  await open();
  await apiRequest('PUT', '/settings/batch', { items });
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
  putMany,
  removeMany,
  vouchersBatch,
  approveVouchersBatch,
  unapproveVouchersBatch,
  remove,
  clear,
  generateId,
  getSetting,
  setSetting,
  setSettingsBatch,
  addAuditLog,
  exportAll,
  importAll
};
