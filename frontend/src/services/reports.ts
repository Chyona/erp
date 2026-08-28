import { Voucher } from './voucher';
import { Accounts } from './accounts';
import { buildVirtualClosingVouchersForReport, hasProfitLossClosing } from './profitLossClosing';
import { formatReportPeriod } from '../utils/reportPeriod';
import type { Account, Voucher as VoucherRecord } from '../types';
import dayjs from 'dayjs';
import {
  BALANCE_SHEET_ASSETS,
  BALANCE_SHEET_LIABILITIES
} from '../constants/balanceSheetTemplate';
import { INCOME_STATEMENT_LINES } from '../constants/incomeStatementTemplate';

function roundMoney(n) {
  return Math.round((parseFloat(n) || 0) * 100) / 100;
}

function accountBalance(debit, credit, direction) {
  if (direction === 'debit') {
    return roundMoney(debit - credit);
  }
  return roundMoney(credit - debit);
}

function blankMoney(v) {
  const n = roundMoney(v);
  return Math.abs(n) < 0.005 ? null : n;
}

/** 按科目性质固定列：借方科目只在借方列、贷方科目只在贷方列，异常余额用负数表示 */
function toDebitCreditColumns(balance, direction) {
  const b = roundMoney(balance);
  if (Math.abs(b) < 0.005) {
    return { debit: null, credit: null };
  }
  if (direction === 'debit') {
    return { debit: b, credit: null };
  }
  return { debit: null, credit: b };
}

async function getVouchersUpTo(endDate: string) {
  return Voucher.getAll({ endDate, status: '' });
}

function isDraftVoucher(v: VoucherRecord) {
  return v.status === Voucher.STATUS.DRAFT;
}

function moneyDiffers(a: number | null | undefined, b: number | null | undefined) {
  const na = a == null ? 0 : roundMoney(a);
  const nb = b == null ? 0 : roundMoney(b);
  return Math.abs(na - nb) >= 0.005;
}

function buildAccountSums(
  vouchers: VoucherRecord[],
  {
    beforeDate,
    fromDate,
    toDate,
    excludeProfitLossClosing = false
  }: {
    beforeDate?: string;
    fromDate?: string;
    toDate?: string;
    /** 利润表用：排除结转损益凭证，保留普票减免等业务凭证 */
    excludeProfitLossClosing?: boolean;
  } = {}
) {
  const sums = new Map();
  for (const v of vouchers) {
    const d = v.date;
    if (beforeDate && d >= beforeDate) continue;
    if (fromDate && d < fromDate) continue;
    if (toDate && d > toDate) continue;
    if (excludeProfitLossClosing && v.isProfitLossClosing) continue;
    for (const e of v.entries || []) {
      // 报表按科目编码汇总，避免科目重建导致 accountId 变化后取数为空
      const code = String(e.accountCode || '').trim();
      if (!code) continue;
      const cur = sums.get(code) || { debit: 0, credit: 0 };
      cur.debit += parseFloat(String(e.debit)) || 0;
      cur.credit += parseFloat(String(e.credit)) || 0;
      sums.set(code, cur);
    }
  }
  return sums;
}

function sumSums(sums, accountCode) {
  return sums.get(accountCode) || { debit: 0, credit: 0 };
}

/**
 * 利润表自科目余额表业务发生额取数（收入/成本费用类通用）：
 * - 须先排除「结转损益」凭证（否则借贷毛额相减会得到 0 或错误数）
 * - 收入类（贷方科目）：业务贷方发生 − 业务借方发生
 * - 成本费用类（借方科目）：业务借方发生 − 业务贷方发生
 */
function profitStatementLineAmount(
  businessDebit: number,
  businessCredit: number,
  account: Account
) {
  if (!isProfitLossOrCostAccount(account)) {
    return 0;
  }
  if (account.direction === 'credit') {
    return roundMoney(businessCredit - businessDebit);
  }
  return roundMoney(businessDebit - businessCredit);
}

function totalsBalanced(debit, credit) {
  const d = parseFloat(String(debit)) || 0;
  const c = parseFloat(String(credit)) || 0;
  return Math.abs(d - c) < 0.005;
}

/** 科目余额表发生额：全部已入账凭证的借贷方毛额（含损益结转等业务结转） */
function occurrenceColumns(debit, credit) {
  return {
    debit: blankMoney(debit),
    credit: blankMoney(credit)
  };
}

/**
 * 科目余额表本期/累计发生额展示：
 * - 已结转（损益/成本）：剔除结转损益凭证后算净额，借贷两列同数（与利润表一致）
 *   · 收入类：贷方 − 借方，再令借方 = 贷方
 *   · 成本费用类：借方 − 贷方，再令贷方 = 借方
 * - 未结转：借贷分列毛额
 */
