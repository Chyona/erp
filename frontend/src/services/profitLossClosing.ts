import { DB } from './db';
import { Accounts } from './accounts';
import { Voucher } from './voucher';
import { TaxExemption } from './taxExemption';
import type { Account, Voucher as VoucherRecord, VoucherEntry } from '../types';
import {
  formatReportPeriod,
  reportPeriodEndDate,
  reportPeriodToDateRange,
  taxExemptionPeriodKey,
  voucherInReportPeriod
} from '../utils/reportPeriod';

type ReportPeriod = {
  type: 'month' | 'quarter';
  year: number;
  month?: number;
  quarter?: number;
};

function roundMoney(n: number | string) {
  return Math.round((parseFloat(String(n)) || 0) * 100) / 100;
}

function accountBalance(debit: number, credit: number, direction: Account['direction']) {
  if (direction === 'debit') {
    return roundMoney(debit - credit);
  }
  return roundMoney(credit - debit);
}

function isProfitLossAccount(account: Account) {
  return account.category === '损益' || account.category === '成本';
}

function matchesClosingVoucher(
  voucher: VoucherRecord,
  periodKey: string,
  periodType: 'month' | 'quarter'
) {
  return (
    voucher.isProfitLossClosing === true &&
    voucher.profitLossClosingPeriod === periodKey &&
    (voucher.profitLossClosingPeriodType || 'month') === periodType
  );
}

/** 查找损益结转凭证：优先当季/当月；按季时若三个月均有按月结转则视为已完成 */
function findClosingVoucher(vouchers: VoucherRecord[], period: ReportPeriod, periodKey: string) {
  const exact = vouchers.find((v) => matchesClosingVoucher(v, periodKey, period.type));
  if (exact) return exact;

  if (period.type !== 'quarter' || !period.quarter) return null;

  const startMonth = (period.quarter - 1) * 3 + 1;
  const monthClosings: VoucherRecord[] = [];
  for (let month = startMonth; month < startMonth + 3; month++) {
    const monthKey = `${period.year}-${String(month).padStart(2, '0')}`;
    const found = vouchers.find((v) => matchesClosingVoucher(v, monthKey, 'month'));
    if (found) monthClosings.push(found);
  }
  return monthClosings.length === 3 ? monthClosings[monthClosings.length - 1] : null;
}

/** 报告期是否已完成损益结转（含按季时三个月均有按月结转） */
export function hasProfitLossClosing(vouchers: VoucherRecord[], period: ReportPeriod) {
  const periodKey = taxExemptionPeriodKey(period);
  return Boolean(findClosingVoucher(vouchers, period, periodKey));
}

function buildAccountSums(
  vouchers: VoucherRecord[],
  { fromDate, toDate }: { fromDate?: string; toDate?: string } = {}
) {
  const sums = new Map<string, { debit: number; credit: number }>();
  for (const v of vouchers) {
    const d = v.date;
    if (fromDate && d < fromDate) continue;
    if (toDate && d > toDate) continue;
    for (const e of v.entries || []) {
      if (!e.accountId) continue;
      const cur = sums.get(e.accountId) || { debit: 0, credit: 0 };
      cur.debit += parseFloat(String(e.debit)) || 0;
      cur.credit += parseFloat(String(e.credit)) || 0;
      sums.set(e.accountId, cur);
    }
  }
  return sums;
}

function sumSums(sums: Map<string, { debit: number; credit: number }>, accountId: string) {
  return sums.get(accountId) || { debit: 0, credit: 0 };
}

/** 模拟普票减免结转后 5301 增加的贷方余额，用于一键结转前的损益预览 */
function projectPendingTaxExemptionOnSums(
  endingSums: Map<string, { debit: number; credit: number }>,
  accounts: Account[],
  taxTotal: number
) {
  if (taxTotal <= 0) return endingSums;
  const acc5301 = accounts.find((a) => a.code === '5301');
  if (!acc5301) return endingSums;

  const projected = new Map(endingSums);
  const cur = sumSums(projected, acc5301.id);
  projected.set(acc5301.id, {
    debit: cur.debit,
    credit: roundMoney(cur.credit + taxTotal)
  });
  return projected;
}

