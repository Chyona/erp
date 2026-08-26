import type { Attachment } from '../types';

async function hashBlob(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashFile(file: File): Promise<string> {
  return hashBlob(file);
}

async function fetchBlobWithTimeout(url: string, timeoutMs = 12000): Promise<Blob> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`无法读取附件（HTTP ${res.status}）`);
    }
    return await res.blob();
  } finally {
    window.clearTimeout(timer);
  }
}

async function hashAttachmentContent(att: Attachment): Promise<string> {
  const blob = await fetchBlobWithTimeout(att.url);
  return hashBlob(blob);
}

/** 在当前凭证已有附件中查找与待上传文件内容相同的项（先比大小，再比 SHA-256）。 */
export async function findDuplicateAttachment(
  file: File,
  attachments: Attachment[]
): Promise<Attachment | null> {
  if (!attachments.length) return null;

  const candidates = attachments.filter((att) => Number(att.size) === file.size);
  if (!candidates.length) return null;

  const fileHash = await hashFile(file);
  for (const att of candidates) {
    try {
      const attHash = await hashAttachmentContent(att);
      if (attHash === fileHash) return att;
    } catch {
      // 单条读取失败时不阻断其余比对
    }
  }
  return null;
}

export function duplicateAttachmentMessage(fileName: string): string {
  return `附件「${fileName}」已存在，已跳过`;
}

export class AttachmentDuplicateError extends Error {
  readonly fileName: string;

  constructor(fileName: string) {
    super(duplicateAttachmentMessage(fileName));
    this.name = 'AttachmentDuplicateError';
    this.fileName = fileName;
  }
}

export function isAttachmentDuplicateError(err: unknown): err is AttachmentDuplicateError {
  return err instanceof AttachmentDuplicateError;
}