function trialBalanceOccurrenceColumns(
  account: Account,
  gross: { debit: number; credit: number },
  business: { debit: number; credit: number },
  profitLossClosed: boolean
) {
  if (profitLossClosed && isProfitLossOrCostAccount(account)) {
    const net = profitStatementLineAmount(business.debit, business.credit, account);
    const n = blankMoney(net);
    if (n == null) {
      return { debit: null, credit: null };
    }
    return { debit: n, credit: n };
  }
  return occurrenceColumns(gross.debit, gross.credit);
}

function mergeOccurrenceColumns(
  a: { debit: number | null; credit: number | null },
  b: { debit: number | null; credit: number | null }
) {
  return {
    debit: blankMoney((a.debit || 0) + (b.debit || 0)),
    credit: blankMoney((a.credit || 0) + (b.credit || 0))
  };
}

/**
 * 本年累计发生额：上季/月已结转、本季/月未结转时，
 * 本期之前按净额对称 + 本期按毛额分列（与本期发生额规则一致）。
 */
function trialBalanceYtdOccurrenceColumns(
  account: Account,
  row: {
    period: { debit: number; credit: number };
    periodBusiness: { debit: number; credit: number };
    ytd: { debit: number; credit: number };
    ytdBusiness: { debit: number; credit: number };
    beforePeriod: { debit: number; credit: number };
    beforePeriodBusiness: { debit: number; credit: number };
  },
  periodProfitLossClosed: boolean,
  previousPeriodProfitLossClosed: boolean
) {
  if (!isProfitLossOrCostAccount(account)) {
    return occurrenceColumns(row.ytd.debit, row.ytd.credit);
  }

  if (periodProfitLossClosed) {
    return trialBalanceOccurrenceColumns(account, row.ytd, row.ytdBusiness, true);
  }

  if (previousPeriodProfitLossClosed) {
    const beforeCols = trialBalanceOccurrenceColumns(
      account,
      row.beforePeriod,
      row.beforePeriodBusiness,
      true
    );
    const periodCols = trialBalanceOccurrenceColumns(
      account,
      row.period,
      row.periodBusiness,
      false
    );
    return mergeOccurrenceColumns(beforeCols, periodCols);
  }

  return occurrenceColumns(row.ytd.debit, row.ytd.credit);
}

const COST_ACCOUNT_CODES = new Set(['4301', '5401']);
const EXPENSE_ACCOUNT_CODES = new Set(['5403', '5602', '5603', '5801']);
const OUTCOME_EXPENSE_CODES = new Set(['5711']);

function resolveAccountCategoryLabel(account) {
  switch (account.category) {
    case '资产':
      return '资产类';
    case '负债':
      return '负债类';
    case '所有者权益':
      return '所有者权益类';
    case '成本':
    case '损益':
      if (account.category === '成本' || COST_ACCOUNT_CODES.has(account.code)) {
        return '成本类';
      }
      if (account.direction === 'credit') {
        return '收入类';
      }
      if (OUTCOME_EXPENSE_CODES.has(account.code)) {
        return '支出类';
      }
      if (EXPENSE_ACCOUNT_CODES.has(account.code)) {
        return '费用类';
      }
      return account.direction === 'credit' ? '收入类' : '费用类';
    default:
      return account.category;
  }
}

function isProfitLossOrCostAccount(account: Account) {
  return account.category === '损益' || account.category === '成本';
}

function resolvePreviousPeriodProfitLossClosed(
  vouchers: VoucherRecord[],
  reportPeriod: { type: string; year: number; quarter?: number; month?: number } | null
) {
  if (!reportPeriod) return false;

  if (reportPeriod.type === 'quarter' && reportPeriod.quarter && reportPeriod.quarter > 1) {
    return hasProfitLossClosing(vouchers, {
      type: 'quarter',
      year: reportPeriod.year,
      quarter: reportPeriod.quarter - 1
    });
  }

  if (reportPeriod.type === 'month' && reportPeriod.month && reportPeriod.month > 1) {
    return hasProfitLossClosing(vouchers, {
      type: 'month',
      year: reportPeriod.year,
      month: reportPeriod.month - 1
    });
  }

  return false;
}

type LedgerAccountRow = {
  account: Account;
  opening: { debit: number; credit: number };
  period: { debit: number; credit: number };
  periodBusiness: { debit: number; credit: number };
  ytd: { debit: number; credit: number };
  ytdBusiness: { debit: number; credit: number };
  beforePeriod: { debit: number; credit: number };
  beforePeriodBusiness: { debit: number; credit: number };
  openingYear: { debit: number; credit: number };
  ending: { debit: number; credit: number };
  openingBalance: number;
  openingYearBalance: number;
  endingBalance: number;
  periodNetAmount: number;
  ytdNetAmount: number;
};

