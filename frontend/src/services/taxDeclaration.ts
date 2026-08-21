import { ErpApi } from './erpApi';
import {
  formatQuarterLabel,
  taxExemptionPeriodKey
} from '../utils/reportPeriod';

const SETTING_KEY = 'declaredQuarters';

export const DECLARED_QUARTER_READONLY_TIP =
  '该季度已申报，凭证不可增删改，且不可反结转。如需调整请先在系统设置中取消申报标记';

export type DeclaredQuarterRecord = {
  periodKey: string;
  year: number;
  quarter: number;
  declaredAt: string;
};

export type QuarterPeriod = {
  type: 'quarter';
  year: number;
  quarter: number;
};

function normalizeDeclaredList(value: unknown): DeclaredQuarterRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is DeclaredQuarterRecord =>
      Boolean(item) &&
      typeof item === 'object' &&
      typeof (item as DeclaredQuarterRecord).periodKey === 'string' &&
      typeof (item as DeclaredQuarterRecord).year === 'number' &&
      typeof (item as DeclaredQuarterRecord).quarter === 'number'
  );
}

function quarterFromDate(dateStr: string): QuarterPeriod {
  const year = parseInt(dateStr.slice(0, 4), 10);
  const month = parseInt(dateStr.slice(5, 7), 10);
  return { type: 'quarter', year, quarter: Math.ceil(month / 3) };
}

async function getDeclaredQuarters(): Promise<DeclaredQuarterRecord[]> {
  const raw = await ErpApi.getSetting(SETTING_KEY);
  return normalizeDeclaredList(raw).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.quarter - a.quarter;
  });
}

async function isQuarterDeclared(period: QuarterPeriod): Promise<boolean> {
  const key = taxExemptionPeriodKey(period);
  const list = await getDeclaredQuarters();
  return list.some((record) => record.periodKey === key);
}

async function isDateInDeclaredQuarter(dateStr: string): Promise<boolean> {
  if (!dateStr) return false;
  return isQuarterDeclared(quarterFromDate(dateStr));
}

async function assertDateNotInDeclaredQuarter(dateStr: string): Promise<void> {
  if (!(await isDateInDeclaredQuarter(dateStr))) return;
  const period = quarterFromDate(dateStr);
  throw new Error(
    `${formatQuarterLabel(period.year, period.quarter)} 已申报。${DECLARED_QUARTER_READONLY_TIP}`
  );
}

async function markQuarterDeclared(period: QuarterPeriod): Promise<DeclaredQuarterRecord> {
  const key = taxExemptionPeriodKey(period);
  const list = await getDeclaredQuarters();
  if (list.some((record) => record.periodKey === key)) {
    throw new Error(`${formatQuarterLabel(period.year, period.quarter)} 已申报`);
  }

  const { Voucher } = await import('./voucher');
  await Voucher.lockManyInQuarter(period);

  const record: DeclaredQuarterRecord = {
    periodKey: key,
    year: period.year,
    quarter: period.quarter,
    declaredAt: new Date().toISOString()
  };
  await ErpApi.setSetting(SETTING_KEY, [...list, record]);
  await ErpApi.addAuditLog('标记已申报', '税务', formatQuarterLabel(period.year, period.quarter));
  return record;
}

async function unmarkQuarterDeclared(period: QuarterPeriod): Promise<void> {
  const key = taxExemptionPeriodKey(period);
  const list = await getDeclaredQuarters();
  const next = list.filter((record) => record.periodKey !== key);
  if (next.length === list.length) {
    throw new Error(`${formatQuarterLabel(period.year, period.quarter)} 未申报`);
  }

  const { Voucher } = await import('./voucher');
  await Voucher.unlockManyInQuarter(period);

  await ErpApi.setSetting(SETTING_KEY, next);
  await ErpApi.addAuditLog('取消申报', '税务', formatQuarterLabel(period.year, period.quarter));
}

/** 启动时补齐：已结项季度内凭证状态同步为已结项 */
async function syncDeclaredQuarterVoucherLocks(): Promise<number> {
  const { Voucher } = await import('./voucher');
  const list = await getDeclaredQuarters();
  let total = 0;
  for (const record of list) {
    const result = await Voucher.lockManyInQuarter({
      type: 'quarter',
      year: record.year,
      quarter: record.quarter
    });
    total += result.locked;
  }
  return total;
}

export const TaxDeclaration = {
  DECLARED_QUARTER_READONLY_TIP,
  getDeclaredQuarters,
  isQuarterDeclared,
  isDateInDeclaredQuarter,
  assertDateNotInDeclaredQuarter,
  markQuarterDeclared,
  unmarkQuarterDeclared,
  syncDeclaredQuarterVoucherLocks,
  quarterFromDate
};
