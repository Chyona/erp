import { ErpApi } from './erpApi';
import { Voucher } from './voucher';
import { normalizeVoucherFinanceInterestEntries } from '../utils/financeExpenseEntry';
import type { Voucher as VoucherRecord } from '../types';

function recalcTotals(voucher: VoucherRecord) {
  const totals = Voucher.calcTotals(voucher.entries);
  voucher.totalDebit = totals.debit;
  voucher.totalCredit = totals.credit;
  voucher.checksum = Voucher.generateChecksum(voucher);
}

/** 修复已入库凭证中 5603 利息误记借方的问题 */
export async function repairFinanceInterestEntries() {
  const vouchers = await ErpApi.getAll('vouchers');
  const toSave: VoucherRecord[] = [];

  for (const voucher of vouchers) {
    if (voucher.isProfitLossClosing || voucher.isTaxExemptionCarryForward) continue;
    if (voucher.status === Voucher.STATUS.LOCKED) continue;

    const normalized = normalizeVoucherFinanceInterestEntries(voucher);
    if (normalized === voucher) continue;

    recalcTotals(normalized);
    normalized.updatedAt = new Date().toISOString();
    toSave.push(normalized);
  }

  await ErpApi.putMany('vouchers', toSave);
  const repaired = toSave.length;

  if (repaired > 0) {
    await ErpApi.addAuditLog('修复', '财务费用利息分录', `已纠正 ${repaired} 张凭证`);
  }

  return repaired;
}
