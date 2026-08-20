/**
 * IndexedDB 数据存储层
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

const DB_NAME = 'AccountingVoucherDB';
const DB_VERSION = 1;
let db: IDBDatabase | null = null;

type StoreRecordMap = {
  vouchers: Voucher;
  accounts: Account;
  auditLogs: AuditLog;
  settings: Setting;
  attachments: Attachment;
};

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    request.onupgradeneeded = (e) => {
      const database = (e.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains('vouchers')) {
        const vs = database.createObjectStore('vouchers', { keyPath: 'id' });
        vs.createIndex('date', 'date');
        vs.createIndex('status', 'status');
        vs.createIndex('voucherNo', 'voucherNo');
      }
      if (!database.objectStoreNames.contains('accounts')) {
        database.createObjectStore('accounts', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('auditLogs')) {
        const al = database.createObjectStore('auditLogs', { keyPath: 'id' });
        al.createIndex('timestamp', 'timestamp');
      }
      if (!database.objectStoreNames.contains('settings')) {
        database.createObjectStore('settings', { keyPath: 'key' });
      }
      if (!database.objectStoreNames.contains('attachments')) {
        database.createObjectStore('attachments', { keyPath: 'id' });
      }
    };
  });
}

async function getAll<K extends StoreName>(storeName: K): Promise<StoreRecordMap[K][]> {
  const database = await open();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result as StoreRecordMap[K][]);
    req.onerror = () => reject(req.error);
  });
}

async function get<K extends StoreName>(
  storeName: K,
  key: string
): Promise<StoreRecordMap[K] | undefined> {
  const database = await open();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result as StoreRecordMap[K] | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function put<K extends StoreName>(
  storeName: K,
  data: StoreRecordMap[K]
): Promise<IDBValidKey> {
  const database = await open();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function remove(storeName: StoreName, key: string): Promise<void> {
  const database = await open();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function clear(storeName: StoreName): Promise<void> {
  const database = await open();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

async function getSetting(key: string): Promise<unknown> {
  const result = await get('settings', key);
  return result ? result.value : null;
}

async function setSetting(key: string, value: unknown): Promise<IDBValidKey> {
  return put('settings', { key, value });
}

async function addAuditLog(action: string, target: string, details: string): Promise<AuditLog> {
  const log: AuditLog = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    action,
    target,
    details,
    userAgent: navigator.userAgent.slice(0, 100)
  };
  await put('auditLogs', log);
  return log;
}

async function exportAll(): Promise<ExportData> {
  const [vouchers, accounts, auditLogs, settings, attachments] = await Promise.all([
    getAll('vouchers'),
    getAll('accounts'),
    getAll('auditLogs'),
    getAll('settings'),
    getAll('attachments')
  ]);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    vouchers,
    accounts,
    auditLogs,
    settings,
    attachments
  };
}

async function importAll(data: Partial<ExportData>): Promise<void> {
  const stores: StoreName[] = ['vouchers', 'accounts', 'auditLogs', 'settings', 'attachments'];
  for (const store of stores) {
    await clear(store);
    const items = data[store];
    if (items) {
      for (const item of items) {
        await put(store, item as StoreRecordMap[typeof store]);
      }
    }
  }
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