function buildLedgerAccountRows(
  accounts: Account[],
  vouchers: VoucherRecord[],
  startDate: string,
  endDate: string
): LedgerAccountRow[] {
  const yearStart = `${endDate.slice(0, 4)}-01-01`;
  const beforePeriodEndDate = dayjs(startDate).subtract(1, 'day').format('YYYY-MM-DD');
  const hasBeforePeriodInYear = beforePeriodEndDate >= yearStart;

  const openingSums = buildAccountSums(vouchers, { beforeDate: startDate });
  const periodSums = buildAccountSums(vouchers, { fromDate: startDate, toDate: endDate });
  const periodBusinessSums = buildAccountSums(vouchers, {
    fromDate: startDate,
    toDate: endDate,
    excludeProfitLossClosing: true
  });
  const ytdSums = buildAccountSums(vouchers, { fromDate: yearStart, toDate: endDate });
  const ytdBusinessSums = buildAccountSums(vouchers, {
    fromDate: yearStart,
    toDate: endDate,
    excludeProfitLossClosing: true
  });
  const beforePeriodSums = hasBeforePeriodInYear
    ? buildAccountSums(vouchers, { fromDate: yearStart, toDate: beforePeriodEndDate })
    : new Map();
  const beforePeriodBusinessSums = hasBeforePeriodInYear
    ? buildAccountSums(vouchers, {
        fromDate: yearStart,
        toDate: beforePeriodEndDate,
        excludeProfitLossClosing: true
      })
    : new Map();
  const openingYearSums = buildAccountSums(vouchers, { beforeDate: yearStart });
  const endingSums = buildAccountSums(vouchers, { toDate: endDate });

  return accounts.map((account) => {
    const opening = sumSums(openingSums, account.code);
    const period = sumSums(periodSums, account.code);
    const periodBusiness = sumSums(periodBusinessSums, account.code);
    const ytd = sumSums(ytdSums, account.code);
    const ytdBusiness = sumSums(ytdBusinessSums, account.code);
    const beforePeriod = sumSums(beforePeriodSums, account.code);
    const beforePeriodBusiness = sumSums(beforePeriodBusinessSums, account.code);
    const openingYear = sumSums(openingYearSums, account.code);
    const ending = sumSums(endingSums, account.code);

    return {
      account,
      opening,
      period,
      periodBusiness,
      ytd,
      ytdBusiness,
      beforePeriod,
      beforePeriodBusiness,
      openingYear,
      ending,
      openingBalance: accountBalance(opening.debit, opening.credit, account.direction),
      openingYearBalance: accountBalance(
        openingYear.debit,
        openingYear.credit,
        account.direction
      ),
      endingBalance: accountBalance(ending.debit, ending.credit, account.direction),
      periodNetAmount: profitStatementLineAmount(
        periodBusiness.debit,
        periodBusiness.credit,
        account
      ),
      ytdNetAmount: profitStatementLineAmount(
        ytdBusiness.debit,
        ytdBusiness.credit,
        account
      )
    };
  });
}

export type ReportLedgerOptions = {
  /** 未实际结转时，模拟普票免税结转 + 损益结转后的报表展示 */
  virtualClosing?: boolean;
  virtualClosingVouchers?: VoucherRecord[];
  includesProjectedTaxExemption?: boolean;
};

/**
 * 报表统一账簿：凭证 → 科目汇总（科目余额表的数据源）
 * 展示含未审核凭证；损益结转判断仍仅依据已审核凭证。
 */
function buildReportLedgerFromData(
  accounts: Account[],
  allVouchers: VoucherRecord[],
  startDate: string,
  endDate: string,
  reportPeriod = null,
  options: ReportLedgerOptions = {}
) {
  const approvedVouchers = allVouchers.filter((v) => !isDraftVoucher(v));
  const yearStart = `${endDate.slice(0, 4)}-01-01`;
  const actualPeriodProfitLossClosed =
    reportPeriod != null && hasProfitLossClosing(approvedVouchers, reportPeriod);
  const previousPeriodProfitLossClosed = resolvePreviousPeriodProfitLossClosed(
    approvedVouchers,
    reportPeriod
  );

  const virtualClosingVouchers = options.virtualClosingVouchers || [];
  const vouchersForDisplay = virtualClosingVouchers.length
    ? [...allVouchers, ...virtualClosingVouchers]
    : allVouchers;
  const vouchersForApproved = virtualClosingVouchers.length
    ? [...approvedVouchers, ...virtualClosingVouchers]
    : approvedVouchers;

  const accountRows = buildLedgerAccountRows(accounts, vouchersForDisplay, startDate, endDate);
  const approvedAccountRows = buildLedgerAccountRows(
    accounts,
    vouchersForApproved,
    startDate,
    endDate
  );
  const hasDraftInPeriod = allVouchers.some(
    (v) => isDraftVoucher(v) && v.date >= startDate && v.date <= endDate
  );

  let periodProfitLossClosed = actualPeriodProfitLossClosed;
  let virtualClosingApplied = false;
  let includesProjectedTaxExemption = false;

  if (virtualClosingVouchers.length) {
    periodProfitLossClosed = true;
    virtualClosingApplied = true;
    includesProjectedTaxExemption = Boolean(options.includesProjectedTaxExemption);
  }

  return {
    startDate,
    endDate,
    yearStart,
    accounts,
    accountRows,
    approvedAccountRows,
    hasDraftInPeriod,
    periodProfitLossClosed,
    actualPeriodProfitLossClosed,
    virtualClosingApplied,
    includesProjectedTaxExemption,
    previousPeriodProfitLossClosed
  };
}

