import { Reports } from './reports';
import { TaxExemption } from './taxExemption';
import { Salary } from './salary';

function roundMoney(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function incomeRowAmount(
  rows: Array<{ key?: string; periodAmount?: number | null; ytdAmount?: number | null }>,
  key: string,
  field: 'periodAmount' | 'ytdAmount'
) {
  const row = rows.find((item) => item.key === key);
  return roundMoney(Number(row?.[field]) || 0);
}

function trialEndingBalance(
  rows: Array<{ code?: string; endingDebit?: number | null; endingCredit?: number | null }>,
  code: string
) {
  const row = rows.find((item) => item.code === code);
  if (!row) return 0;
  return roundMoney((Number(row.endingCredit) || 0) - (Number(row.endingDebit) || 0));
}

function toPayrollPeriodKey(date: string) {
  return String(date || '').slice(0, 7);
}

function shiftPayrollMonth(year: number, month: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * 人力成本默认取值月份：
 * - 按月：查询月的上月
 * - 按季：本季「当月」的上月（当月=今天落在本季则取今天所在月，否则取季度末月）
 */
function resolvePayrollReferenceKey(period: {
  type: string;
  year: number;
  month?: number;
  quarter?: number;
}) {
  if (period.type === 'quarter' && period.quarter) {
    const startMonth = (period.quarter - 1) * 3 + 1;
    const endMonth = period.quarter * 3;
    const now = new Date();
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth() + 1;
    let anchorMonth = endMonth;
    if (period.year === nowYear && nowMonth >= startMonth && nowMonth <= endMonth) {
      anchorMonth = nowMonth;
    } else if (period.year > nowYear || (period.year === nowYear && startMonth > nowMonth)) {
      return null;
    }
    return shiftPayrollMonth(period.year, anchorMonth, -1);
  }

  if (period.month) {
    return shiftPayrollMonth(period.year, period.month, -1);
  }
  return null;
}

/** 默认按小型微利企业常见有效税率（可在页面调整） */
export const DEFAULT_CIT_RATE_PERCENT = 5;

/** 附加税默认税率：城建税（市区常见 7%）+ 教育费附加 3% + 地方教育附加 2% */
export const DEFAULT_SURCHARGE_RATES = {
  cityPercent: 7,
  educationPercent: 3,
  localEducationPercent: 2
} as const;

export type SurchargeRatePercents = {
  cityPercent: number;
  educationPercent: number;
  localEducationPercent: number;
};

export type TaxEstimateSurcharge = {
  cityPercent: number;
  educationPercent: number;
  localEducationPercent: number;
  totalPercent: number;
  cityTax: number;
  educationTax: number;
  localEducationTax: number;
  total: number;
  totalBeforeExemption: number;
  bookedTaxSurcharge: number;
  remainingToAccrue: number;
};

export type CitPayrollAdjustmentValues = {
  unbookedSalaryGross: number;
  unbookedLaborGross: number;
  unbookedCompanySocialSecurity: number;
  unbookedCompanyHousingFund: number;
};

export type CitPayrollAdjustment = CitPayrollAdjustmentValues & {
  total: number;
  ytdTotal: number;
  autoTotal: number;
  ytdAutoTotal: number;
  monthCount: number;
  ytdMonthCount: number;
  previousPeriodKey: string | null;
  fromPreviousMonth: {
    unbookedSalaryGross: boolean;
    unbookedLaborGross: boolean;
    unbookedCompanySocialSecurity: boolean;
    unbookedCompanyHousingFund: boolean;
  };
};

export type TaxEstimateResult = {
  startDate: string;
  endDate: string;
  hasDraftInPeriod: boolean;
  vat: {
    ordinaryPendingTax: number;
    ordinaryDoneTax: number;
    specialTax: number;
    ordinaryWithoutTaxCount: number;
    outputTaxTotal: number;
    estimatedPayableAfterExemption: number;
    estimatedPayableBeforeExemption: number;
    taxPayableBalance: number;
    estimatedPayableWithSurcharge: number;
    estimatedPayableWithSurchargeBeforeExemption: number;
    surcharge: TaxEstimateSurcharge;
  };
  cit: {
    revenue: number;
    bookedTotalProfit: number;
    bookedYtdTotalProfit: number;
    totalProfit: number;
    ytdTotalProfit: number;
    incomeTaxExpense: number;
    /** 查询期间 5801，保留供对照；界面展示用本年累计 */
    priorPeriodCitPaid: number;
    /** 年初至查询截止日的 5801，即本年度已缴纳企业所得税 */
    ytdIncomeTaxExpense: number;
    ratePercent: number;
    estimatedTax: number;
    ytdEstimatedTax: number;
    remainingToAccrue: number;
    payrollAdjustment: CitPayrollAdjustment;
  };
};

function normalizeRate(value: unknown, fallback: number) {
  if (value == null || Number.isNaN(Number(value))) return fallback;
  return Math.max(0, Number(value));
}

function sumPayrollValues(values: CitPayrollAdjustmentValues) {
  return roundMoney(
    Number(values.unbookedSalaryGross || 0) +
      Number(values.unbookedLaborGross || 0) +
      Number(values.unbookedCompanySocialSecurity || 0) +
      Number(values.unbookedCompanyHousingFund || 0)
  );
}

function emptyPayrollAdjustment(): CitPayrollAdjustment {
  return {
    unbookedSalaryGross: 0,
    unbookedLaborGross: 0,
    unbookedCompanySocialSecurity: 0,
    unbookedCompanyHousingFund: 0,
    total: 0,
    ytdTotal: 0,
    autoTotal: 0,
    ytdAutoTotal: 0,
    monthCount: 0,
    ytdMonthCount: 0,
    previousPeriodKey: null,
    fromPreviousMonth: {
      unbookedSalaryGross: false,
      unbookedLaborGross: false,
      unbookedCompanySocialSecurity: false,
      unbookedCompanyHousingFund: false
    }
  };
}

/** 未入账人力成本默认取参考月工资表金额，可再手工修改。 */
function pickDefaultAmount(previous: number): { value: number; fromPreviousMonth: boolean } {
  return { value: roundMoney(Math.max(0, previous)), fromPreviousMonth: true };
}

export function buildSurchargeEstimate(
  vatBaseAfterExemption: number,
  vatBaseBeforeExemption: number,
  bookedTaxSurcharge: number,
  rates: SurchargeRatePercents = DEFAULT_SURCHARGE_RATES
): TaxEstimateSurcharge {
  const cityPercent = normalizeRate(rates.cityPercent, DEFAULT_SURCHARGE_RATES.cityPercent);
  const educationPercent = normalizeRate(
    rates.educationPercent,
    DEFAULT_SURCHARGE_RATES.educationPercent
  );
  const localEducationPercent = normalizeRate(
    rates.localEducationPercent,
    DEFAULT_SURCHARGE_RATES.localEducationPercent
  );
  const totalPercent = roundMoney(cityPercent + educationPercent + localEducationPercent);
  const base = Math.max(0, vatBaseAfterExemption);
  const baseBefore = Math.max(0, vatBaseBeforeExemption);

  const cityTax = roundMoney(base * (cityPercent / 100));
  const educationTax = roundMoney(base * (educationPercent / 100));
  const localEducationTax = roundMoney(base * (localEducationPercent / 100));
  const total = roundMoney(cityTax + educationTax + localEducationTax);
  const totalBeforeExemption = roundMoney(baseBefore * (totalPercent / 100));

  return {
    cityPercent,
    educationPercent,
    localEducationPercent,
    totalPercent,
    cityTax,
    educationTax,
    localEducationTax,
    total,
    totalBeforeExemption,
    bookedTaxSurcharge: roundMoney(bookedTaxSurcharge),
    remainingToAccrue: roundMoney(Math.max(0, total - bookedTaxSurcharge))
  };
}

export function applyEstimateRates(
  data: TaxEstimateResult,
  options: {
    citRatePercent?: number;
    surchargeRates?: Partial<SurchargeRatePercents>;
    payrollAdjustment?: Partial<CitPayrollAdjustmentValues>;
  } = {}
): TaxEstimateResult {
  const citRatePercent = normalizeRate(options.citRatePercent, data.cit.ratePercent);
  const surchargeRates: SurchargeRatePercents = {
    cityPercent: normalizeRate(
      options.surchargeRates?.cityPercent,
      data.vat.surcharge.cityPercent
    ),
    educationPercent: normalizeRate(
      options.surchargeRates?.educationPercent,
      data.vat.surcharge.educationPercent
    ),
    localEducationPercent: normalizeRate(
      options.surchargeRates?.localEducationPercent,
      data.vat.surcharge.localEducationPercent
    )
  };

  const baseAdj = data.cit.payrollAdjustment || emptyPayrollAdjustment();
  const payrollValues: CitPayrollAdjustmentValues = {
    unbookedSalaryGross: roundMoney(
      options.payrollAdjustment?.unbookedSalaryGross ?? baseAdj.unbookedSalaryGross
    ),
    unbookedLaborGross: roundMoney(
      options.payrollAdjustment?.unbookedLaborGross ?? baseAdj.unbookedLaborGross
    ),
    unbookedCompanySocialSecurity: roundMoney(
      options.payrollAdjustment?.unbookedCompanySocialSecurity ??
        baseAdj.unbookedCompanySocialSecurity
    ),
    unbookedCompanyHousingFund: roundMoney(
      options.payrollAdjustment?.unbookedCompanyHousingFund ?? baseAdj.unbookedCompanyHousingFund
    )
  };
  const periodTotal = sumPayrollValues(payrollValues);
  const ytdTotal = roundMoney(baseAdj.ytdAutoTotal - baseAdj.autoTotal + periodTotal);
  const payrollAdjustment: CitPayrollAdjustment = {
    ...baseAdj,
    ...payrollValues,
    total: periodTotal,
    ytdTotal
  };

  const totalProfit = roundMoney(data.cit.bookedTotalProfit - periodTotal);
  const ytdTotalProfit = roundMoney(data.cit.bookedYtdTotalProfit - ytdTotal);

  const rate = citRatePercent / 100;
  const estimatedTax = roundMoney(Math.max(0, totalProfit) * rate);
  const ytdEstimatedTax = roundMoney(Math.max(0, ytdTotalProfit) * rate);
  const ytdPaid = roundMoney(data.cit.ytdIncomeTaxExpense);
  const remainingToAccrue = roundMoney(Math.max(0, ytdEstimatedTax - ytdPaid));

  const surcharge = buildSurchargeEstimate(
    data.vat.estimatedPayableAfterExemption,
    data.vat.estimatedPayableBeforeExemption,
    data.vat.surcharge.bookedTaxSurcharge,
    surchargeRates
  );

  return {
    ...data,
    vat: {
      ...data.vat,
      surcharge,
      estimatedPayableWithSurcharge: roundMoney(
        data.vat.estimatedPayableAfterExemption + surcharge.total
      ),
      estimatedPayableWithSurchargeBeforeExemption: roundMoney(
        data.vat.estimatedPayableBeforeExemption + surcharge.totalBeforeExemption
      )
    },
    cit: {
      ...data.cit,
      totalProfit,
      ytdTotalProfit,
      ratePercent: citRatePercent,
      estimatedTax,
      ytdEstimatedTax,
      remainingToAccrue,
      payrollAdjustment
    }
  };
}

export async function getTaxEstimate(
  period: { type: string; year: number; month?: number; quarter?: number },
  startDate: string,
  endDate: string,
  options: {
    virtualClosing?: boolean;
    citRatePercent?: number;
    surchargeRates?: Partial<SurchargeRatePercents>;
  } = {}
): Promise<TaxEstimateResult> {
  const periodStartKey = toPayrollPeriodKey(startDate);
  const periodEndKey = toPayrollPeriodKey(endDate);
  const ytdStartKey = `${periodEndKey.slice(0, 4)}-01`;
  const previousKey = resolvePayrollReferenceKey(period);

  const [income, taxSummary, trial, periodPayroll, ytdPayroll, previousSnapshot] =
    await Promise.all([
      Reports.getIncomeStatement(startDate, endDate, period, {
        virtualClosing: options.virtualClosing
      }),
      TaxExemption.getPeriodSummary(period, { includeDrafts: true }),
      Reports.getTrialBalance(startDate, endDate, period, {
        virtualClosing: options.virtualClosing
      }),
      Salary.getUnbookedPayrollCostSummary(periodStartKey, periodEndKey),
      Salary.getUnbookedPayrollCostSummary(ytdStartKey, periodEndKey),
      previousKey ? Salary.getMonthCostSnapshot(previousKey) : Promise.resolve(null)
    ]);

  const ordinaryPendingTax = roundMoney(taxSummary.pendingTaxTotal || 0);
  const ordinaryDoneTax = roundMoney(
    (taxSummary.ordinaryDone || []).reduce((sum, line) => sum + (line.taxAmount || 0), 0)
  );
  const specialTax = roundMoney(
    (taxSummary.specialInvoices || []).reduce((sum, item) => sum + (item.taxAmount || 0), 0)
  );
  const outputTaxTotal = roundMoney(ordinaryPendingTax + ordinaryDoneTax + specialTax);
  const estimatedPayableAfterExemption = specialTax;
  const estimatedPayableBeforeExemption = roundMoney(specialTax + ordinaryPendingTax);
  const bookedTaxSurcharge = incomeRowAmount(income.rows || [], 'taxSurcharge', 'periodAmount');

  const bookedTotalProfit = incomeRowAmount(income.rows || [], 'totalProfit', 'periodAmount');
  const bookedYtdTotalProfit = incomeRowAmount(income.rows || [], 'totalProfit', 'ytdAmount');

  const salaryDefault = pickDefaultAmount(previousSnapshot?.salaryGross || 0);
  const laborDefault = pickDefaultAmount(previousSnapshot?.laborGross || 0);
  const ssDefault = pickDefaultAmount(previousSnapshot?.companySocialSecurity || 0);
  const hfDefault = pickDefaultAmount(previousSnapshot?.companyHousingFund || 0);

  const autoValues: CitPayrollAdjustmentValues = {
    unbookedSalaryGross: salaryDefault.value,
    unbookedLaborGross: laborDefault.value,
    unbookedCompanySocialSecurity: ssDefault.value,
    unbookedCompanyHousingFund: hfDefault.value
  };
  const autoTotal = sumPayrollValues(autoValues);
  const ytdAutoTotal = roundMoney(ytdPayroll.total - periodPayroll.total + autoTotal);

  const payrollAdjustment: CitPayrollAdjustment = {
    ...autoValues,
    total: autoTotal,
    ytdTotal: ytdAutoTotal,
    autoTotal,
    ytdAutoTotal,
    monthCount: periodPayroll.monthCount,
    ytdMonthCount: ytdPayroll.monthCount,
    previousPeriodKey: previousKey,
    fromPreviousMonth: {
      unbookedSalaryGross: salaryDefault.fromPreviousMonth,
      unbookedLaborGross: laborDefault.fromPreviousMonth,
      unbookedCompanySocialSecurity: ssDefault.fromPreviousMonth,
      unbookedCompanyHousingFund: hfDefault.fromPreviousMonth
    }
  };

  const base: TaxEstimateResult = {
    startDate,
    endDate,
    hasDraftInPeriod: Boolean(income.hasDraftInPeriod || trial.hasDraftInPeriod),
    vat: {
      ordinaryPendingTax,
      ordinaryDoneTax,
      specialTax,
      ordinaryWithoutTaxCount: taxSummary.ordinaryWithoutTax?.length || 0,
      outputTaxTotal,
      estimatedPayableAfterExemption,
      estimatedPayableBeforeExemption,
      taxPayableBalance: trialEndingBalance(trial.rows || [], '2221'),
      estimatedPayableWithSurcharge: 0,
      estimatedPayableWithSurchargeBeforeExemption: 0,
      surcharge: buildSurchargeEstimate(0, 0, bookedTaxSurcharge)
    },
    cit: {
      revenue: incomeRowAmount(income.rows || [], 'revenue', 'periodAmount'),
      bookedTotalProfit,
      bookedYtdTotalProfit,
      totalProfit: bookedTotalProfit,
      ytdTotalProfit: bookedYtdTotalProfit,
      incomeTaxExpense: 0,
      priorPeriodCitPaid: incomeRowAmount(income.rows || [], 'incomeTax', 'periodAmount'),
      ytdIncomeTaxExpense: incomeRowAmount(income.rows || [], 'incomeTax', 'ytdAmount'),
      ratePercent: DEFAULT_CIT_RATE_PERCENT,
      estimatedTax: 0,
      ytdEstimatedTax: 0,
      remainingToAccrue: 0,
      payrollAdjustment
    }
  };

  return applyEstimateRates(base, {
    citRatePercent: options.citRatePercent,
    surchargeRates: options.surchargeRates
  });
}

export const TaxEstimate = {
  getTaxEstimate,
  applyEstimateRates,
  buildSurchargeEstimate,
  DEFAULT_CIT_RATE_PERCENT,
  DEFAULT_SURCHARGE_RATES
};
