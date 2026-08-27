import dayjs from 'dayjs';
import { Reports } from './reports';
import { formatReportPeriod, reportPeriodToDateRange } from '../utils/reportPeriod';
import {
  getDashboardIndicatorConfigs,
  type DashboardIndicatorDefinition
} from './dashboardIndicators';

export type DashboardPeriod = { type: 'month'; year: number; month: number };

export type DashboardTrendPoint = {
  label: string;
  value: number;
  value2?: number;
};

export type DashboardBreakdownItem = {
  name: string;
  amount: number;
};

export type DashboardAccountIndicator = {
  id: string;
  label: string;
  amount: number;
  codePrefix: string;
};

export type DashboardData = {
  periodLabel: string;
  funds: {
    total: number;
    bank: number;
    cash: number;
    income: number;
    expense: number;
    netCash: number;
  };
  receivablePayable: {
    receivable: number;
    payable: number;
    receivableItems: DashboardBreakdownItem[];
    payableItems: DashboardBreakdownItem[];
  };
  availableFunds: {
    total: number;
    existing: number;
    shortTermReceivable: number;
    shortTermPayable: number;
    cashRatio: number;
    quickRatio: number;
  };
  netProfit: {
    amount: number;
    margin: number;
    prevChange: number | null;
    trend: DashboardTrendPoint[];
  };
  incomeCost: {
    income: number;
    cost: number;
    grossMargin: number;
    incomePrevChange: number | null;
    costPrevChange: number | null;
    trend: DashboardTrendPoint[];
  };
  expense: {
    total: number;
    prevChange: number | null;
    breakdown: { label: string; amount: number; color: string }[];
    incomeRatio: number;
    costRatio: number;
  };
  vat: {
    estimatedTax: number;
    burdenRate: number;
    trend: DashboardTrendPoint[];
  };
  accountIndicators: DashboardAccountIndicator[];
  accountTrends: Record<string, DashboardTrendPoint[]>;
  accountBreakdowns: Record<string, DashboardBreakdownItem[]>;
};

type TrialRow = {
  code: string;
  name: string;
  endingDebit?: number;
  endingCredit?: number;
  periodDebit?: number;
  periodCredit?: number;
};

