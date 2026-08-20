/**
 * IndexedDB 数据存储层
 */
const DB_NAME = 'AccountingVoucherDB';
const DB_VERSION = 1;
let db = null;

function open() {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    request.onupgradeneeded = (e) => {
      const database = e.target.result;
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

async function getAll(storeName) {
  const database = await open();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function get(storeName, key) {
  const database = await open();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function put(storeName, data) {
  const database = await open();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function remove(storeName, key) {
  const database = await open();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function clear(storeName) {
  const database = await open();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

async function getSetting(key) {
  const result = await get('settings', key);
  return result ? result.value : null;
}

async function setSetting(key, value) {
  return put('settings', { key, value });
}

async function addAuditLog(action, target, details) {
  const log = {
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

async function exportAll() {
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

async function importAll(data) {
  const stores = ['vouchers', 'accounts', 'auditLogs', 'settings', 'attachments'];
  for (const store of stores) {
    await clear(store);
    if (data[store]) {
      for (const item of data[store]) {
        await put(store, item);
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
