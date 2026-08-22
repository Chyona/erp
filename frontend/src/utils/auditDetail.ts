import type { Voucher, VoucherEntry } from '../types';

function entrySummaries(entries?: VoucherEntry[], max = 2): string {
  const list = [
    ...new Set((entries || []).map((e) => String(e.summary || '').trim()).filter(Boolean))
  ];
  if (!list.length) return '';
  if (list.length <= max) return list.join('；');
  return `${list.slice(0, max).join('；')}等${list.length}条`;
}

function amountOf(v: Pick<Voucher, 'totalDebit' | 'entries'> | Partial<Voucher>): number {
  const n = Number(v.totalDebit);
  if (Number.isFinite(n) && n > 0) return n;
  return (v.entries || []).reduce((sum, e) => sum + (Number(e.debit) || 0), 0);
}

/** 单张凭证审计详情：号 + 日期 + 摘要 + 金额，便于识别。 */
export function formatVoucherAuditDetail(
  voucher: Partial<Voucher> | null | undefined,
  extra?: string
): string {
  if (!voucher) return extra || '未知凭证';
  const parts: string[] = [];
  const no =
    String(voucher.voucherNo || '').trim() ||
    [voucher.voucherType, voucher.voucherNumber].filter(Boolean).join('-') ||
    '未知凭证';
  parts.push(no);
  if (voucher.date) parts.push(`日期 ${voucher.date}`);
  const summary = entrySummaries(voucher.entries) || String(voucher.remark || '').trim();
  if (summary) parts.push(`摘要「${summary}」`);
  const amt = amountOf(voucher);
  if (amt > 0) parts.push(`金额 ${amt.toFixed(2)}`);
  if (voucher.businessType) parts.push(`业务 ${voucher.businessType}`);
  if (extra) parts.push(extra);
  return parts.join('，');
}

/** 批量操作审计详情：前几张凭证要点 + 总数。 */
export function formatVoucherBatchAuditDetail(
  vouchers: Array<Partial<Voucher>>,
  prefix: string,
  maxList = 5
): string {
  const list = vouchers.slice(0, maxList).map((v) => {
    const no = String(v.voucherNo || '').trim() || '未知';
    const summary = entrySummaries(v.entries, 1);
    const amt = amountOf(v);
    const bits = [no];
    if (v.date) bits.push(v.date);
    if (summary) bits.push(`「${summary}」`);
    if (amt > 0) bits.push(amt.toFixed(2));
    return bits.join(' ');
  });
  const totalHint =
    vouchers.length > maxList ? `等共 ${vouchers.length} 张` : `共 ${vouchers.length} 张`;
  if (!list.length) return `${prefix}（${totalHint}）`;
  return `${prefix}：${list.join('；')}（${totalHint}）`;
}
