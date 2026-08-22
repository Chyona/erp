import { ErpApi } from './erpApi';
import { Voucher } from './voucher';
import { normalizeVoucherFinanceInterestEntries } from '../utils/financeExpenseEntry';
import { canMutateVoucher, normalizeRole } from '../utils/permissions';
import type { Voucher as VoucherRecord } from '../types';

function readAuthForRepair(): { role: string; accountId: number } | null {
  try {
    const raw = localStorage.getItem('erp_auth_user');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { role?: string; accountId?: number };
    return {
      role: normalizeRole(parsed.role),
      accountId: Number(parsed.accountId) || 0
    };
  } catch {
    return null;
  }
}

function recalcTotals(voucher: VoucherRecord) {
  const totals = Voucher.calcTotals(voucher.entries);
  voucher.totalDebit = totals.debit;
  voucher.totalCredit = totals.credit;
  voucher.checksum = Voucher.generateChecksum(voucher);
}

/** 修复已入库凭证中 5603 利息误记借方的问题（仅修复当前账号有权修改的凭证）。 */
export async function repairFinanceInterestEntries() {
  const auth = readAuthForRepair();
  // 只读或未登录：不写库
  if (!auth || auth.role === 'readonly') return 0;

  const vouchers = await ErpApi.getAll('vouchers');
  const toSave: VoucherRecord[] = [];

  for (const voucher of vouchers) {
    if (voucher.isProfitLossClosing || voucher.isTaxExemptionCarryForward) continue;
    if (voucher.status === Voucher.STATUS.LOCKED) continue;
    if (!canMutateVoucher(auth.role, auth.accountId, voucher)) continue;

    const normalized = normalizeVoucherFinanceInterestEntries(voucher);
    if (normalized === voucher) continue;

    recalcTotals(normalized);
    normalized.updatedAt = new Date().toISOString();
    toSave.push(normalized);
  }

  if (!toSave.length) return 0;

  try {
    await ErpApi.putMany('vouchers', toSave);
  } catch {
    // 权限不足等不应阻断进入系统
    return 0;
  }

  const repaired = toSave.length;
  if (repaired > 0) {
    try {
      await ErpApi.addAuditLog('修复', '财务费用利息分录', `已纠正 ${repaired} 张凭证`);
    } catch {
      // 审计失败不影响修复结果
    }
  }

  return repaired;
}
