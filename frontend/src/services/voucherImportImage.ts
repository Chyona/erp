import { apiRequest } from './apiClient';

const IMAGE_EXT = /\.(png|jpe?g|webp|bmp|gif)$/i;
const IMAGE_MIME = /^image\//i;

type ProgressFn = (status: string, progress: number) => void;

export function isImportImageFile(file: File | { name?: string; type?: string } | null | undefined) {
  if (!file) return false;
  const name = String(file.name || '');
  const type = String(file.type || '');
  return IMAGE_MIME.test(type) || IMAGE_EXT.test(name);
}

function normalizeCellText(text: string) {
  return String(text || '')
    .replace(/[\u200b\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeHeaderRow(row: string[]) {
  const joined = row.join('');
  return (
    joined.includes('凭证号') ||
    joined.includes('凭证日期') ||
    (joined.includes('摘要') && joined.includes('科目'))
  );
}

async function fileToBase64(file: File): Promise<{ mimeType: string; base64: string }> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return {
    mimeType: file.type || 'image/png',
    base64: btoa(binary)
  };
}

function normalizeRows(rows: string[][]): string[][] {
  const normalized = rows
    .map((row) => (row || []).map((cell) => normalizeCellText(String(cell ?? ''))))
    .filter((row) => row.some(Boolean));
  const maxCols = normalized.reduce((max, row) => Math.max(max, row.length), 0);
  return normalized.map((row) => {
    const next = [...row];
    while (next.length < maxCols) next.push('');
    return next;
  });
}

function finalizeRows(rows: string[][]): string[][] {
  const normalized = normalizeRows(rows);
  if (!normalized.length) {
    throw new Error('未能从截图中识别出表格，请换更清晰的分录表截图，或改用在左侧上传 Excel / CSV 文件');
  }
  if (!normalized.some(looksLikeHeaderRow)) {
    throw new Error(
      '未识别到表头（需含「凭证号」「摘要」「一级科目」等）。请截取完整分录表后重试，或改用在左侧上传 Excel / CSV 文件。'
    );
  }
  return normalized;
}

/**
 * 表格截图 → 二维行：仅走后端视觉大模型。
 */
export async function imageFileToRows(
  file: File,
  onProgress?: ProgressFn
): Promise<{ rows: string[][]; engine: 'llm' }> {
  onProgress?.('正在读取截图…', 8);
  const { mimeType, base64 } = await fileToBase64(file);

  onProgress?.('正在用视觉大模型识别图片中的分录表，请稍候…', 25);
  const data = await apiRequest<{ rows?: string[][]; engine?: string }>(
    'POST',
    '/vouchers/parse-import-image',
    { imageBase64: base64, mimeType }
  );

  const rows = data?.rows || [];
  if (!rows.length) {
    throw new Error('未能从截图中识别出表格，请换更清晰的分录表截图后重试');
  }

  onProgress?.('识别完成，正在整理预览数据…', 90);
  return { rows: finalizeRows(rows), engine: 'llm' };
}