function closingEntryAmount(account: Account, balance: number) {
  if (Math.abs(balance) < 0.005) {
    return { debit: 0, credit: 0 };
  }
  if (account.direction === 'credit') {
    return balance > 0
      ? { debit: balance, credit: 0 }
      : { debit: 0, credit: -balance };
  }
  return balance > 0
    ? { debit: 0, credit: balance }
    : { debit: -balance, credit: 0 };
}

function resolveCategoryLabel(account: Account) {
  if (account.category === '成本') return '成本类';
  return account.direction === 'credit' ? '收入类' : '费用类';
}

function buildClosingEntries(
  accounts: Account[],
  endingSums: Map<string, { debit: number; credit: number }>,
  profitAccount: Account,
  periodLabel: string
) {
  const plAccounts = accounts
    .filter(isProfitLossAccount)
    .sort((a, b) => a.code.localeCompare(b.code));

  const lines: Array<{
    account: Account;
    balance: number;
    closingDebit: number;
    closingCredit: number;
    categoryLabel: string;
  }> = [];

  const entries: VoucherEntry[] = [];

  for (const account of plAccounts) {
    const ending = sumSums(endingSums, account.id);
    const balance = accountBalance(ending.debit, ending.credit, account.direction);
    const { debit, credit } = closingEntryAmount(account, balance);
    if (Math.abs(debit) < 0.005 && Math.abs(credit) < 0.005) continue;

    lines.push({
      account,
      balance,
      closingDebit: debit,
      closingCredit: credit,
      categoryLabel: resolveCategoryLabel(account)
    });

    entries.push({
      summary: `${periodLabel}结转损益-${account.name}`,
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
      debit,
      credit
    });
  }

  if (!entries.length) {
    return { lines, entries: [], netProfit: 0 };
  }

  const totalDebit = roundMoney(entries.reduce((sum, e) => sum + (parseFloat(String(e.debit)) || 0), 0));
  const totalCredit = roundMoney(entries.reduce((sum, e) => sum + (parseFloat(String(e.credit)) || 0), 0));

  // 本年利润按总额反映：借方=结转的费用合计，贷方=结转的收入合计（差额即净利润）
  if (Math.abs(totalCredit) >= 0.005) {
    entries.push({
      summary: `${periodLabel}结转损益-本年利润`,
      accountId: profitAccount.id,
      accountCode: profitAccount.code,
      accountName: profitAccount.name,
      debit: totalCredit,
      credit: 0
    });
  }
  if (Math.abs(totalDebit) >= 0.005) {
    entries.push({
      summary: `${periodLabel}结转损益-本年利润`,
      accountId: profitAccount.id,
      accountCode: profitAccount.code,
      accountName: profitAccount.name,
      debit: 0,
      credit: totalDebit
    });
  }

  const netProfit = roundMoney(
    lines.reduce((sum, line) => {
      if (line.account.direction === 'credit') return sum + line.balance;
      return sum - line.balance;
    }, 0)
  );

  return { lines, entries, netProfit };
}

async function getApprovedVouchersUpTo(endDate: string) {
  const vouchers = await Voucher.getAll({ endDate, status: '' });
  return vouchers.filter((v) => v.status !== Voucher.STATUS.DRAFT);
}

export type TaxExemptionPrerequisite = {
  pendingCount: number;
  pendingTaxTotal: number;
  withoutTaxCount: number;
  carryForwardDoneCount: number;
  carryForwardVoucherNo: string | null;
  isReady: boolean;
  blockReason: string;
  warnings: string[];
};