async function buildReportLedger(
  startDate: string,
  endDate: string,
  reportPeriod = null,
  options: ReportLedgerOptions = {}
) {
  const accounts = await Accounts.getAll();
  const allVouchers = await getVouchersUpTo(endDate);

  let ledgerOptions = options;
  if (options.virtualClosing && reportPeriod) {
    const approvedVouchers = allVouchers.filter((v) => !isDraftVoucher(v));
    const actualPeriodProfitLossClosed = hasProfitLossClosing(approvedVouchers, reportPeriod);
    if (!actualPeriodProfitLossClosed) {
      const periodLabel = formatReportPeriod(reportPeriod);
      const { virtualVouchers, includesProjectedTaxExemption } =
        await buildVirtualClosingVouchersForReport(
          accounts,
          allVouchers,
          endDate,
          reportPeriod,
          periodLabel
        );
      if (virtualVouchers.length > 0) {
        ledgerOptions = {
          ...options,
          virtualClosingVouchers: virtualVouchers,
          includesProjectedTaxExemption
        };
      }
    }
  }

  return buildReportLedgerFromData(
    accounts,
    allVouchers,
    startDate,
    endDate,
    reportPeriod,
    ledgerOptions
  );
}

export type DashboardPeriodSnapshotInput = {
  startDate: string;
  endDate: string;
  reportPeriod?: { type: 'month'; year: number; month: number } | null;
};

export type DashboardPeriodSnapshotResult = {
  trialRows: Awaited<ReturnType<typeof compileTrialBalanceFromLedger>>['rows'];
  incomeValues: Record<string, number>;
  netProfit: number;
};

async function getDashboardPeriodSnapshots(
  periods: DashboardPeriodSnapshotInput[]
): Promise<DashboardPeriodSnapshotResult[]> {
  if (!periods.length) return [];

  const accounts = await Accounts.getAll();
  const maxEndDate = periods.reduce(
    (max, item) => (item.endDate > max ? item.endDate : max),
    periods[0].endDate
  );
  const allVouchers = await getVouchersUpTo(maxEndDate);

  return periods.map(({ startDate, endDate, reportPeriod = null }) => {
    const ledger = buildReportLedgerFromData(
      accounts,
      allVouchers,
      startDate,
      endDate,
      reportPeriod
    );
    const trial = compileTrialBalanceFromLedger(ledger);
    const periodByCode = buildPLByCodeFromLedger(ledger, 'periodNetAmount');
    const income = compileIncomeStatement(periodByCode);
    return {
      trialRows: trial.rows,
      incomeValues: income.values,
      netProfit: income.values.netProfit || 0
    };
  });
}

function compileTrialBalanceColumns(
  account: Account,
  row: LedgerAccountRow,
  ledger: Awaited<ReturnType<typeof buildReportLedger>>
) {
  const openingCols = toDebitCreditColumns(row.openingBalance, account.direction);
  const endingCols = toDebitCreditColumns(row.endingBalance, account.direction);
  const periodCols = trialBalanceOccurrenceColumns(
    account,
    row.period,
    row.periodBusiness,
    ledger.periodProfitLossClosed
  );
  const ytdCols = trialBalanceYtdOccurrenceColumns(
    account,
    row,
    ledger.periodProfitLossClosed,
    ledger.previousPeriodProfitLossClosed
  );
  return { openingCols, endingCols, periodCols, ytdCols };
}

