import { Voucher } from './voucher';
import { Accounts } from './accounts';
import type { Account, Voucher as VoucherRecord } from '../types';
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

async function getApprovedVouchersUpTo(endDate) {
  const vouchers = await Voucher.getAll({ endDate, status: '' });
  return vouchers.filter((v) => v.status !== Voucher.STATUS.DRAFT);
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
    /** 利润表用：排除损益结转凭证，保留普票减免等业务结转 */
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
      if (!e.accountId) continue;
      const cur = sums.get(e.accountId) || { debit: 0, credit: 0 };
      cur.debit += parseFloat(String(e.debit)) || 0;
      cur.credit += parseFloat(String(e.credit)) || 0;
      sums.set(e.accountId, cur);
    }
  }
  return sums;
}

function sumSums(sums, accountId) {
  return sums.get(accountId) || { debit: 0, credit: 0 };
}

function periodAmount(debit, credit, direction) {
  if (direction === 'debit') {
    return roundMoney(debit - credit);
  }
  return roundMoney(credit - debit);
}

function isProfitLossOrCostAccount(account) {
  return account.category === '损益' || account.category === '成本';
}

/**
 * 科目余额表发生额：
 * - 损益/成本：不含损益结转，净额借贷两列同数（如 5603 借/贷均 148.46，与利润表一致）
 * - 其余科目：借贷分列毛额
 */
function occurrenceColumns(debit, credit, direction, account) {
  if (isProfitLossOrCostAccount(account)) {
    const net = periodAmount(debit, credit, direction);
    const n = blankMoney(net);
    if (n == null) {
      return { debit: null, credit: null };
    }
    return { debit: n, credit: n };
  }
  return {
    debit: blankMoney(debit),
    credit: blankMoney(credit)
  };
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

async function getTrialBalance(startDate, endDate) {
  const accounts = await Accounts.getAll();
  const vouchers = await getApprovedVouchersUpTo(endDate);
  const yearStart = `${endDate.slice(0, 4)}-01-01`;
  const openingSums = buildAccountSums(vouchers, { beforeDate: startDate });
  const periodSums = buildAccountSums(vouchers, { fromDate: startDate, toDate: endDate });
  const periodOccurrenceSums = buildAccountSums(vouchers, {
    fromDate: startDate,
    toDate: endDate,
    excludeProfitLossClosing: true
  });
  const ytdSums = buildAccountSums(vouchers, { fromDate: yearStart, toDate: endDate });
  const ytdOccurrenceSums = buildAccountSums(vouchers, {
    fromDate: yearStart,
    toDate: endDate,
    excludeProfitLossClosing: true
  });
  const endingSums = buildAccountSums(vouchers, { toDate: endDate });

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

  for (const account of accounts) {
    const opening = sumSums(openingSums, account.id);
    const period = sumSums(periodSums, account.id);
    const periodOccurrence = sumSums(periodOccurrenceSums, account.id);
    const ytd = sumSums(ytdSums, account.id);
    const ytdOccurrence = sumSums(ytdOccurrenceSums, account.id);
    const ending = sumSums(endingSums, account.id);

    const openingBal = accountBalance(opening.debit, opening.credit, account.direction);
    const endingBal = accountBalance(ending.debit, ending.credit, account.direction);
    const openingCols = toDebitCreditColumns(openingBal, account.direction);
    const endingCols = toDebitCreditColumns(endingBal, account.direction);
    const occurrenceSource = isProfitLossOrCostAccount(account) ? periodOccurrence : period;
    const ytdOccurrenceSource = isProfitLossOrCostAccount(account) ? ytdOccurrence : ytd;
    const periodCols = occurrenceColumns(
      occurrenceSource.debit,
      occurrenceSource.credit,
      account.direction,
      account
    );
    const ytdCols = occurrenceColumns(
      ytdOccurrenceSource.debit,
      ytdOccurrenceSource.credit,
      account.direction,
      account
    );

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
      endingCredit: endingCols.credit
    });

    totals.openingDebit += openingCols.debit || 0;
    totals.openingCredit += openingCols.credit || 0;
    totals.periodDebit += periodCols.debit || 0;
    totals.periodCredit += periodCols.credit || 0;
    totals.ytdDebit += ytdCols.debit || 0;
    totals.ytdCredit += ytdCols.credit || 0;
    totals.endingDebit += endingCols.debit || 0;
    totals.endingCredit += endingCols.credit || 0;
  }

  return {
    startDate,
    endDate,
    yearStart,
    rows,
    totals: {
      openingDebit: blankMoney(totals.openingDebit),
      openingCredit: blankMoney(totals.openingCredit),
      periodDebit: blankMoney(totals.periodDebit),
      periodCredit: blankMoney(totals.periodCredit),
      ytdDebit: blankMoney(totals.ytdDebit),
      ytdCredit: blankMoney(totals.ytdCredit),
      endingDebit: blankMoney(totals.endingDebit),
      endingCredit: blankMoney(totals.endingCredit)
    }
  };
}

