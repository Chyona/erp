import { Voucher } from './voucher.js';
import { Accounts } from './accounts.js';
import {
  BALANCE_SHEET_ASSETS,
  BALANCE_SHEET_LIABILITIES
} from '../constants/balanceSheetTemplate.js';
import { INCOME_STATEMENT_LINES } from '../constants/incomeStatementTemplate.js';

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

function toDebitCreditColumns(balance, direction) {
  const b = roundMoney(balance);
  if (Math.abs(b) < 0.005) {
    return { debit: null, credit: null };
  }
  if (direction === 'debit') {
    return b >= 0 ? { debit: b, credit: null } : { debit: null, credit: -b };
  }
  return b >= 0 ? { debit: null, credit: b } : { debit: -b, credit: null };
}

async function getApprovedVouchersUpTo(endDate) {
  const vouchers = await Voucher.getAll({ endDate, status: '' });
  return vouchers.filter((v) => v.status !== Voucher.STATUS.DRAFT);
}

function buildAccountSums(vouchers, { beforeDate, fromDate, toDate } = {}) {
  const sums = new Map();
  for (const v of vouchers) {
    const d = v.date;
    if (beforeDate && d >= beforeDate) continue;
    if (fromDate && d < fromDate) continue;
    if (toDate && d > toDate) continue;
    for (const e of v.entries || []) {
      if (!e.accountId) continue;
      const cur = sums.get(e.accountId) || { debit: 0, credit: 0 };
      cur.debit += parseFloat(e.debit) || 0;
      cur.credit += parseFloat(e.credit) || 0;
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
  const ytdSums = buildAccountSums(vouchers, { fromDate: yearStart, toDate: endDate });
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
    const ytd = sumSums(ytdSums, account.id);
    const ending = sumSums(endingSums, account.id);

    const openingBal = accountBalance(opening.debit, opening.credit, account.direction);
    const endingBal = accountBalance(ending.debit, ending.credit, account.direction);
    const openingCols = toDebitCreditColumns(openingBal, account.direction);
    const endingCols = toDebitCreditColumns(endingBal, account.direction);
    const periodDebit = blankMoney(period.debit);
    const periodCredit = blankMoney(period.credit);
    const ytdDebit = blankMoney(ytd.debit);
    const ytdCredit = blankMoney(ytd.credit);

    rows.push({
      key: account.id,
      code: account.code,
      name: account.name,
      categoryLabel: resolveAccountCategoryLabel(account),
      openingDebit: openingCols.debit,
      openingCredit: openingCols.credit,
      periodDebit,
      periodCredit,
      ytdDebit,
      ytdCredit,
      endingDebit: endingCols.debit,
      endingCredit: endingCols.credit
    });

    totals.openingDebit += openingCols.debit || 0;
    totals.openingCredit += openingCols.credit || 0;
    totals.periodDebit += periodDebit || 0;
    totals.periodCredit += periodCredit || 0;
    totals.ytdDebit += ytdDebit || 0;
    totals.ytdCredit += ytdCredit || 0;
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

function compileIncomeStatement(byCode) {
  const values = {};
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
      highlight: line.highlight
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
  const periodSums = buildAccountSums(vouchers, { fromDate: startDate, toDate: endDate });
  const ytdSums = buildAccountSums(vouchers, { fromDate: yearStart, toDate: endDate });

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

function compileBalanceSheetSide(template, openingCtx, endingCtx) {
  const openingValues = {};
  const endingValues = {};
  const rows = [];

  for (const line of template) {
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
      opening = roundMoney(line.calc(openingValues));
      ending = roundMoney(line.calc(endingValues));
    } else if (line.type === 'subtotal' || line.type === 'total') {
      opening = roundMoney(
        line.sumKeys.reduce((sum, key) => sum + (openingValues[key] || 0), 0)
      );
      ending = roundMoney(
        line.sumKeys.reduce((sum, key) => sum + (endingValues[key] || 0), 0)
      );
    }

    openingValues[line.key] = opening;
    endingValues[line.key] = ending;

    const openingDisplay = line.negateDisplay && opening > 0 ? -opening : opening;
    const endingDisplay = line.negateDisplay && ending > 0 ? -ending : ending;

    rows.push({
      key: line.key,
      type: line.type,
      label: line.label,
      row: line.row,
      opening: blankMoney(openingDisplay),
      ending: blankMoney(endingDisplay),
      bold: line.bold,
      highlight: line.highlight
    });
  }

  return { rows, openingValues, endingValues };
}

export const Reports = {
  getTrialBalance,
  getIncomeStatement,
  getBalanceSheet
};
