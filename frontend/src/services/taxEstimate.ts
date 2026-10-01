import { Reports } from './reports';
import { TaxExemption } from './taxExemption';
import { Salary } from './salary';
import { Voucher } from './voucher';
import type { Voucher as VoucherRecord } from '../types';
import { isCarryForwardVoucher } from '../utils/carryForwardVoucher';

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

function accountStartsWith(code: string | undefined, prefix: string) {
  const normalized = String(code || '').trim();
  return normalized === prefix || normalized.startsWith(prefix);
}

function entrySideAmount(entry: { debit?: string | number; credit?: string | number }, side: 'debit' | 'credit') {
  const n = Number(entry[side]);
  return Number.isFinite(n) ? n : 0;
}

function voucherSearchText(voucher: VoucherRecord) {
  const entryText = (voucher.entries || []).map((entry) => entry.summary || '').join(' ');
  return `${voucher.remark || ''} ${entryText}`;
}

/** 是否企业所得税相关（排除个人所得税 / 代扣个税） */
function isCorporateIncomeTaxText(text: string) {
  const source = String(text || '');
  if (!source.trim()) return false;
  if (/个人所得|代扣个税|代扣.*所得税|劳务报酬.*税/.test(source)) return false;
  if (/企业所得税|企税|应交所得税|所得税费用/.test(source)) return true;
  // 「缴纳上期所得税」等简写
  return /所得税/.test(source) && !/个人|代扣|个税/.test(source);
}

/**
 * 企业所得税计提：仅认「借 5801 / 贷 2221」类凭证（含借方红字冲回）。
 * 缴纳上期（借 2221 / 贷银行，或摘要含缴纳、误记 5801）一律排除。
 */
function sumCitAccrualExpense(vouchers: VoucherRecord[], fromDate: string, toDate: string) {
  let total = 0;
  for (const voucher of vouchers) {
    if (isCarryForwardVoucher(voucher)) continue;
    if (voucher.date < fromDate || voucher.date > toDate) continue;

    const text = voucherSearchText(voucher);
    let debit5801 = 0;
    let credit5801 = 0;
    let credit2221 = 0;
    let creditBank = 0;
    for (const entry of voucher.entries || []) {
      if (accountStartsWith(entry.accountCode, '5801')) {
        debit5801 += entrySideAmount(entry, 'debit');
        credit5801 += entrySideAmount(entry, 'credit');
      }
      if (accountStartsWith(entry.accountCode, '2221')) {
        credit2221 += entrySideAmount(entry, 'credit');
      }
      if (
        accountStartsWith(entry.accountCode, '1002') ||
        accountStartsWith(entry.accountCode, '1001')
      ) {
        creditBank += entrySideAmount(entry, 'credit');
      }
    }

    // 净发生额：正数为计提，负数为红字冲回多计提
    const net5801 = roundMoney(debit5801 - credit5801);
    if (Math.abs(net5801) <= 0.005) continue;

    const mentionsPay = /缴纳/.test(text);
    const mentionsAccrue = /计提|冲回|红字/.test(text);
    // 缴纳凭证（含误把实缴记到 5801）不计入计提
    if (mentionsPay && !mentionsAccrue) continue;
    if (Math.abs(creditBank) > 0.005 && (mentionsPay || Math.abs(credit2221) <= 0.005)) continue;

    const looksLikeAccrual =
      (Math.abs(debit5801) > 0.005 && Math.abs(credit2221) > 0.005) ||
      (mentionsAccrue && isCorporateIncomeTaxText(text) && Math.abs(debit5801) > 0.005) ||
      (Math.abs(debit5801) > 0.005 &&
        Math.abs(credit2221) > 0.005 &&
        !/个人所得|代扣个税/.test(text));
    if (!looksLikeAccrual) continue;

    total += net5801;
  }
  return roundMoney(total);
}

/**
 * 本期缴纳企业所得税：只累加摘要明确为企税的 2221 借方。
 * 避免把个人所得税、增值税/附加等同凭证其他税种算进来。
 */
