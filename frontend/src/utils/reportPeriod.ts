import dayjs from 'dayjs';

export function defaultReportPeriod() {
  const now = dayjs();
  const month = now.month() + 1;
  return {
    type: 'month',
    year: now.year(),
    month,
    quarter: Math.ceil(month / 3)
  };
}

/** 财务报表默认按当前季度 */
export function defaultReportsPeriod() {
  return { ...defaultReportPeriod(), type: 'quarter' as const };
}

/** 普票减免结转默认与损益结转一致，按月 */
export function defaultTaxExemptionPeriod() {
  return { ...defaultReportPeriod(), type: 'month' as 'month' | 'quarter' };
}

export function reportPeriodToDateRange(period) {
  const year = period.year;
  if (period.type === 'quarter') {
    const startMonth = (period.quarter - 1) * 3 + 1;
    const endMonth = period.quarter * 3;
    const start = dayjs(
      `${year}-${String(startMonth).padStart(2, '0')}-01`
    ).startOf('day');
    const end = dayjs(`${year}-${String(endMonth).padStart(2, '0')}-01`).endOf('month');
    return [start, end];
  }
  const start = dayjs(`${year}-${String(period.month).padStart(2, '0')}-01`).startOf('day');
  return [start, start.endOf('month')];
}

export function formatReportPeriod(period) {
  if (period.type === 'quarter') {
    return `${period.year}年第${period.quarter}季度`;
  }
  return `${period.year}年${period.month}期`;
}

/** 普票减免结转期间键：2026-08 / 2026-Q3 */
export function taxExemptionPeriodKey(period) {
  if (period.type === 'quarter') {
    return `${period.year}-Q${period.quarter}`;
  }
  return `${period.year}-${String(period.month).padStart(2, '0')}`;
}

export function voucherInReportPeriod(dateStr, period) {
  const [start, end] = reportPeriodToDateRange(period);
  const d = dayjs(dateStr);
  return !d.isBefore(start, 'day') && !d.isAfter(end, 'day');
}

export function reportPeriodEndDate(period) {
  const year = period.year;
  if (period.type === 'quarter') {
    const endMonth = period.quarter * 3;
    return dayjs(`${year}-${String(endMonth).padStart(2, '0')}-01`)
      .endOf('month')
      .format('YYYY-MM-DD');
  }
  return dayjs(`${year}-${String(period.month).padStart(2, '0')}-01`)
    .endOf('month')
    .format('YYYY-MM-DD');
}

export function formatTaxExemptionPeriod(period) {
  if (period.type === 'quarter') {
    return `${period.year}年第${period.quarter}季度`;
  }
  return `${period.year}年${period.month}月`;
}

export function parseTaxExemptionPeriodKey(key, type = 'month') {
  const periodType = type || 'month';
  if (periodType === 'quarter' || /-Q[1-4]$/.test(key)) {
    const match = key.match(/^(\d{4})-Q([1-4])$/);
    if (match) {
      return { type: 'quarter', year: +match[1], quarter: +match[2] };
    }
  }
  const match = key.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    return { type: 'month', year: +match[1], month: +match[2] };
  }
  return defaultReportPeriod();
}

export function formatStoredTaxExemptionPeriod(voucher) {
  if (!voucher?.taxExemptionPeriod) return '';
  const period = parseTaxExemptionPeriodKey(
    voucher.taxExemptionPeriod,
    voucher.taxExemptionPeriodType || 'month'
  );
  return formatTaxExemptionPeriod(period);
}

/** 损益结转默认按当前月份 */
export function defaultProfitLossClosingPeriod() {
  return { ...defaultReportPeriod(), type: 'month' as const };
}

export function formatStoredProfitLossClosingPeriod(voucher: {
  profitLossClosingPeriod?: string;
  profitLossClosingPeriodType?: string;
}) {
  if (!voucher?.profitLossClosingPeriod) return '';
  const period = parseTaxExemptionPeriodKey(
    voucher.profitLossClosingPeriod,
    voucher.profitLossClosingPeriodType || 'month'
  );
  return formatReportPeriod({ ...period, type: 'month' });
}

export function expectedProfitLossClosingDate(voucher: {
  profitLossClosingPeriod?: string;
  profitLossClosingPeriodType?: string;
}) {
  if (!voucher?.profitLossClosingPeriod) return '';
  const period = parseTaxExemptionPeriodKey(
    voucher.profitLossClosingPeriod,
    voucher.profitLossClosingPeriodType || 'month'
  );
  return reportPeriodEndDate({ ...period, type: 'month' });
}

/** 结转凭证应使用的日期：当前期间最后一天 */
export function expectedCarryForwardDate(voucher) {
  if (!voucher?.taxExemptionPeriod) return '';
  const period = parseTaxExemptionPeriodKey(
    voucher.taxExemptionPeriod,
    voucher.taxExemptionPeriodType || 'month'
  );
  return reportPeriodEndDate(period);
}