function compileTrialBalanceFromLedger(ledger: Awaited<ReturnType<typeof buildReportLedger>>) {
  const rows = [];
  const totals = {
    openingDebit: 0,
    openingCredit: 0,
    periodDebit: 0,
    periodCredit: 0,
    ytdDebit: 0,
    ytdCredit: 0,
    endingDebit: 0,
    endingCredit: 0
  };
  const approvedTotals = {
    openingDebit: 0,
    openingCredit: 0,
    periodDebit: 0,
    periodCredit: 0,
    ytdDebit: 0,
    ytdCredit: 0,
    endingDebit: 0,
    endingCredit: 0
  };

  for (let i = 0; i < ledger.accountRows.length; i += 1) {
    const row = ledger.accountRows[i];
    const approvedRow = ledger.approvedAccountRows[i];
    const { account } = row;
    const { openingCols, endingCols, periodCols, ytdCols } = compileTrialBalanceColumns(
      account,
      row,
      ledger
    );
    const approvedCompiled = compileTrialBalanceColumns(account, approvedRow, ledger);

    rows.push({
      key: account.id,
      code: account.code,
      name: account.name,
      categoryLabel: resolveAccountCategoryLabel(account),
      openingDebit: openingCols.debit,
      openingCredit: openingCols.credit,
      periodDebit: periodCols.debit,
      periodCredit: periodCols.credit,
      ytdDebit: ytdCols.debit,
      ytdCredit: ytdCols.credit,
      endingDebit: endingCols.debit,
      endingCredit: endingCols.credit,
      draftFlags: {
        openingDebit: moneyDiffers(openingCols.debit, approvedCompiled.openingCols.debit),
        openingCredit: moneyDiffers(openingCols.credit, approvedCompiled.openingCols.credit),
        periodDebit: moneyDiffers(periodCols.debit, approvedCompiled.periodCols.debit),
        periodCredit: moneyDiffers(periodCols.credit, approvedCompiled.periodCols.credit),
        ytdDebit: moneyDiffers(ytdCols.debit, approvedCompiled.ytdCols.debit),
        ytdCredit: moneyDiffers(ytdCols.credit, approvedCompiled.ytdCols.credit),
        endingDebit: moneyDiffers(endingCols.debit, approvedCompiled.endingCols.debit),
        endingCredit: moneyDiffers(endingCols.credit, approvedCompiled.endingCols.credit)
      }
    });

    totals.openingDebit += openingCols.debit || 0;
    totals.openingCredit += openingCols.credit || 0;
    totals.periodDebit += periodCols.debit || 0;
    totals.periodCredit += periodCols.credit || 0;
    totals.ytdDebit += ytdCols.debit || 0;
    totals.ytdCredit += ytdCols.credit || 0;
    totals.endingDebit += endingCols.debit || 0;
    totals.endingCredit += endingCols.credit || 0;

    approvedTotals.openingDebit += approvedCompiled.openingCols.debit || 0;
    approvedTotals.openingCredit += approvedCompiled.openingCols.credit || 0;
    approvedTotals.periodDebit += approvedCompiled.periodCols.debit || 0;
    approvedTotals.periodCredit += approvedCompiled.periodCols.credit || 0;
    approvedTotals.ytdDebit += approvedCompiled.ytdCols.debit || 0;
    approvedTotals.ytdCredit += approvedCompiled.ytdCols.credit || 0;
    approvedTotals.endingDebit += approvedCompiled.endingCols.debit || 0;
    approvedTotals.endingCredit += approvedCompiled.endingCols.credit || 0;
  }

  const totalDraftFlags = {
    openingDebit: moneyDiffers(totals.openingDebit, approvedTotals.openingDebit),
    openingCredit: moneyDiffers(totals.openingCredit, approvedTotals.openingCredit),
    periodDebit: moneyDiffers(totals.periodDebit, approvedTotals.periodDebit),
    periodCredit: moneyDiffers(totals.periodCredit, approvedTotals.periodCredit),
    ytdDebit: moneyDiffers(totals.ytdDebit, approvedTotals.ytdDebit),
    ytdCredit: moneyDiffers(totals.ytdCredit, approvedTotals.ytdCredit),
    endingDebit: moneyDiffers(totals.endingDebit, approvedTotals.endingDebit),
    endingCredit: moneyDiffers(totals.endingCredit, approvedTotals.endingCredit)
  };

  return {
    startDate: ledger.startDate,
    endDate: ledger.endDate,
    yearStart: ledger.yearStart,
    hasDraftInPeriod: ledger.hasDraftInPeriod,
    rows,
    periodOccurrenceBalanced: totalsBalanced(
      approvedTotals.periodDebit,
      approvedTotals.periodCredit
    ),
    ytdOccurrenceBalanced: totalsBalanced(approvedTotals.ytdDebit, approvedTotals.ytdCredit),
    periodOccurrenceDiff: roundMoney(approvedTotals.periodDebit - approvedTotals.periodCredit),
    ytdOccurrenceDiff: roundMoney(approvedTotals.ytdDebit - approvedTotals.ytdCredit),
    periodProfitLossClosed: ledger.periodProfitLossClosed,
    actualPeriodProfitLossClosed: ledger.actualPeriodProfitLossClosed,
    virtualClosingApplied: ledger.virtualClosingApplied,
    includesProjectedTaxExemption: ledger.includesProjectedTaxExemption,
    totals: {
      openingDebit: blankMoney(totals.openingDebit),
      openingCredit: blankMoney(totals.openingCredit),
      periodDebit: blankMoney(totals.periodDebit),
      periodCredit: blankMoney(totals.periodCredit),
      ytdDebit: blankMoney(totals.ytdDebit),
      ytdCredit: blankMoney(totals.ytdCredit),
      endingDebit: blankMoney(totals.endingDebit),
      endingCredit: blankMoney(totals.endingCredit)
    },
    totalDraftFlags
  };
}