function sumCitPaymentAmount(vouchers: VoucherRecord[], fromDate: string, toDate: string) {
  let total = 0;
  for (const voucher of vouchers) {
    if (isCarryForwardVoucher(voucher)) continue;
    if (voucher.date < fromDate || voucher.date > toDate) continue;

    const text = voucherSearchText(voucher);
    if (!/缴纳/.test(text)) continue;
    if (/计提/.test(text) && !/缴纳/.test(text)) continue;

    let creditBank = 0;
    let citPayDebit = 0;
    for (const entry of voucher.entries || []) {
      if (
        accountStartsWith(entry.accountCode, '1002') ||
        accountStartsWith(entry.accountCode, '1001')
      ) {
        creditBank += entrySideAmount(entry, 'credit');
        continue;
      }
      if (!accountStartsWith(entry.accountCode, '2221')) continue;
      const debit = entrySideAmount(entry, 'debit');
      if (debit <= 0.005) continue;
      const entryText = String(entry.summary || '');
      // 分录摘要优先；摘要空时才回退到整张凭证文案
      if (entryText.trim() ? isCorporateIncomeTaxText(entryText) : isCorporateIncomeTaxText(text)) {
        citPayDebit += debit;
      }
    }

    if (citPayDebit <= 0.005 || creditBank <= 0.005) continue;
    total += citPayDebit;
  }
  return roundMoney(total);
}

