/** 附件展示/下载名：凭证字号_摘要_金额.扩展名；COS 对象键使用附件 ID，与此解耦。 */

function getFileExtension(fileName: string) {
  const match = String(fileName || '').match(/(\.[^.]+)$/);
  return match ? match[1].toLowerCase() : '';
}

function sanitizePart(str: string, maxLen = 48) {
  return String(str || '')
    .replace(/[\\/:*?"<>|\r\n]/g, '')
    .replace(/\s+/g, '')
    .slice(0, maxLen);
}

function pickSummary(entries: Array<{ summary?: string }> = []) {
  const withSummary = entries.find((e) => e.summary?.trim());
  return withSummary?.summary?.trim() || '无摘要';
}

function pickAmount(totals: { debit?: number | string; credit?: number | string } = {}) {
  const amount = Math.max(parseFloat(String(totals.debit)) || 0, parseFloat(String(totals.credit)) || 0);
  return amount > 0 ? amount.toFixed(2) : '0.00';
}

export type AttachmentNameContext = {
  voucherNo?: string;
  entries?: Array<{ summary?: string }>;
  totals?: { debit?: number | string; credit?: number | string };
};

export function buildAttachmentDisplayName({
  voucherNo,
  entries = [],
  totals = {},
  originalName = '',
  index = 0
}: {
  voucherNo?: string;
  entries?: Array<{ summary?: string }>;
  totals?: { debit?: number | string; credit?: number | string };
  originalName?: string;
  index?: number;
}) {
  const ext = getFileExtension(originalName) || '.dat';
  const noPart = sanitizePart(voucherNo || '记-草稿', 24);
  const summaryPart = sanitizePart(pickSummary(entries), 48);
  const amountPart = pickAmount(totals);
  const suffix = index > 0 ? `_${index + 1}` : '';
  return `${noPart}_${summaryPart}_${amountPart}${suffix}${ext}`;
}

/** @deprecated 使用 buildAttachmentDisplayName */
export const buildAttachmentFileName = buildAttachmentDisplayName;

export function resolveAttachmentDisplayName(
  context: AttachmentNameContext,
  attachment: { name?: string },
  index = 0
) {
  if (!context.voucherNo) return attachment.name || '附件';
  return buildAttachmentDisplayName({
    voucherNo: context.voucherNo,
    entries: context.entries,
    totals: context.totals,
    originalName: attachment.name,
    index
  });
}

export function enrichAttachmentDisplayNames<T extends { name?: string }>(
  context: AttachmentNameContext,
  attachments: T[]
): Array<T & { displayName: string }> {
  return attachments.map((att, index) => ({
    ...att,
    displayName: resolveAttachmentDisplayName(context, att, index)
  }));
}

export function attachmentNameContextFromVoucher(
  voucher: {
    voucherNo?: string;
    entries?: Array<{ summary?: string }>;
    totalDebit?: number;
    totalCredit?: number;
  } | null | undefined
): AttachmentNameContext {
  if (!voucher) return {};
  return {
    voucherNo: voucher.voucherNo,
    entries: voucher.entries,
    totals: { debit: voucher.totalDebit, credit: voucher.totalCredit }
  };
}

/** 跨域 COS 下载时通过 Blob 指定文件名 */
export async function downloadAttachment(url: string, filename: string) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`下载失败（HTTP ${res.status}）`);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}
