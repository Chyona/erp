/** 附件文件名：凭证字号_摘要_金额.扩展名 */

function getFileExtension(fileName) {
  const match = String(fileName || '').match(/(\.[^.]+)$/);
  return match ? match[1].toLowerCase() : '';
}

function sanitizePart(str, maxLen = 48) {
  return String(str || '')
    .replace(/[\\/:*?"<>|\r\n]/g, '')
    .replace(/\s+/g, '')
    .slice(0, maxLen);
}

function pickSummary(entries = []) {
  const withSummary = entries.find((e) => e.summary?.trim());
  return withSummary?.summary?.trim() || '无摘要';
}

function pickAmount(totals: { debit?: number | string; credit?: number | string } = {}) {
  const amount = Math.max(parseFloat(String(totals.debit)) || 0, parseFloat(String(totals.credit)) || 0);
  return amount > 0 ? amount.toFixed(2) : '0.00';
}

export function buildAttachmentFileName({
  voucherNo,
  entries = [],
  totals = {},
  originalName = '',
  index = 0
}) {
  const ext = getFileExtension(originalName) || '.dat';
  const noPart = sanitizePart(voucherNo || '记-草稿', 24);
  const summaryPart = sanitizePart(pickSummary(entries), 48);
  const amountPart = pickAmount(totals);
  const suffix = index > 0 ? `_${index + 1}` : '';
  return `${noPart}_${summaryPart}_${amountPart}${suffix}${ext}`;
}