type PeriodSnapshot = {
  period: DashboardPeriod;
  periodLabel: string;
  trialRows: TrialRow[];
  incomeValues: Record<string, number>;
  netProfit: number;
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function pctChange(current: number, previous: number): number | null {
  if (Math.abs(previous) < 0.005) return null;
  return roundMoney(((current - previous) / Math.abs(previous)) * 100);
}

function trialNetBalance(row: TrialRow) {
  return roundMoney((row.endingDebit || 0) - (row.endingCredit || 0));
}

function sumExactCodes(rows: TrialRow[], codes: string[]) {
  return roundMoney(
    codes.reduce((sum, code) => {
      const row = rows.find((item) => item.code === code);
      return sum + (row ? trialNetBalance(row) : 0);
    }, 0)
  );
}

function sumCodePrefix(rows: TrialRow[], prefix: string, excludeExact = prefix) {
  return roundMoney(
    rows
      .filter((row) => row.code.startsWith(prefix) && row.code !== excludeExact)
      .reduce((sum, row) => sum + trialNetBalance(row), 0)
  );
}

function breakdownByPrefix(rows: TrialRow[], prefix: string, excludeExact = prefix) {
  return rows
    .filter((row) => row.code.startsWith(prefix) && row.code !== excludeExact)
    .map((row) => ({ name: row.name, amount: trialNetBalance(row) }))
    .filter((row) => Math.abs(row.amount) > 0.005)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
}

function incomeAmount(snapshot: PeriodSnapshot, key: string) {
  return snapshot.incomeValues[key] || 0;
}

function previousMonth(period: DashboardPeriod): DashboardPeriod {
  const date = dayjs(`${period.year}-${String(period.month).padStart(2, '0')}-01`).subtract(
    1,
    'month'
  );
  return { type: 'month', year: date.year(), month: date.month() + 1 };
}

function monthPeriodsEndingAt(period: DashboardPeriod, count: number) {
  const anchor = dayjs(`${period.year}-${String(period.month).padStart(2, '0')}-01`);
  return Array.from({ length: count }, (_, index) => {
    const date = anchor.subtract(count - index - 1, 'month');
    return { type: 'month' as const, year: date.year(), month: date.month() + 1 };
  });
}

async function loadPeriodSnapshot(period: DashboardPeriod): Promise<PeriodSnapshot> {
  const [start, end] = reportPeriodToDateRange(period);
  const startDate = start.format('YYYY-MM-DD');
  const endDate = end.format('YYYY-MM-DD');
  const [trial, income] = await Promise.all([
    Reports.getTrialBalance(startDate, endDate, period),
    Reports.getIncomeStatement(startDate, endDate)
  ]);

  const incomeValues = Object.fromEntries(
    income.rows.filter((row) => row.key).map((row) => [row.key, row.amount || 0])
  );

  return {
    period,
    periodLabel: formatReportPeriod(period),
    trialRows: trial.rows,
    incomeValues,
    netProfit: income.summary.netProfit || 0
  };
}

function indicatorAmount(snapshot: PeriodSnapshot, indicator: DashboardIndicatorDefinition) {
  if (indicator.source === 'income' && indicator.incomeKey) {
    return incomeAmount(snapshot, indicator.incomeKey);
  }
  return sumCodePrefix(snapshot.trialRows, indicator.codePrefix);
}

export function defaultDashboardPeriod(): DashboardPeriod {
  const now = dayjs();
  return { type: 'month', year: now.year(), month: now.month() + 1 };
}

export async function getDashboardData(period: DashboardPeriod): Promise<DashboardData> {
  const indicatorConfigs = await getDashboardIndicatorConfigs();
  const visibleIndicators = indicatorConfigs.filter((item) => item.visible);
  const prevPeriod = previousMonth(period);
  const trendPeriods = monthPeriodsEndingAt(period, 6);
  const snapshots = await Promise.all([
    loadPeriodSnapshot(period),
    loadPeriodSnapshot(prevPeriod),
    ...trendPeriods.map((item) => loadPeriodSnapshot(item))
  ]);

  const current = snapshots[0];
  const previous = snapshots[1];
  const trendSnapshots = snapshots.slice(2);

  const rows = current.trialRows;
  const bank = sumCodePrefix(rows, '1002');
  const cash = sumCodePrefix(rows, '1001');
  const fundsTotal = roundMoney(bank + cash);

  const income = incomeAmount(current, 'revenue');
  const cost = incomeAmount(current, 'cost');
  const adminExpense = incomeAmount(current, 'adminExpense');
  const financeExpense = incomeAmount(current, 'financeExpense');
  const sellingExpense = incomeAmount(current, 'sellingExpense');
  const taxSurcharge = incomeAmount(current, 'taxSurcharge');
  const expenseTotal = roundMoney(adminExpense + financeExpense + sellingExpense + taxSurcharge);
  const prevIncome = incomeAmount(previous, 'revenue');
  const prevCost = incomeAmount(previous, 'cost');
  const prevExpense = roundMoney(
    incomeAmount(previous, 'adminExpense') +
      incomeAmount(previous, 'financeExpense') +
      incomeAmount(previous, 'sellingExpense') +
      incomeAmount(previous, 'taxSurcharge')
  );

  const receivable = sumCodePrefix(rows, '1122');
  const payable = sumCodePrefix(rows, '2202');
  const shortTermPayable = roundMoney(
    sumExactCodes(rows, ['2202', '2211', '2221', '2241']) + sumCodePrefix(rows, '220')
  );
  const shortTermReceivable = roundMoney(
    sumExactCodes(rows, ['1122', '1221']) + sumCodePrefix(rows, '112')
  );
  const existingFunds = fundsTotal;
  const availableTotal = roundMoney(existingFunds + shortTermReceivable - shortTermPayable);
  const currentLiabilities = Math.max(shortTermPayable, 0.005);
  const cashRatio = roundMoney((fundsTotal / currentLiabilities) * 100);
  const quickRatio = roundMoney(
    ((fundsTotal + shortTermReceivable) / currentLiabilities) * 100
  );

  const netProfit = current.netProfit;
  const grossMargin = income > 0 ? roundMoney(((income - cost) / income) * 100) : 0;
  const netMargin = income > 0 ? roundMoney((netProfit / income) * 100) : 0;
  const estimatedTax = sumExactCodes(rows, ['2221']);
  const burdenRate = income > 0 ? roundMoney((estimatedTax / income) * 100) : 0;

  const expenseBreakdown = [
    { label: '管理费用', amount: adminExpense, color: '#5B8FF9' },
    { label: '财务费用', amount: financeExpense, color: '#5AD8A6' },
    { label: '销售费用', amount: sellingExpense, color: '#F6BD16' },
    { label: '税金及附加', amount: taxSurcharge, color: '#E86452' }
  ].filter((item) => Math.abs(item.amount) > 0.005);

  const accountTrends: Record<string, DashboardTrendPoint[]> = {};
  const accountBreakdowns: Record<string, DashboardBreakdownItem[]> = {};

  for (const indicator of indicatorConfigs) {
    accountTrends[indicator.id] = trendSnapshots.map((snapshot) => ({
      label: `${snapshot.period.month}月`,
      value: indicatorAmount(snapshot, indicator)
    }));
    accountBreakdowns[indicator.id] = breakdownByPrefix(current.trialRows, indicator.codePrefix);
  }

  return {
    periodLabel: current.periodLabel,
    funds: {
      total: fundsTotal,
      bank,
      cash,
      income,
      expense: roundMoney(cost + expenseTotal),
      netCash: roundMoney(income - cost - expenseTotal)
    },
    receivablePayable: {
      receivable,
      payable,
      receivableItems: breakdownByPrefix(rows, '1122').slice(0, 5),
      payableItems: breakdownByPrefix(rows, '2202').slice(0, 5)
    },
    availableFunds: {
      total: availableTotal,
      existing: existingFunds,
      shortTermReceivable,
      shortTermPayable,
      cashRatio,
      quickRatio
    },
    netProfit: {
      amount: netProfit,
      margin: netMargin,
      prevChange: pctChange(netProfit, previous.netProfit),
      trend: trendSnapshots.map((snapshot) => ({
        label: `${snapshot.period.month}月`,
        value: snapshot.netProfit,
        value2: snapshot.incomeValues.revenue
          ? roundMoney((snapshot.netProfit / snapshot.incomeValues.revenue) * 100)
          : 0
      }))
    },
    incomeCost: {
      income,
      cost,
      grossMargin,
      incomePrevChange: pctChange(income, prevIncome),
      costPrevChange: pctChange(cost, prevCost),
      trend: trendSnapshots.map((snapshot) => ({
        label: `${snapshot.period.month}月`,
        value: incomeAmount(snapshot, 'revenue'),
        value2: incomeAmount(snapshot, 'cost')
      }))
    },
    expense: {
      total: expenseTotal,
      prevChange: pctChange(expenseTotal, prevExpense),
      breakdown: expenseBreakdown,
      incomeRatio: income > 0 ? roundMoney((expenseTotal / income) * 100) : 0,
      costRatio: cost > 0 ? roundMoney((expenseTotal / cost) * 100) : 0
    },
    vat: {
      estimatedTax,
      burdenRate,
      trend: trendSnapshots.map((snapshot) => ({
        label: `${snapshot.period.month}月`,
        value: sumExactCodes(snapshot.trialRows, ['2221']),
        value2:
          incomeAmount(snapshot, 'revenue') > 0
            ? roundMoney(
                (sumExactCodes(snapshot.trialRows, ['2221']) /
                  incomeAmount(snapshot, 'revenue')) *
                  100
              )
            : 0
      }))
    },
    accountIndicators: visibleIndicators.map((indicator) => ({
      id: indicator.id,
      label: indicator.label,
      codePrefix: indicator.codePrefix,
      amount: indicatorAmount(current, indicator)
    })),
    accountTrends,
    accountBreakdowns
  };
}

export function formatDashboardMoney(value: number) {
  if (Math.abs(value) < 0.005) return '0.00';
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