async function getTrialBalance(
  startDate: string,
  endDate: string,
  reportPeriod = null,
  options: ReportLedgerOptions = {}
) {
  const ledger = await buildReportLedger(startDate, endDate, reportPeriod, options);
  return compileTrialBalanceFromLedger(ledger);
}

function buildPLByCodeFromLedger(
  ledger: Awaited<ReturnType<typeof buildReportLedger>>,
  netKey: 'periodNetAmount' | 'ytdNetAmount',
  rowsKey: 'accountRows' | 'approvedAccountRows' = 'accountRows'
) {
  const byCode = new Map<string, number>();
  for (const row of ledger[rowsKey]) {
    if (!isProfitLossOrCostAccount(row.account)) continue;
    byCode.set(row.account.code, row[netKey]);
  }
  return byCode;
}

function sumPLCodes(byCode, codes) {
  return roundMoney(codes.reduce((sum, code) => sum + (byCode.get(code) || 0), 0));
}

function compileIncomeStatement(byCode: Map<string, number>) {
  const values: Record<string, number> = {};
  const rows = [];

  for (const line of INCOME_STATEMENT_LINES) {
    let amount = 0;

    if (line.type === 'item' || line.type === 'detail') {
      amount = sumPLCodes(byCode, line.codes);
    } else if (line.type === 'calc') {
      amount = roundMoney(line.calc(values));
    }

    values[line.key] = amount;

    rows.push({
      key: line.key,
      type: line.type,
      label: line.label,
      row: line.row,
      amount,
      bold: line.bold,
      highlight: 'highlight' in line ? (line as { highlight?: boolean }).highlight : undefined
    });
  }

  return { rows, values };
}

function mapIncomeStatementRows(periodRows, ytdRows, periodApprovedRows, ytdApprovedRows) {
  return periodRows.map((row, index) => ({
    ...row,
    periodAmount: blankMoney(row.amount),
    ytdAmount: blankMoney(ytdRows[index]?.amount ?? 0),
    periodDraft: moneyDiffers(row.amount, periodApprovedRows[index]?.amount ?? 0),
    ytdDraft: moneyDiffers(ytdRows[index]?.amount ?? 0, ytdApprovedRows[index]?.amount ?? 0)
  }));
}

async function getIncomeStatement(
  startDate: string,
  endDate: string,
  reportPeriod = null,
  options: ReportLedgerOptions = {}
) {
  const ledger = await buildReportLedger(startDate, endDate, reportPeriod, options);
  const periodByCode = buildPLByCodeFromLedger(ledger, 'periodNetAmount');
  const ytdByCode = buildPLByCodeFromLedger(ledger, 'ytdNetAmount');
  const periodApprovedByCode = buildPLByCodeFromLedger(
    ledger,
    'periodNetAmount',
    'approvedAccountRows'
  );
  const ytdApprovedByCode = buildPLByCodeFromLedger(
    ledger,
    'ytdNetAmount',
    'approvedAccountRows'
  );
  const period = compileIncomeStatement(periodByCode);
  const ytd = compileIncomeStatement(ytdByCode);
  const periodApproved = compileIncomeStatement(periodApprovedByCode);
  const ytdApproved = compileIncomeStatement(ytdApprovedByCode);

  const rows = mapIncomeStatementRows(
    period.rows,
    ytd.rows,
    periodApproved.rows,
    ytdApproved.rows
  );

  return {
    startDate: ledger.startDate,
    endDate: ledger.endDate,
    yearStart: ledger.yearStart,
    hasDraftInPeriod: ledger.hasDraftInPeriod,
    rows,
    summary: {
      operatingProfit: period.values.operatingProfit,
      totalProfit: period.values.totalProfit,
      netProfit: period.values.netProfit,
      ytdOperatingProfit: ytd.values.operatingProfit,
      ytdTotalProfit: ytd.values.totalProfit,
      ytdNetProfit: ytd.values.netProfit
    }
  };
}

function attachBalanceSheetDraftFlags(displayRows, approvedRows) {
  return displayRows.map((row, index) => ({
    ...row,
    openingDraft: moneyDiffers(row.opening, approvedRows[index]?.opening),
    endingDraft: moneyDiffers(row.ending, approvedRows[index]?.ending)
  }));
}