function shiftPayrollMonth(year: number, month: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * 未入账人力只在查询当月或当前季度时预填。
 * 参考金额取「当月」的上月工资表；若当月工资表已关联对应凭证，该项视为已入账填 0。
 */
function resolvePayrollReferenceKey(period: {
  type: string;
  year: number;
  month?: number;
  quarter?: number;
}) {
  const currentKey = resolvePayrollCurrentKey(period);
  if (!currentKey) return null;
  const [yearText, monthText] = currentKey.split('-');
  return shiftPayrollMonth(Number(yearText), Number(monthText), -1);
}

/** 查询当月，或当前季度里「今天所在月」 */
function resolvePayrollCurrentKey(period: {
  type: string;
  year: number;
  month?: number;
  quarter?: number;
}) {
  const now = new Date();
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth() + 1;
  const nowQuarter = Math.ceil(nowMonth / 3);

  if (period.type === 'quarter' && period.quarter) {
    if (period.year !== nowYear || period.quarter !== nowQuarter) return null;
    return `${period.year}-${String(nowMonth).padStart(2, '0')}`;
  }

  if (period.month) {
    if (period.year !== nowYear || period.month !== nowMonth) return null;
    return `${period.year}-${String(period.month).padStart(2, '0')}`;
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

/** 附加税减免：本期减免税额固定为教育费附加+地方教育附加；六税两费默认减半（50%） */
export const DEFAULT_SURCHARGE_RELIEF = {
  sixTaxTwoFeePercent: 50,
  /** 本期已缴税（费）额；预估通常为 0 */
  periodPaidAmount: 0
} as const;

export type SurchargeRatePercents = {
  cityPercent: number;
  educationPercent: number;
  localEducationPercent: number;
};

export type SurchargeReliefOptions = {
  /** 增值税小规模纳税人「六税两费」减征比例（%） */
  sixTaxTwoFeePercent: number;
  /** 本期已缴税（费）额（附列资料第 9 栏） */
  periodPaidAmount: number;
};

export type TaxEstimateSurcharge = {
  cityPercent: number;
  educationPercent: number;
  localEducationPercent: number;
  totalPercent: number;
  /** 第 4 栏分项：城建税本期应纳税（费）额 */
  cityTax: number;
  educationTax: number;
  localEducationTax: number;
  /** 第 4 栏合计：本期应纳税（费）额 */
  taxableAmount: number;
  /** 第 6 栏合计：固定 = 教育费附加 + 地方教育附加 */
  periodExemptionAmount: number;
  sixTaxTwoFeePercent: number;
  /** 第 8 栏合计：六税两费减征额 = (4 − 6) × 7 */
  sixTaxTwoFeeAmount: number;
  /** 第 9 栏合计：本期已缴税（费）额 */
  periodPaidAmount: number;
  /** 第 10 栏合计：本期应补（退）税（费）额 = 4 − 6 − 8 − 9 */
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
  alreadyBooked: {
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
  /** 所属季度已申报结项：只读展示账面实际数，不计未入账成本 */
  settled: boolean;
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
    /** 本期企业所得税计提（仅借 5801 / 贷 2221，不含缴纳） */
    priorPeriodCitPaid: number;
    /** 本期缴纳上期企业所得税（借 2221 / 贷银行） */
    periodCitPaid: number;
    /** 本年累计已缴纳企业所得税（借 2221 / 贷银行） */
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
    },
    alreadyBooked: {
      unbookedSalaryGross: false,
      unbookedLaborGross: false,
      unbookedCompanySocialSecurity: false,
      unbookedCompanyHousingFund: false
    }
  };
}

/** 未入账人力成本默认取参考月工资表金额；当月已关联对应凭证则填 0。 */
function pickDefaultAmount(
  previous: number,
  alreadyBooked: boolean
): { value: number; fromPreviousMonth: boolean; alreadyBooked: boolean } {
  if (alreadyBooked) {
    return { value: 0, fromPreviousMonth: false, alreadyBooked: true };
  }
  return {
    value: roundMoney(Math.max(0, previous)),
    fromPreviousMonth: true,
    alreadyBooked: false
  };
}

export function buildSurchargeEstimate(
  vatBaseAfterExemption: number,
  vatBaseBeforeExemption: number,
  bookedTaxSurcharge: number,
  rates: SurchargeRatePercents = DEFAULT_SURCHARGE_RATES,
  relief: SurchargeReliefOptions = DEFAULT_SURCHARGE_RELIEF
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

  // 第 4 栏：本期应纳税（费）额 = 增值税税额 × 税（费）率
  const cityTax = roundMoney(base * (cityPercent / 100));
  const educationTax = roundMoney(base * (educationPercent / 100));
  const localEducationTax = roundMoney(base * (localEducationPercent / 100));
  const taxableAmount = roundMoney(cityTax + educationTax + localEducationTax);

  // 第 6 栏：固定 = 教育费附加 + 地方教育附加
  const periodExemptionAmount = roundMoney(educationTax + localEducationTax);
  const sixTaxTwoFeePercent = normalizeRate(
    relief.sixTaxTwoFeePercent,
    DEFAULT_SURCHARGE_RELIEF.sixTaxTwoFeePercent
  );
  const periodPaidAmount = roundMoney(
    Math.max(
      0,
      normalizeRate(relief.periodPaidAmount, DEFAULT_SURCHARGE_RELIEF.periodPaidAmount)
    )
  );

  // 第 8 栏：减征额 = (4 − 6) × 减征比例；第 10 栏：应补退 = 4 − 6 − 8 − 9
  const afterPeriodExemption = Math.max(0, taxableAmount - periodExemptionAmount);
  const sixTaxTwoFeeAmount = roundMoney(afterPeriodExemption * (sixTaxTwoFeePercent / 100));
  const total = roundMoney(
    Math.max(0, afterPeriodExemption - sixTaxTwoFeeAmount - periodPaidAmount)
  );

  const educationTaxBefore = roundMoney(baseBefore * (educationPercent / 100));
  const localEducationTaxBefore = roundMoney(baseBefore * (localEducationPercent / 100));
  const taxableBefore = roundMoney(baseBefore * (totalPercent / 100));
  const exemptionBefore = roundMoney(educationTaxBefore + localEducationTaxBefore);
  const afterBefore = Math.max(0, taxableBefore - exemptionBefore);
  const sixTaxBefore = roundMoney(afterBefore * (sixTaxTwoFeePercent / 100));
  const totalBeforeExemption = roundMoney(
    Math.max(0, afterBefore - sixTaxBefore - periodPaidAmount)
  );

  return {
    cityPercent,
    educationPercent,
    localEducationPercent,
    totalPercent,
    cityTax,
    educationTax,
    localEducationTax,
    taxableAmount,
    periodExemptionAmount,
    sixTaxTwoFeePercent,
    sixTaxTwoFeeAmount,
    periodPaidAmount,
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
    surchargeRelief?: Partial<SurchargeReliefOptions>;
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
  const surchargeRelief: SurchargeReliefOptions = {
    sixTaxTwoFeePercent: normalizeRate(
      options.surchargeRelief?.sixTaxTwoFeePercent,
      data.vat.surcharge.sixTaxTwoFeePercent
    ),
    periodPaidAmount: normalizeRate(
      options.surchargeRelief?.periodPaidAmount,
      data.vat.surcharge.periodPaidAmount
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
  const ytdTotal = periodTotal;
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
    surchargeRates,
    surchargeRelief
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
    settled?: boolean;
    citRatePercent?: number;
    surchargeRates?: Partial<SurchargeRatePercents>;
    surchargeRelief?: Partial<SurchargeReliefOptions>;
  } = {}
): Promise<TaxEstimateResult> {
  const settled = Boolean(options.settled);
  const previousKey = settled ? null : resolvePayrollReferenceKey(period);
  const currentKey = settled ? null : resolvePayrollCurrentKey(period);

  const [income, taxSummary, trial, previousSnapshot, currentMonthBooking, vouchers] =
    await Promise.all([
      Reports.getIncomeStatement(startDate, endDate, period, {
        virtualClosing: options.virtualClosing
      }),
      TaxExemption.getPeriodSummary(period, { includeDrafts: true }),
      Reports.getTrialBalance(startDate, endDate, period, {
        virtualClosing: options.virtualClosing
      }),
      previousKey ? Salary.getMonthCostSnapshot(previousKey) : Promise.resolve(null),
      currentKey ? Salary.getMonthBookingFlags(currentKey) : Promise.resolve(null),
      Voucher.getAll()
    ]);

  const yearStart = `${endDate.slice(0, 4)}-01-01`;
  const periodCitAccrued = sumCitAccrualExpense(vouchers, startDate, endDate);
  const periodCitPaid = sumCitPaymentAmount(vouchers, startDate, endDate);
  const ytdCitPaid = sumCitPaymentAmount(vouchers, yearStart, endDate);

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

  const salaryDefault = settled
    ? { value: 0, fromPreviousMonth: false, alreadyBooked: true }
    : pickDefaultAmount(
        previousSnapshot?.salaryGross || 0,
        Boolean(currentMonthBooking?.salaryLinked)
      );
  const laborDefault = settled
    ? { value: 0, fromPreviousMonth: false, alreadyBooked: true }
    : pickDefaultAmount(
        previousSnapshot?.laborGross || 0,
        Boolean(currentMonthBooking?.laborLinked)
      );
  const ssDefault = settled
    ? { value: 0, fromPreviousMonth: false, alreadyBooked: true }
    : pickDefaultAmount(
        previousSnapshot?.companySocialSecurity || 0,
        Boolean(currentMonthBooking?.socialSecurityLinked)
      );
  const hfDefault = settled
    ? { value: 0, fromPreviousMonth: false, alreadyBooked: true }
    : pickDefaultAmount(
        previousSnapshot?.companyHousingFund || 0,
        Boolean(currentMonthBooking?.housingFundLinked)
      );

  const autoValues: CitPayrollAdjustmentValues = {
    unbookedSalaryGross: salaryDefault.value,
    unbookedLaborGross: laborDefault.value,
    unbookedCompanySocialSecurity: ssDefault.value,
    unbookedCompanyHousingFund: hfDefault.value
  };
  const autoTotal = sumPayrollValues(autoValues);
  const ytdAutoTotal = autoTotal;

  const payrollAdjustment: CitPayrollAdjustment = {
    ...autoValues,
    total: autoTotal,
    ytdTotal: ytdAutoTotal,
    autoTotal,
    ytdAutoTotal,
    monthCount: previousSnapshot || currentMonthBooking ? 1 : 0,
    ytdMonthCount: previousSnapshot || currentMonthBooking ? 1 : 0,
    previousPeriodKey: previousKey,
    fromPreviousMonth: {
      unbookedSalaryGross: salaryDefault.fromPreviousMonth,
      unbookedLaborGross: laborDefault.fromPreviousMonth,
      unbookedCompanySocialSecurity: ssDefault.fromPreviousMonth,
      unbookedCompanyHousingFund: hfDefault.fromPreviousMonth
    },
    alreadyBooked: {
      unbookedSalaryGross: salaryDefault.alreadyBooked,
      unbookedLaborGross: laborDefault.alreadyBooked,
      unbookedCompanySocialSecurity: ssDefault.alreadyBooked,
      unbookedCompanyHousingFund: hfDefault.alreadyBooked
    }
  };

  const base: TaxEstimateResult = {
    startDate,
    endDate,
    hasDraftInPeriod: Boolean(income.hasDraftInPeriod || trial.hasDraftInPeriod),
    settled,
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
      priorPeriodCitPaid: periodCitAccrued,
      periodCitPaid,
      ytdIncomeTaxExpense: ytdCitPaid,
      ratePercent: DEFAULT_CIT_RATE_PERCENT,
      estimatedTax: 0,
      ytdEstimatedTax: 0,
      remainingToAccrue: 0,
      payrollAdjustment
    }
  };

  return applyEstimateRates(base, {
    citRatePercent: options.citRatePercent,
    surchargeRates: options.surchargeRates,
    surchargeRelief: options.surchargeRelief
  });
}

export const TaxEstimate = {
  getTaxEstimate,
  applyEstimateRates,
  buildSurchargeEstimate,
  DEFAULT_CIT_RATE_PERCENT,
  DEFAULT_SURCHARGE_RATES,
  DEFAULT_SURCHARGE_RELIEF
};
