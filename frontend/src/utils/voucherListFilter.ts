import {
  matchSignatory,
  matchVoucherAmount,
  parseCodeRanges,
  parseNumberRanges,
  parseVoucherNum
} from './voucherFilter';
import type { Voucher, VoucherFilters } from '../types';

/** 凭证列表排序：日期倒序 → 字号倒序 */
export function compareVouchersDesc(a: Voucher, b: Voucher) {
  const dateCmp = b.date.localeCompare(a.date);
  if (dateCmp !== 0) return dateCmp;

  const numA = parseVoucherNum(a.voucherNumber);
  const numB = parseVoucherNum(b.voucherNumber);
  if (numB !== numA) return numB - numA;

  return (b.voucherNo || '').localeCompare(a.voucherNo || '');
}

/** 按查凭证列表筛选条件过滤（与后端 list 接口语义一致）。 */
export function applyVoucherFilters(
  vouchers: Voucher[],
  filters: VoucherFilters = {}
): Voucher[] {
  let list = [...vouchers];

  if (filters.startDate) list = list.filter((v) => v.date >= filters.startDate!);
  if (filters.endDate) list = list.filter((v) => v.date <= filters.endDate!);
  if (filters.status) list = list.filter((v) => v.status === filters.status);
  if (filters.voucherType) {
    list = list.filter((v) => v.voucherType === filters.voucherType);
  }

  const numberRanges = parseNumberRanges(filters.voucherNumber || '');
  if (numberRanges) {
    list = list.filter((v) => numberRanges.includes(parseVoucherNum(v.voucherNumber)));
  }

  const summaryKw = (filters.summary || '').trim().toLowerCase();
  if (summaryKw) {
    list = list.filter((v) =>
      v.entries.some((e) => (e.summary || '').toLowerCase().includes(summaryKw))
    );
  }

  const codeRanges = parseCodeRanges(filters.accountCode || '');
  if (codeRanges) {
    list = list.filter((v) =>
      v.entries.some((e) => {
        const code = String(e.accountCode || '').trim();
        return code && codeRanges.includes(code);
      })
    );
  }

  if (filters.amountMin || filters.amountMax) {
    list = list.filter((v) => matchVoucherAmount(v, filters.amountMin, filters.amountMax));
  }

  if (filters.businessType) {
    list = list.filter((v) => v.businessType === filters.businessType);
  }

  if (filters.signatory) {
    list = list.filter((v) => matchSignatory(v, filters.signatory!));
  }

  const remarkKw = (filters.remark || '').trim().toLowerCase();
  if (remarkKw) {
    list = list.filter((v) => (v.remark || '').toLowerCase().includes(remarkKw));
  }

  if (filters.keyword) {
    const kw = filters.keyword.toLowerCase();
    list = list.filter(
      (v) =>
        v.voucherNo.toLowerCase().includes(kw) ||
        (v.remark && v.remark.toLowerCase().includes(kw)) ||
        v.entries.some(
          (e) =>
            e.summary.toLowerCase().includes(kw) ||
            (e.accountName && e.accountName.toLowerCase().includes(kw))
        )
    );
  }

  list.sort(compareVouchersDesc);
  return list;
}

export function paginateVouchers<T>(items: T[], page: number, pageSize: number) {
  const safePage = Math.max(1, page);
  const safeSize = Math.max(1, Math.min(pageSize, 100));
  const total = items.length;
  const start = (safePage - 1) * safeSize;
  return {
    list: start >= total ? [] : items.slice(start, start + safeSize),
    total,
    page: safePage,
    pageSize: safeSize
  };
}