async function getBalanceSheet(
  startDate: string,
  endDate: string,
  reportPeriod = null,
  options: ReportLedgerOptions = {}
) {
  const ledger = await buildReportLedger(startDate, endDate, reportPeriod, options);
  const openingCtx = buildBalanceContextFromLedger(ledger, 'openingYearBalance');
  const endingCtx = buildBalanceContextFromLedger(ledger, 'endingBalance');
  const openingApprovedCtx = buildBalanceContextFromLedger(
    ledger,
    'openingYearBalance',
    'approvedAccountRows'
  );
  const endingApprovedCtx = buildBalanceContextFromLedger(
    ledger,
    'endingBalance',
    'approvedAccountRows'
  );

  const assetsCompiled = compileBalanceSheetSide(BALANCE_SHEET_ASSETS, openingCtx, endingCtx);
  const liabilitiesCompiled = compileBalanceSheetSide(
    BALANCE_SHEET_LIABILITIES,
    openingCtx,
    endingCtx
  );
  const assetsApprovedCompiled = compileBalanceSheetSide(
    BALANCE_SHEET_ASSETS,
    openingApprovedCtx,
    endingApprovedCtx
  );
  const liabilitiesApprovedCompiled = compileBalanceSheetSide(
    BALANCE_SHEET_LIABILITIES,
    openingApprovedCtx,
    endingApprovedCtx
  );

  const assets = {
    rows: attachBalanceSheetDraftFlags(assetsCompiled.rows, assetsApprovedCompiled.rows)
  };
  const liabilities = {
    rows: attachBalanceSheetDraftFlags(
      liabilitiesCompiled.rows,
      liabilitiesApprovedCompiled.rows
    )
  };

  const totalAssetsOpening = assetsCompiled.openingValues.assetsTotal ?? 0;
  const totalAssetsEnding = assetsCompiled.endingValues.assetsTotal ?? 0;
  const totalLEOpening = liabilitiesCompiled.openingValues.liabilitiesEquityTotal ?? 0;
  const totalLEEnding = liabilitiesCompiled.endingValues.liabilitiesEquityTotal ?? 0;
  const totalAssetsOpeningApproved = assetsApprovedCompiled.openingValues.assetsTotal ?? 0;
  const totalAssetsEndingApproved = assetsApprovedCompiled.endingValues.assetsTotal ?? 0;
  const totalLEOpeningApproved =
    liabilitiesApprovedCompiled.openingValues.liabilitiesEquityTotal ?? 0;
  const totalLEEndingApproved =
    liabilitiesApprovedCompiled.endingValues.liabilitiesEquityTotal ?? 0;

  return {
    startDate: ledger.startDate,
    endDate: ledger.endDate,
    hasDraftInPeriod: ledger.hasDraftInPeriod,
    virtualClosingApplied: ledger.virtualClosingApplied,
    includesProjectedTaxExemption: ledger.includesProjectedTaxExemption,
    assets,
    liabilities,
    totalAssetsOpening,
    totalAssetsEnding,
    totalLiabilitiesEquityOpening: totalLEOpening,
    totalLiabilitiesEquityEnding: totalLEEnding,
    balanced: Math.abs(totalAssetsEnding - totalLEEnding) < 0.01,
    balancedApproved:
      Math.abs(totalAssetsEndingApproved - totalLEEndingApproved) < 0.01
  };
}

/** 从科目账簿取各科目余额，供资产负债表编表 */
function buildBalanceContextFromLedger(
  ledger: Awaited<ReturnType<typeof buildReportLedger>>,
  balanceKey: 'openingYearBalance' | 'endingBalance',
  rowsKey: 'accountRows' | 'approvedAccountRows' = 'accountRows'
) {
  const byCode = new Map<string, number>();
  let unreclosedProfit = 0;

  for (const row of ledger[rowsKey]) {
    const bal = row[balanceKey];
    byCode.set(row.account.code, bal);

    if (isProfitLossOrCostAccount(row.account)) {
      if (row.account.direction === 'credit') {
        unreclosedProfit += bal;
      } else {
        unreclosedProfit -= bal;
      }
    }
  }

  return { byCode, unreclosedProfit: roundMoney(unreclosedProfit) };
}

function sumAccountCodes(byCode, codes, unreclosedProfit, includeUnreclosedProfit) {
  let total = 0;
  for (const code of codes) {
    total += byCode.get(code) || 0;
  }
  if (includeUnreclosedProfit) {
    total += unreclosedProfit;
  }
  return roundMoney(total);
}