async function getTaxExemptionPrerequisite(period: ReportPeriod): Promise<TaxExemptionPrerequisite> {
  const taxSummary = await TaxExemption.getPeriodSummary(period);
  const pendingCount = taxSummary.ordinaryPending.length;
  const pendingTaxTotal = taxSummary.pendingTaxTotal;
  const withoutTaxCount = taxSummary.ordinaryWithoutTax.length;
  const carryForwardDoneCount = taxSummary.ordinaryDoneVoucherCount;
  const carryForwardVoucherNo =
    taxSummary.exactCarryForwardVoucher?.voucherNo ||
    taxSummary.carryForwardVoucher?.voucherNo ||
    null;

  const warnings: string[] = [];
  if (withoutTaxCount > 0) {
    warnings.push(
      `有 ${withoutTaxCount} 笔普票销售未填写增值税额，无法参与减免结转（不影响其余已填税额的普票）`
    );
  }

  let blockReason = '';
  if (pendingCount > 0) {
    blockReason = `尚有 ${pendingCount} 条普票税额（合计 ¥${pendingTaxTotal.toFixed(2)}）未完成减免结转，请先完成「普票结转」`;
  }

  return {
    pendingCount,
    pendingTaxTotal,
    withoutTaxCount,
    carryForwardDoneCount,
    carryForwardVoucherNo,
    isReady: pendingCount === 0,
    blockReason,
    warnings
  };
}

/** 指定期间损益结转汇总（支持按月 / 按季） */
export async function getPeriodSummary(
  period: ReportPeriod,
  { projectPendingTaxExemption = false }: { projectPendingTaxExemption?: boolean } = {}
) {
  const periodKey = taxExemptionPeriodKey(period);
  const periodLabel = formatReportPeriod(period);
  const [start, end] = reportPeriodToDateRange(period);
  const startDate = start.format('YYYY-MM-DD');
  const endDate = end.format('YYYY-MM-DD');

  const accounts = await Accounts.getAll();
  const profitAccount = accounts.find((a) => a.code === '3103');
  const vouchers = await getApprovedVouchersUpTo(endDate);
  const endingSums = buildAccountSums(vouchers, { toDate: endDate });

  const closingVoucher = findClosingVoucher(vouchers, period, periodKey);

  const draftCount = (await Voucher.getAll()).filter(
    (v) => voucherInReportPeriod(v.date, period) && v.status === Voucher.STATUS.DRAFT
  ).length;

  const taxExemption = await getTaxExemptionPrerequisite(period);

  let sumsForClosing = endingSums;
  if (projectPendingTaxExemption && taxExemption.pendingCount > 0) {
    sumsForClosing = projectPendingTaxExemptionOnSums(
      endingSums,
      accounts,
      taxExemption.pendingTaxTotal
    );
  }

  const { lines, entries, netProfit } = profitAccount
    ? buildClosingEntries(accounts, sumsForClosing, profitAccount, periodLabel)
    : { lines: [], entries: [], netProfit: 0 };

  let blockReason = '';
  if (!profitAccount) {
    blockReason = '缺少 3103 本年利润 科目';
  } else if (closingVoucher) {
    blockReason = `已存在结转凭证 ${closingVoucher.voucherNo}`;
  } else if (!taxExemption.isReady) {
    blockReason = taxExemption.blockReason;
  } else if (draftCount > 0) {
    blockReason = `该期间还有 ${draftCount} 张草稿凭证未审核，请先审核后再结转`;
  } else if (!entries.length) {
    blockReason = '该期间损益类科目无余额，无需结转';
  }

  const staleAfterTaxExemption =
    Boolean(closingVoucher) && !taxExemption.isReady
      ? `损益结转已完成，但仍有 ${taxExemption.pendingCount} 条普票税额待减免结转，5301 等科目可能不准确，建议反结转损益后按「先普票结转 → 再损益结转」重做`
      : '';

  return {
    period,
    periodKey,
    periodLabel,
    startDate,
    endDate,
    closingVoucher,
    draftCount,
    taxExemption,
    staleAfterTaxExemption,
    accountLines: lines,
    previewEntries: entries,
    netProfit,
    canClose: !blockReason,
    blockReason,
    includesProjectedTaxExemption:
      projectPendingTaxExemption && taxExemption.pendingCount > 0
  };
}

