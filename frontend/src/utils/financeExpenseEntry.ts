import type { VoucherEntry } from '../types';

function parseMoney(v: unknown) {
  return Math.round((parseFloat(String(v)) || 0) * 100) / 100;
}

function isFinanceInterestText(text: string) {
  return /利息/.test(text);
}

/** 5603 利息收入应记贷方冲减财务费用，不应记借方 */
export function normalizeFinanceInterestEntry(
  entry: VoucherEntry,
  extraText = ''
): VoucherEntry {
  if (entry.accountCode !== '5603') return entry;

  const text = `${entry.summary || ''} ${extraText}`;
  if (!isFinanceInterestText(text)) return entry;

  const debit = parseMoney(entry.debit);
  const credit = parseMoney(entry.credit);

  if (debit > 0 && credit <= 0) {
    return { ...entry, debit: '', credit: debit };
  }

  if (debit < 0 && credit <= 0) {
    return { ...entry, debit: '', credit: Math.abs(debit) };
  }

  return entry;
}

export function normalizeVoucherFinanceInterestEntries<T extends { entries?: VoucherEntry[] }>(
  voucher: T,
  extraText = ''
): T {
  if (!voucher.entries?.length) return voucher;
  const entries = voucher.entries.map((entry) =>
    normalizeFinanceInterestEntry(entry, extraText)
  );
  const changed = entries.some((entry, i) => entry !== voucher.entries![i]);
  return changed ? { ...voucher, entries } : voucher;
}