function compileBalanceSheetSide(
  template: readonly Record<string, unknown>[],
  openingCtx: ReturnType<typeof buildBalanceContextFromLedger>,
  endingCtx: ReturnType<typeof buildBalanceContextFromLedger>
) {
  const openingValues: Record<string, number> = {};
  const endingValues: Record<string, number> = {};
  const rows = [];

  for (const line of template as Array<Record<string, unknown>>) {
    if (line.type === 'section') {
      rows.push({
        key: `section-${line.label}`,
        type: 'section',
        label: line.label,
        row: null,
        opening: null,
        ending: null
      });
      continue;
    }

    if (line.type === 'spacer') {
      rows.push({
        key: line.key,
        type: 'spacer',
        label: '',
        row: null,
        opening: null,
        ending: null
      });
      continue;
    }

    let opening = 0;
    let ending = 0;

    if (line.type === 'item' || line.type === 'detail') {
      opening = sumAccountCodes(
        openingCtx.byCode,
        line.codes,
        openingCtx.unreclosedProfit,
        line.includeUnreclosedProfit
      );
      ending = sumAccountCodes(
        endingCtx.byCode,
        line.codes,
        endingCtx.unreclosedProfit,
        line.includeUnreclosedProfit
      );
      if (line.displayAbs) {
        opening = Math.abs(opening);
        ending = Math.abs(ending);
      }
    } else if (line.type === 'calc') {
      const calcLine = line as { calc: (values: Record<string, number>) => number };
      opening = roundMoney(calcLine.calc(openingValues));
      ending = roundMoney(calcLine.calc(endingValues));
    } else if (line.type === 'subtotal' || line.type === 'total') {
      const sumLine = line as { sumKeys: string[] };
      opening = roundMoney(
        sumLine.sumKeys.reduce((sum, key) => sum + (openingValues[key] || 0), 0)
      );
      ending = roundMoney(
        sumLine.sumKeys.reduce((sum, key) => sum + (endingValues[key] || 0), 0)
      );
    }

    openingValues[String(line.key)] = opening;
    endingValues[String(line.key)] = ending;

    const styledLine = line as {
      negateDisplay?: boolean;
      bold?: boolean;
      highlight?: boolean;
    };
    const openingDisplay = styledLine.negateDisplay && opening > 0 ? -opening : opening;
    const endingDisplay = styledLine.negateDisplay && ending > 0 ? -ending : ending;

    rows.push({
      key: line.key,
      type: line.type,
      label: line.label,
      row: line.row,
      opening: blankMoney(openingDisplay),
      ending: blankMoney(endingDisplay),
      bold: styledLine.bold,
      highlight: styledLine.highlight
    });
  }

  return { rows, openingValues, endingValues };
}

function formatLedgerDirection(account: Account, balance: number) {
  if (Math.abs(balance) < 0.005) return '平';
  if (account.direction === 'credit') {
    return balance > 0 ? '贷' : '借';
  }
  return balance > 0 ? '借' : '贷';
}

function formatPeriodLabel(endDate: string) {
  return `${endDate.slice(0, 4)}${endDate.slice(5, 7)}`;
}

async function getGeneralLedger(startDate: string, endDate: string) {
  const accounts = await Accounts.getAll();
  const vouchers = await getVouchersUpTo(endDate);
  const yearStart = `${endDate.slice(0, 4)}-01-01`;
  const periodLabel = formatPeriodLabel(endDate);

  const openingSums = buildAccountSums(vouchers, { beforeDate: startDate });
  const periodSums = buildAccountSums(vouchers, { fromDate: startDate, toDate: endDate });
  const ytdSums = buildAccountSums(vouchers, { fromDate: yearStart, toDate: endDate });
  const endingSums = buildAccountSums(vouchers, { toDate: endDate });

  const rows = [];
  let groupIndex = 0;

  for (const account of accounts) {
    const opening = sumSums(openingSums, account.code);
    const period = sumSums(periodSums, account.code);
    const ytd = sumSums(ytdSums, account.code);
    const ending = sumSums(endingSums, account.code);

    const openingBalance = accountBalance(opening.debit, opening.credit, account.direction);
    const endingBalance = accountBalance(ending.debit, ending.credit, account.direction);

    const hasActivity =
      Math.abs(openingBalance) >= 0.005 ||
      Math.abs(period.debit) >= 0.005 ||
      Math.abs(period.credit) >= 0.005 ||
      Math.abs(ytd.debit) >= 0.005 ||
      Math.abs(ytd.credit) >= 0.005 ||
      Math.abs(endingBalance) >= 0.005;

    if (!hasActivity) continue;

    const base = {
      accountCode: account.code,
      accountName: account.name,
      period: periodLabel,
      groupIndex
    };

    rows.push({
      key: `${account.code}-opening`,
      ...base,
      summary: '期初余额',
      debit: null,
      credit: null,
      direction: formatLedgerDirection(account, openingBalance),
      balance: roundMoney(openingBalance),
      accountRowSpan: 3
    });
    rows.push({
      key: `${account.code}-period`,
      ...base,
      summary: '本期合计',
      debit: blankMoney(period.debit),
      credit: blankMoney(period.credit),
      direction: formatLedgerDirection(account, endingBalance),
      balance: roundMoney(endingBalance),
      accountRowSpan: 0
    });
    rows.push({
      key: `${account.code}-ytd`,
      ...base,
      summary: '本年累计',
      debit: blankMoney(ytd.debit),
      credit: blankMoney(ytd.credit),
      direction: formatLedgerDirection(account, endingBalance),
      balance: roundMoney(endingBalance),
      accountRowSpan: 0
    });
    groupIndex += 1;
  }

  return {
    startDate,
    endDate,
    periodLabel,
    rows
  };
}

export const Reports = {
  getTrialBalance,
  getIncomeStatement,
  getBalanceSheet,
  getGeneralLedger,
  getDashboardPeriodSnapshots
};