function buildPLByCode(accounts, sums) {
  const byCode = new Map();
  for (const account of accounts) {
    const s = sumSums(sums, account.id);
    byCode.set(account.code, periodAmount(s.debit, s.credit, account.direction));
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

function mapIncomeStatementRows(periodRows, ytdRows) {
  return periodRows.map((row, index) => ({
    ...row,
    periodAmount: blankMoney(row.amount),
    ytdAmount: blankMoney(ytdRows[index]?.amount ?? 0)
  }));
}

async function getIncomeStatement(startDate, endDate) {
  const accounts = await Accounts.getAll();
  const vouchers = await getApprovedVouchersUpTo(endDate);
  const yearStart = `${endDate.slice(0, 4)}-01-01`;
  const periodSums = buildAccountSums(vouchers, {
    fromDate: startDate,
    toDate: endDate,
    excludeProfitLossClosing: true
  });
  const ytdSums = buildAccountSums(vouchers, {
    fromDate: yearStart,
    toDate: endDate,
    excludeProfitLossClosing: true
  });

  const periodByCode = buildPLByCode(accounts, periodSums);
  const ytdByCode = buildPLByCode(accounts, ytdSums);
  const period = compileIncomeStatement(periodByCode);
  const ytd = compileIncomeStatement(ytdByCode);

  const rows = mapIncomeStatementRows(period.rows, ytd.rows);

  return {
    startDate,
    endDate,
    yearStart,
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

async function getBalanceSheet(startDate, endDate) {
  const accounts = await Accounts.getAll();
  const vouchers = await getApprovedVouchersUpTo(endDate);
  const yearStart = `${endDate.slice(0, 4)}-01-01`;
  const openingCtx = buildBalanceContext(accounts, vouchers, yearStart, true);
  const endingCtx = buildBalanceContext(accounts, vouchers, endDate, false);

  const assetsCompiled = compileBalanceSheetSide(BALANCE_SHEET_ASSETS, openingCtx, endingCtx);
  const liabilitiesCompiled = compileBalanceSheetSide(
    BALANCE_SHEET_LIABILITIES,
    openingCtx,
    endingCtx
  );

  const assets = { rows: assetsCompiled.rows };
  const liabilities = { rows: liabilitiesCompiled.rows };

  const totalAssetsOpening = assetsCompiled.openingValues.assetsTotal ?? 0;
  const totalAssetsEnding = assetsCompiled.endingValues.assetsTotal ?? 0;
  const totalLEOpening = liabilitiesCompiled.openingValues.liabilitiesEquityTotal ?? 0;
  const totalLEEnding = liabilitiesCompiled.endingValues.liabilitiesEquityTotal ?? 0;

  return {
    startDate,
    endDate,
    assets,
    liabilities,
    totalAssetsOpening,
    totalAssetsEnding,
    totalLiabilitiesEquityOpening: totalLEOpening,
    totalLiabilitiesEquityEnding: totalLEEnding,
    balanced: Math.abs(totalAssetsEnding - totalLEEnding) < 0.01
  };
}

function buildBalanceContext(accounts, vouchers, date, isOpening) {
  const sums = isOpening
    ? buildAccountSums(vouchers, { beforeDate: date })
    : buildAccountSums(vouchers, { toDate: date });

  const byCode = new Map();
  let unreclosedProfit = 0;

  for (const account of accounts) {
    const s = sumSums(sums, account.id);
    const bal = accountBalance(s.debit, s.credit, account.direction);
    byCode.set(account.code, bal);

    if (account.category === '损益' || account.category === '成本') {
      if (account.direction === 'credit') {
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

function compileBalanceSheetSide(template: readonly Record<string, unknown>[], openingCtx: ReturnType<typeof buildBalanceContext>, endingCtx: ReturnType<typeof buildBalanceContext>) {
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

export const Reports = {
  getTrialBalance,
  getIncomeStatement,
  getBalanceSheet
};
