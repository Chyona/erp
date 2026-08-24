/**
 * Mock 服务端备份列表（内存，最多 5 条）。
 */
import { erpMockStore, mockId, type MockVoucher } from './erpStore';

export type MockBackupRecord = {
  id: string;
  name: string;
  createdAt: string;
  size: number;
  source: 'manual' | 'upload';
};

const MAX_BACKUPS = 5;
const backupFiles = new Map<string, string>();
let backupRecords: MockBackupRecord[] = [];

function defaultName() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `b${y}${m}${d}`;
}

function sanitizeName(name?: string) {
  const value = (name || '').trim() || defaultName();
  return value.replace(/[\\/]/g, '_').slice(0, 64);
}

function parseBackup(content: string) {
  const data = JSON.parse(content) as { vouchers?: MockVoucher[]; format?: string; payload?: string };
  if (data.vouchers) return data;
  if (data.format && data.payload) {
    return JSON.parse(content);
  }
  throw new Error('无效的备份文件');
}

function trimOverflow() {
  if (backupRecords.length <= MAX_BACKUPS) return;
  const overflow = backupRecords.slice(MAX_BACKUPS);
  backupRecords = backupRecords.slice(0, MAX_BACKUPS);
  for (const item of overflow) backupFiles.delete(item.id);
}

function addRecord(source: MockBackupRecord['source'], name: string, content: string) {
  const id = mockId();
  const record: MockBackupRecord = {
    id,
    name: sanitizeName(name),
    createdAt: new Date().toISOString(),
    size: Buffer.byteLength(content, 'utf8'),
    source
  };
  backupFiles.set(id, content);
  backupRecords = [record, ...backupRecords];
  trimOverflow();
  return record;
}

export const mockBackupStore = {
  list() {
    return [...backupRecords];
  },

  create(name?: string) {
    const payload = JSON.stringify({
      format: 'erp-backup-v1',
      payload: Buffer.from(JSON.stringify(erpMockStore.exportAll())).toString('base64')
    });
    return addRecord('manual', sanitizeName(name), payload);
  },

  upload(name: string | undefined, content: string) {
    let payload = content;
    try {
      const data = JSON.parse(content) as { vouchers?: unknown; format?: string; payload?: string };
      if (data.format && data.payload) {
        if (!data.payload) throw new Error('无效的备份文件');
      } else if (!data.vouchers) {
        throw new Error('无效的备份文件');
      } else {
        payload = JSON.stringify({
          format: 'erp-backup-v1',
          payload: Buffer.from(content).toString('base64')
        });
      }
    } catch (err) {
      if (err instanceof Error && err.message === '无效的备份文件') throw err;
      throw new Error('无效的备份文件');
    }
    return addRecord('upload', sanitizeName(name), payload);
  },

  rename(id: string, name: string) {
    const idx = backupRecords.findIndex((item) => item.id === id);
    if (idx < 0) throw new Error('备份不存在');
    backupRecords[idx] = { ...backupRecords[idx], name: sanitizeName(name) };
    return backupRecords[idx];
  },

  remove(id: string) {
    backupRecords = backupRecords.filter((item) => item.id !== id);
    backupFiles.delete(id);
  },

  batchRemove(ids: string[]) {
    const set = new Set(ids);
    backupRecords = backupRecords.filter((item) => {
      if (set.has(item.id)) {
        backupFiles.delete(item.id);
        return false;
      }
      return true;
    });
  },

  download(id: string) {
    const record = backupRecords.find((item) => item.id === id);
    const content = backupFiles.get(id);
    if (!record || content == null) throw new Error('备份不存在');
    return { record, content };
  },

  restore(id: string) {
    const content = backupFiles.get(id);
    if (!content) throw new Error('备份不存在');
    const wrapper = JSON.parse(content) as { format?: string; payload?: string };
    let raw = content;
    if (wrapper.payload) {
      raw = Buffer.from(wrapper.payload, 'base64').toString('utf8');
    }
    const data = JSON.parse(raw) as Parameters<typeof erpMockStore.importAll>[0];
    if (!data.vouchers) throw new Error('无效的备份文件');
    erpMockStore.importAll(data);
  }
};