/** 生成指定期间结转损益凭证 */
export async function createClosing(period: ReportPeriod, { approve = true } = {}) {
  const summary = await getPeriodSummary(period);

  if (summary.closingVoucher) {
    throw new Error(`${summary.periodLabel} 已存在结转凭证 ${summary.closingVoucher.voucherNo}`);
  }
  if (!summary.taxExemption.isReady) {
    throw new Error(summary.taxExemption.blockReason);
  }
  if (summary.draftCount > 0) {
    throw new Error(`该期间还有 ${summary.draftCount} 张草稿凭证未审核，请先审核后再结转`);
  }
  if (!summary.previewEntries.length) {
    throw new Error(summary.blockReason || '该期间没有可结转的损益发生额');
  }

  const signatory = String((await DB.getSetting('defaultSignatory')) ?? '');

  const voucherData = {
    voucherType: '记',
    date: reportPeriodEndDate(period),
    attachmentCount: 0,
    businessType: '其他',
    invoiceType: '',
    taxAmount: 0,
    isProfitLossClosing: true,
    profitLossClosingPeriodType: period.type,
    profitLossClosingPeriod: summary.periodKey,
    invoiceNumbers: '',
    remark: `${summary.periodLabel}损益结转，共 ${summary.accountLines.length} 个科目`,
    entries: summary.previewEntries,
    attachmentIds: [],
    preparedBy: signatory,
    reviewedBy: signatory,
    postedBy: signatory,
    cashierBy: signatory
  };

  const saved = await Voucher.save(voucherData as import('../types').VoucherInput, approve);

  await DB.addAuditLog(
    approve ? '新建并审核' : '新建草稿',
    '损益结转',
    `${saved.voucherNo} ${summary.periodLabel}，${summary.accountLines.length} 个科目，净利 ${summary.netProfit.toFixed(2)}`
  );

  return {
    voucher: saved,
    accountCount: summary.accountLines.length,
    netProfit: summary.netProfit
  };
}

/** 反结转：删除指定月份的损益结转凭证 */
export async function reverseClosing(period: ReportPeriod, closingId?: string) {
  let cf: VoucherRecord | null = null;
  if (closingId) {
    cf = await Voucher.getById(closingId);
    if (!cf?.isProfitLossClosing) {
      throw new Error('无效的损益结转凭证');
    }
  } else {
    const summary = await getPeriodSummary(period);
    cf = summary.closingVoucher;
  }

  const periodLabel = formatReportPeriod(period);
  if (!cf) {
    throw new Error(`${periodLabel} 不存在损益结转凭证，无法反结转`);
  }

  if (cf.status === Voucher.STATUS.LOCKED) {
    await Voucher.forceRemove(cf.id, { allowCarryForwardBypass: true });
  } else {
    await Voucher.remove(cf.id, { allowCarryForwardBypass: true });
  }

  await DB.addAuditLog('反结转', '损益结转', `删除 ${cf.voucherNo}（${periodLabel}）`);

  return { voucher: cf };
}

/** 普票结转前检查：对应期间是否已损益结转 */
export async function getProfitLossClosingConflictMessage(period: ReportPeriod): Promise<string> {
  if (period.type === 'quarter') {
    const summary = await getPeriodSummary(period);
    if (summary.closingVoucher) {
      return `${summary.periodLabel} 已完成损益结转（${summary.closingVoucher.voucherNo}），本次普票结转将变动 5301，建议先反结转损益后再操作`;
    }
    return '';
  }

  const summary = await getPeriodSummary(period);
  if (summary.closingVoucher) {
    return `${summary.periodLabel} 已完成损益结转（${summary.closingVoucher.voucherNo}），本次普票结转将变动 5301，建议先反结转损益后再操作`;
  }
  return '';
}

export const ProfitLossClosing = {
  getPeriodSummary,
  createClosing,
  reverseClosing,
  getProfitLossClosingConflictMessage,
  hasProfitLossClosing
};
