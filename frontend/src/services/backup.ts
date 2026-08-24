import { apiRequest, apiUploadForm, getApiBase, ApiError } from './apiClient';
import { getStoredToken } from '../context/AuthContext';
import { ExportUtil } from './export';
import type { BackupRecord } from '../types';

const BACKUP_SOURCE_LABEL: Record<string, string> = {
  manual: '手动备份',
  upload: '用户上传'
};

export function formatBackupSource(source: string) {
  return BACKUP_SOURCE_LABEL[source] || source || '手动备份';
}

export function formatBackupSize(size: number) {
  const kb = Math.max(1, Math.round(Number(size || 0) / 1024));
  return `${kb} KB`;
}

async function downloadBinary(path: string, filename: string) {
  const token = getStoredToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${getApiBase()}${path}`, { headers });
  if (!res.ok) {
    let message = `下载失败（${res.status}）`;
    try {
      const json = (await res.json()) as { message?: string };
      if (json.message) message = json.message;
    } catch {
      // ignore
    }
    throw new ApiError(message, res.status);
  }
  const blob = await res.blob();
  ExportUtil.downloadBinaryBlob(blob, filename);
}

export const Backup = {
  list(): Promise<BackupRecord[]> {
    return apiRequest<BackupRecord[]>('GET', '/backups');
  },

  create(name?: string): Promise<BackupRecord> {
    return apiRequest<BackupRecord>('POST', '/backups', { name: name?.trim() || undefined });
  },

  upload(file: File, name?: string): Promise<BackupRecord> {
    const form = new FormData();
    form.append('file', file);
    if (name?.trim()) form.append('name', name.trim());
    return apiUploadForm<BackupRecord>('/backups/upload', form);
  },

  rename(id: string, name: string): Promise<BackupRecord> {
    return apiRequest<BackupRecord>('PUT', `/backups/${encodeURIComponent(id)}`, { name });
  },

  remove(id: string): Promise<void> {
    return apiRequest<void>('DELETE', `/backups/${encodeURIComponent(id)}`);
  },

  batchRemove(ids: string[]): Promise<void> {
    return apiRequest<void>('POST', '/backups/batch-delete', { ids });
  },

  restore(id: string): Promise<void> {
    return apiRequest<void>('POST', `/backups/${encodeURIComponent(id)}/restore`);
  },

  async download(record: BackupRecord) {
    const filename = record.name.endsWith('.bak') ? record.name : `${record.name}.bak`;
    await downloadBinary(`/backups/${encodeURIComponent(record.id)}/download`, filename);
  }
};
