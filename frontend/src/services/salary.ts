import { ErpApi } from './erpApi';
import { Voucher } from './voucher';
import { TaxDeclaration } from './taxDeclaration';
import type { Voucher as VoucherRecord } from '../types';

const SETTING_KEY = 'payrollPeriods';

export type PayrollVoucherLinkType =
  | 'accrual'
  | 'payment'
  | 'laborAccrual'
  | 'laborPayment'
  | 'tax'
  | 'socialSecurity'
  | 'housingFund'
  | 'other';

export type PayrollCreationMethod = 'import' | 'manual' | 'copy';

export const PAYROLL_VOUCHER_LABELS: Record<PayrollVoucherLinkType, string> = {
  accrual: '计提工资凭证',
  payment: '发放工资凭证',
  laborAccrual: '计提劳务凭证',
  laborPayment: '支付劳务凭证',
  tax: '缴个税凭证',
  socialSecurity: '社保扣款凭证',
  housingFund: '公积金扣款凭证',
  other: '其他'
};

export const PAYROLL_VOUCHER_SHORT_LABELS: Record<PayrollVoucherLinkType, string> = {
  accrual: '工资',
  payment: '工资',
  laborAccrual: '劳务',
  laborPayment: '劳务',
  tax: '个税',
  socialSecurity: '社保',
  housingFund: '公积金',
  other: '其他'
};

export const PAYROLL_VOUCHER_TAG_CLASS: Record<
  'wage' | 'labor' | 'socialSecurity' | 'housingFund' | 'tax' | 'other',
  string
> = {
  wage: 'payroll-sheet-list__voucher-badge-tag--wage',
  labor: 'payroll-sheet-list__voucher-badge-tag--labor',
  socialSecurity: 'payroll-sheet-list__voucher-badge-tag--social-security',
  housingFund: 'payroll-sheet-list__voucher-badge-tag--housing-fund',
  tax: 'payroll-sheet-list__voucher-badge-tag--tax',
  other: 'payroll-sheet-list__voucher-badge-tag--other'
};

export function resolvePayrollVoucherTagClassName(linkType: PayrollVoucherLinkType): string {
  switch (linkType) {
    case 'accrual':
    case 'payment':
      return PAYROLL_VOUCHER_TAG_CLASS.wage;
    case 'laborAccrual':
    case 'laborPayment':
      return PAYROLL_VOUCHER_TAG_CLASS.labor;
    case 'socialSecurity':
      return PAYROLL_VOUCHER_TAG_CLASS.socialSecurity;
    case 'housingFund':
      return PAYROLL_VOUCHER_TAG_CLASS.housingFund;
    case 'tax':
      return PAYROLL_VOUCHER_TAG_CLASS.tax;
    default:
      return PAYROLL_VOUCHER_TAG_CLASS.other;
  }
}

export const PAYROLL_VOUCHER_SEARCH_KEYWORDS: Record<PayrollVoucherLinkType, string> = {
  accrual: PAYROLL_VOUCHER_SHORT_LABELS.accrual,
  payment: PAYROLL_VOUCHER_SHORT_LABELS.payment,
  laborAccrual: PAYROLL_VOUCHER_SHORT_LABELS.laborAccrual,
  laborPayment: PAYROLL_VOUCHER_SHORT_LABELS.laborPayment,
  tax: PAYROLL_VOUCHER_SHORT_LABELS.tax,
  socialSecurity: PAYROLL_VOUCHER_SHORT_LABELS.socialSecurity,
  housingFund: PAYROLL_VOUCHER_SHORT_LABELS.housingFund,
  other: ''
};

export function payrollVoucherSearchKeyword(linkType: PayrollVoucherLinkType, customLabel = ''): string {
  if (linkType === 'other') return customLabel.trim();
  return PAYROLL_VOUCHER_SEARCH_KEYWORDS[linkType];
}

export const PAYROLL_ACCRUAL_LINK_TYPES: PayrollVoucherLinkType[] = ['accrual', 'laborAccrual'];

export const PAYROLL_PAYMENT_LINK_TYPES: PayrollVoucherLinkType[] = [
  'payment',
  'laborPayment',
  'tax',
  'socialSecurity',
  'housingFund',
  'other'
];

export function isPayrollAccrualLinkType(linkType: PayrollVoucherLinkType) {
  return PAYROLL_ACCRUAL_LINK_TYPES.includes(linkType);
}

export function isPayrollPaymentLinkType(linkType: PayrollVoucherLinkType) {
  return PAYROLL_PAYMENT_LINK_TYPES.includes(linkType);
}

export function resolvePayrollVoucherShortLabel(link: Pick<PayrollVoucherLink, 'linkType' | 'customLabel'>) {
  if (link.linkType === 'other' && link.customLabel?.trim()) {
    return link.customLabel.trim();
  }
  return PAYROLL_VOUCHER_SHORT_LABELS[link.linkType];
}

export function formatPayrollVoucherLinkNo(
  link: Pick<PayrollVoucherLinkView, 'voucherNo' | 'voucherDate' | 'missing'>
) {
  if (link.missing) return '凭证已删除';
  if (!link.voucherNo) return '—';
  const date = link.voucherDate?.trim().slice(0, 10);
  const match = date?.match(/^(\d{4})-(\d{2})/);
  if (!match) return link.voucherNo;
  return `${match[1]}${match[2]}_${link.voucherNo}`;
}

export function splitPayrollVoucherLinks(links: PayrollVoucherLinkView[]) {
  return {
    accrualVouchers: links.filter((item) => isPayrollAccrualLinkType(item.linkType)),
    paymentVouchers: links.filter((item) => isPayrollPaymentLinkType(item.linkType))
  };
}

export const PAYROLL_DELETE_BLOCKED_BY_VOUCHER_MESSAGE =
  '已关联凭证的工资表不允许删除，请先解除凭证关联';

export function hasPayrollVoucherLinks(
  source:
    | Pick<PayrollPeriodData, 'voucherLinks'>
    | Pick<PayrollSheetListItem, 'accrualVouchers' | 'paymentVouchers'>
): boolean {
  if ('voucherLinks' in source) {
    return source.voucherLinks.length > 0;
  }
  return source.accrualVouchers.length > 0 || source.paymentVouchers.length > 0;
}

export const PAYROLL_CREATION_METHOD_LABELS: Record<PayrollCreationMethod, string> = {
  import: '导入生成',
  manual: '手动录入',
  copy: '复制上月'
};

export type PayrollVoucherLink = {
  id: string;
  voucherId: string;
  linkType: PayrollVoucherLinkType;
  customLabel?: string;
};

export type SalaryPayrollRow = {
  id: string;
  salaryMonth: string;
  staffId?: string;
  name: string;
  departmentId?: string;
  idNumber?: string;
  salaryType?: string;
  incomeItem?: string;
  baseSalary: number;
  allowance: number;
  performanceBonus: number;
  subsidy: number;
  absenceDeduction: number;
  pension: number;
  medical: number;
  unemployment: number;
  workInjury: number;
  maternityInsurance: number;
  housingFund: number;
  otherDeduction: number;
  cumulativeIncome: number;
  cumulativeSpecialDeduction: number;
  childEducation: number;
  housingLoan: number;
  housingRent: number;
  elderlySupport: number;
  continuingEducation: number;
  infantCare: number;
  cumulativeOtherDeduction: number;
  cumulativeTaxPayable: number;
  cumulativeTaxPaid: number;
  withheldTax: number;
  paymentDate?: string;
  /** @deprecated legacy field */
  housingAllowance?: number;
  /** @deprecated legacy field */
  transportAllowance?: number;
  /** @deprecated legacy field */
  personalLeave?: number;
  /** @deprecated legacy field */
  housingDeduction?: number;
};

export type SalaryPayrollRowCalculated = SalaryPayrollRow & {
  preTaxSalary: number;
  socialSecurityTotal: number;
  cumulativeSpecialAdditionalTotal: number;
  netSalary: number;
};

export type LaborLedgerRow = {
  id: string;
  salaryMonth: string;
  name: string;
  /** 税前总额 */
  grossAmount: number;
  /** 个人缴纳增值税 */
  personalVat: number;
  /** 代扣个税 */
  withheldTax: number;
  paymentDate?: string;
  remark?: string;
};

export type LaborLedgerRowCalculated = LaborLedgerRow & {
  /** 个人缴纳增值税后收入 */
  incomeAfterVat: number;
  /** 免税费用（法定减除费用） */
  taxExemptExpense: number;
  /** 应纳税所得额 */
  taxableIncome: number;
  /** 实发劳务费 */
  netAmount: number;
};

export type PayrollEmployerCosts = {
  /** 公司缴纳社保（单位部分） */
  socialSecurity: number;
  /** 公司缴纳公积金（单位部分） */
  housingFund: number;
};

export type EmployerCostSummary = {
  salaryGross: number;
  laborGross: number;
  companySocialSecurity: number;
  companyHousingFund: number;
  totalCost: number;
  salaryHeadcount: number;
  laborHeadcount: number;
};

export function normalizeEmployerCosts(costs?: Partial<PayrollEmployerCosts>): PayrollEmployerCosts {
  return {
    socialSecurity: num(costs?.socialSecurity),
    housingFund: num(costs?.housingFund)
  };
}

export type EmployerCostMonthlyRow = EmployerCostSummary & {
  periodKey: string;
  periodLabel: string;
};

export type EmployerCostRangeResult = {
  startKey: string;
  endKey: string;
  summary: EmployerCostSummary;
  monthly: EmployerCostMonthlyRow[];
  periods: PayrollPeriodView[];
};

export function mergeEmployerCostSummaries(rows: EmployerCostSummary[]): EmployerCostSummary {
  const totals = rows.reduce(
    (acc, row) => ({
      salaryGross: acc.salaryGross + num(row.salaryGross),
      laborGross: acc.laborGross + num(row.laborGross),
      companySocialSecurity: acc.companySocialSecurity + num(row.companySocialSecurity),
      companyHousingFund: acc.companyHousingFund + num(row.companyHousingFund),
      totalCost: acc.totalCost + num(row.totalCost),
      salaryHeadcount: acc.salaryHeadcount + row.salaryHeadcount,
      laborHeadcount: acc.laborHeadcount + row.laborHeadcount
    }),
    {
      salaryGross: 0,
      laborGross: 0,
      companySocialSecurity: 0,
      companyHousingFund: 0,
      totalCost: 0,
      salaryHeadcount: 0,
      laborHeadcount: 0
    }
  );

  return {
    salaryGross: roundMoney(totals.salaryGross),
    laborGross: roundMoney(totals.laborGross),
    companySocialSecurity: roundMoney(totals.companySocialSecurity),
    companyHousingFund: roundMoney(totals.companyHousingFund),
    totalCost: roundMoney(totals.totalCost),
    salaryHeadcount: totals.salaryHeadcount,
    laborHeadcount: totals.laborHeadcount
  };
}

export function calcEmployerCostSummary(
  data: Pick<PayrollPeriodData, 'employerCosts' | 'salaryRows' | 'laborRows'> & {
    salaryTotals?: PayrollPeriodView['salaryTotals'];
    laborTotals?: PayrollPeriodView['laborTotals'];
  }
): EmployerCostSummary {
  const salaryRowsCalculated = data.salaryRows.map((row) => calcSalaryRow(row));
  const laborRowsCalculated = data.laborRows.map(calcLaborRow);
  const salaryGross =
    data.salaryTotals?.preTaxSalary ?? sumSalaryRows(salaryRowsCalculated).preTaxSalary;
  const laborGross =
    data.laborTotals?.grossAmount ?? sumLaborRows(laborRowsCalculated).grossAmount;
  const costs = normalizeEmployerCosts(data.employerCosts);
  const companySocialSecurity = costs.socialSecurity;
  const companyHousingFund = costs.housingFund;

  return {
    salaryGross,
    laborGross,
    companySocialSecurity,
    companyHousingFund,
    totalCost: roundMoney(
      salaryGross + laborGross + companySocialSecurity + companyHousingFund
    ),
    salaryHeadcount: salaryRowsCalculated.filter((row) => row.name.trim()).length,
    laborHeadcount: laborRowsCalculated.filter((row) => row.name.trim()).length
  };
}

function sumEmployerPortionFromVoucher(voucher: VoucherRecord): number {
  const entries = voucher.entries || [];
  const employerEntries = entries.filter(
    (entry) => num(entry.debit) > 0 && (entry.summary || '').includes('单位部分')
  );
  if (employerEntries.length) {
    return roundMoney(employerEntries.reduce((sum, entry) => sum + num(entry.debit), 0));
  }
  return roundMoney(
    entries
      .filter((entry) => num(entry.debit) > 0 && String(entry.accountCode || '').startsWith('5401'))
      .reduce((sum, entry) => sum + num(entry.debit), 0)
  );
}

export type PayrollPeriodData = {
  periodKey: string;
  salaryCategory?: string;
  creationMethod?: PayrollCreationMethod;
  createdBy?: string;
  createdAt?: string;
  employerCosts?: PayrollEmployerCosts;
  voucherLinks: PayrollVoucherLink[];
  salaryRows: SalaryPayrollRow[];
  laborRows: LaborLedgerRow[];
  updatedAt?: string;
};

export type PayrollVoucherLinkView = PayrollVoucherLink & {
  label: string;
  voucherNo?: string;
  voucherDate?: string;
  missing?: boolean;
};

export type PayrollPeriodView = PayrollPeriodData & {
  salaryRowsCalculated: SalaryPayrollRowCalculated[];
  laborRowsCalculated: LaborLedgerRowCalculated[];
  salaryTotals: Omit<
    SalaryPayrollRowCalculated,
    'id' | 'salaryMonth' | 'name' | 'staffId' | 'departmentId' | 'idNumber' | 'salaryType' | 'incomeItem' | 'paymentDate'
  >;
  laborTotals: {
    grossAmount: number;
    personalVat: number;
    incomeAfterVat: number;
    taxExemptExpense: number;
    taxableIncome: number;
    withheldTax: number;
    netAmount: number;
  };
  voucherLinksView: PayrollVoucherLinkView[];
};

export type PayrollSheetListItem = {
  periodKey: string;
  periodLabel: string;
  salaryCategory: string;
  staffCount: number;
  grossTotal: number;
  netSalary: number;
  laborCount: number;
  laborGrossTotal: number;
  laborNetTotal: number;
  employerCostTotal: number;
  accrualVouchers: PayrollVoucherLinkView[];
  paymentVouchers: PayrollVoucherLinkView[];
  creationMethod: string;
  createdBy: string;
  createdAt: string;
};

type PayrollStore = Record<string, PayrollPeriodData>;

export type { PayrollStore };

function roundMoney(n: number | string) {
  return Math.round((parseFloat(String(n)) || 0) * 100) / 100;
}

function num(value: number | string | undefined) {
  return roundMoney(value ?? 0);
}

function formatPeriodLabel(periodKey: string) {
  const [year, month] = periodKey.split('-');
  return `${year}年${month}月`;
}

/** 综合所得累计预扣预缴税率表（年度档位） */
const SALARY_INCOME_TAX_BRACKETS = [
  { limit: 36000, rate: 0.03, quickDeduction: 0 },
  { limit: 144000, rate: 0.1, quickDeduction: 2520 },
  { limit: 300000, rate: 0.2, quickDeduction: 16920 },
  { limit: 420000, rate: 0.25, quickDeduction: 31920 },
  { limit: 660000, rate: 0.3, quickDeduction: 52920 },
  { limit: 960000, rate: 0.35, quickDeduction: 85920 },
  { limit: Number.POSITIVE_INFINITY, rate: 0.45, quickDeduction: 181920 }
] as const;

const SALARY_BASIC_DEDUCTION_PER_MONTH = 5000;

function salaryMonthNumber(salaryMonth: string) {
  const month = Number(salaryMonth.split('-')[1]);
  return month >= 1 && month <= 12 ? month : 1;
}

/** 累计应预扣预缴税额 = 累计应纳税所得额 × 税率 − 速算扣除数 */
export function calcCumulativeSalaryTax(cumulativeTaxableIncome: number) {
  const income = Math.max(0, roundMoney(cumulativeTaxableIncome));
  for (const bracket of SALARY_INCOME_TAX_BRACKETS) {
    if (income <= bracket.limit) {
      return Math.max(0, roundMoney(income * bracket.rate - bracket.quickDeduction));
    }
  }
  return 0;
}

export function calcSalaryWithholdingTax(input: {
  employmentMonthNumber: number;
  cumulativeIncome: number;
  cumulativeSpecialDeduction: number;
  cumulativeSpecialAdditionalTotal: number;
  cumulativeOtherDeduction: number;
  cumulativeTaxPaid: number;
}) {
  const employmentMonths = Math.max(1, input.employmentMonthNumber);
  const basicDeduction = roundMoney(SALARY_BASIC_DEDUCTION_PER_MONTH * employmentMonths);
  const cumulativeTaxableIncome = roundMoney(
    Math.max(
      0,
      num(input.cumulativeIncome) -
        basicDeduction -
        num(input.cumulativeSpecialDeduction) -
        num(input.cumulativeSpecialAdditionalTotal) -
        num(input.cumulativeOtherDeduction)
    )
  );
  const cumulativeTaxPayable = calcCumulativeSalaryTax(cumulativeTaxableIncome);
  const withheldTax = roundMoney(
    Math.max(0, cumulativeTaxPayable - num(input.cumulativeTaxPaid))
  );
  return {
    cumulativeTaxableIncome,
    cumulativeTaxPayable,
    withheldTax
  };
}

export type SalaryYtdPriorTotals = {
  preTaxSalary: number;
  socialSecurityTotal: number;
  withheldTax: number;
  childEducation: number;
  housingLoan: number;
  housingRent: number;
  elderlySupport: number;
  continuingEducation: number;
  infantCare: number;
  otherDeduction: number;
};

export function emptySalaryYtdPriorTotals(): SalaryYtdPriorTotals {
  return {
    preTaxSalary: 0,
    socialSecurityTotal: 0,
    withheldTax: 0,
    childEducation: 0,
    housingLoan: 0,
    housingRent: 0,
    elderlySupport: 0,
    continuingEducation: 0,
    infantCare: 0,
    otherDeduction: 0
  };
}

export function salaryRowMatchKey(
  row: Pick<SalaryPayrollRow, 'staffId' | 'name' | 'idNumber'>
) {
  if (row.staffId?.trim()) return `staff:${row.staffId.trim()}`;
  if (row.idNumber?.trim()) return `id:${row.idNumber.trim()}`;
  if (row.name?.trim()) return `name:${row.name.trim()}`;
  return '';
}

/** 往月汇总优先使用已保存的「本月应缴个税」，避免重算后与历史实扣不一致。 */
function resolveRowWithheldTaxForYtd(row: SalaryPayrollRow, calculated: number) {
  const stored = num(row.withheldTax);
  if (stored > 0.005) return stored;
  return calculated;
}

/** 当年在本单位任职受雇月数（含当月），用于 5000 元/月减除费用；年中入职从首月工资表起算。 */
export function resolveEmploymentMonthNumber(
  store: PayrollStore,
  periodKey: string,
  matchKey: string
) {
  if (!matchKey) return salaryMonthNumber(periodKey);
  const year = periodKey.slice(0, 4);
  const monthKeys = Object.keys(store)
    .filter((key) => key.startsWith(`${year}-`) && key <= periodKey)
    .sort();
  let firstMonthKey: string | null = null;
  for (const key of monthKeys) {
    const period = store[key];
    if (!period?.salaryRows?.length) continue;
    const found = period.salaryRows.some((row) => salaryRowMatchKey(row) === matchKey);
    if (found) {
      firstMonthKey = firstMonthKey ?? key;
    }
  }
  if (!firstMonthKey) return salaryMonthNumber(periodKey);
  const firstMonth = Number(firstMonthKey.split('-')[1]);
  const currentMonth = Number(periodKey.split('-')[1]);
  if (!firstMonth || !currentMonth) return salaryMonthNumber(periodKey);
  return Math.max(1, currentMonth - firstMonth + 1);
}

export type SalaryRowCalcOptions = {
  employmentMonthNumber?: number;
};

function periodKeysInSameYearBefore(periodKey: string) {
  const [yearText, monthText] = periodKey.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  if (!year || !month) return [];
  const keys: string[] = [];
  for (let index = 1; index < month; index += 1) {
    keys.push(`${year}-${String(index).padStart(2, '0')}`);
  }
  return keys;
}

function addSalaryYtdTotals(
  base: SalaryYtdPriorTotals,
  addition: SalaryYtdPriorTotals
): SalaryYtdPriorTotals {
  return {
    preTaxSalary: roundMoney(base.preTaxSalary + addition.preTaxSalary),
    socialSecurityTotal: roundMoney(base.socialSecurityTotal + addition.socialSecurityTotal),
    withheldTax: roundMoney(base.withheldTax + addition.withheldTax),
    childEducation: roundMoney(base.childEducation + addition.childEducation),
    housingLoan: roundMoney(base.housingLoan + addition.housingLoan),
    housingRent: roundMoney(base.housingRent + addition.housingRent),
    elderlySupport: roundMoney(base.elderlySupport + addition.elderlySupport),
    continuingEducation: roundMoney(base.continuingEducation + addition.continuingEducation),
    infantCare: roundMoney(base.infantCare + addition.infantCare),
    otherDeduction: roundMoney(base.otherDeduction + addition.otherDeduction)
  };
}

function salaryRowMonthlySpecialAdditional(row: SalaryPayrollRow) {
  return {
    childEducation: num(row.childEducation),
    housingLoan: num(row.housingLoan),
    housingRent: num(row.housingRent),
    elderlySupport: num(row.elderlySupport),
    continuingEducation: num(row.continuingEducation),
    infantCare: num(row.infantCare)
  };
}

export function buildSalaryYtdPriorMap(store: PayrollStore, periodKey: string) {
  const map = new Map<string, SalaryYtdPriorTotals>();
  for (const priorKey of periodKeysInSameYearBefore(periodKey)) {
    const period = store[priorKey];
    if (!period?.salaryRows?.length) continue;
    const priorMap = buildSalaryYtdPriorMap(store, priorKey);
    for (const row of period.salaryRows) {
      const matchKey = salaryRowMatchKey(row);
      if (!matchKey) continue;
      const calculated = calcSalaryRow(row, priorMap.get(matchKey), {
        employmentMonthNumber: resolveEmploymentMonthNumber(store, priorKey, matchKey)
      });
      const monthlySpecial = salaryRowMonthlySpecialAdditional(row);
      const addition: SalaryYtdPriorTotals = {
        preTaxSalary: calculated.preTaxSalary,
        socialSecurityTotal: calculated.socialSecurityTotal,
        withheldTax: resolveRowWithheldTaxForYtd(row, calculated.withheldTax),
        ...monthlySpecial,
        otherDeduction: num(row.otherDeduction)
      };
      map.set(matchKey, addSalaryYtdTotals(map.get(matchKey) || emptySalaryYtdPriorTotals(), addition));
    }
  }
  return map;
}

export function calcSalaryRowsWithYtdMap(
  store: PayrollStore,
  periodKey: string,
  rows: SalaryPayrollRow[],
  ytdPriorMap: Map<string, SalaryYtdPriorTotals>
) {
  return rows.map((row) => {
    const matchKey = salaryRowMatchKey(row);
    return calcSalaryRow(row, ytdPriorMap.get(matchKey), {
      employmentMonthNumber: resolveEmploymentMonthNumber(store, periodKey, matchKey)
    });
  });
}

export function calcSalaryRowsForPeriod(
  store: PayrollStore,
  periodKey: string,
  rows: SalaryPayrollRow[]
) {
  const ytdPriorMap = buildSalaryYtdPriorMap(store, periodKey);
  return calcSalaryRowsWithYtdMap(store, periodKey, rows, ytdPriorMap);
}

export function normalizeSalaryRow(
  row: SalaryPayrollRow & { criticalIllness?: number }
): SalaryPayrollRow {
  const { criticalIllness, ...rest } = row;
  return {
    ...rest,
    allowance: num(row.allowance ?? row.housingAllowance),
    subsidy: num(row.subsidy ?? row.transportAllowance),
    absenceDeduction: num(row.absenceDeduction ?? row.personalLeave),
    housingLoan: num(row.housingLoan ?? row.housingDeduction),
    baseSalary: num(row.baseSalary),
    performanceBonus: num(row.performanceBonus),
    pension: num(row.pension),
    medical: num(row.medical),
    unemployment: num(row.unemployment),
    workInjury: num(row.workInjury ?? criticalIllness),
    maternityInsurance: num(row.maternityInsurance),
    housingFund: num(row.housingFund),
    otherDeduction: num(row.otherDeduction),
    childEducation: num(row.childEducation),
    housingRent: num(row.housingRent),
    elderlySupport: num(row.elderlySupport),
    continuingEducation: num(row.continuingEducation),
    infantCare: num(row.infantCare),
    cumulativeIncome: 0,
    cumulativeSpecialDeduction: 0,
    cumulativeOtherDeduction: 0,
    cumulativeTaxPaid: 0,
    cumulativeTaxPayable: 0,
    withheldTax: num(row.withheldTax)
  };
}

export function calcSalaryRow(
  row: SalaryPayrollRow,
  priorYtd: SalaryYtdPriorTotals = emptySalaryYtdPriorTotals(),
  options: SalaryRowCalcOptions = {}
): SalaryPayrollRowCalculated {
  const normalized = normalizeSalaryRow(row);
  const employmentMonthNumber =
    options.employmentMonthNumber ?? salaryMonthNumber(normalized.salaryMonth);
  const preTaxSalary = roundMoney(
    num(normalized.baseSalary) +
      num(normalized.allowance) +
      num(normalized.performanceBonus) +
      num(normalized.subsidy) -
      num(normalized.absenceDeduction)
  );
  const socialSecurityTotal = roundMoney(
    num(normalized.pension) +
      num(normalized.medical) +
      num(normalized.unemployment) +
      num(normalized.workInjury) +
      num(normalized.maternityInsurance) +
      num(normalized.housingFund)
  );
  const monthlySpecial = salaryRowMonthlySpecialAdditional(normalized);
  const cumulativeIncome = roundMoney(priorYtd.preTaxSalary + preTaxSalary);
  const cumulativeSpecialDeduction = roundMoney(
    priorYtd.socialSecurityTotal + socialSecurityTotal
  );
  const cumulativeSpecialAdditionalTotal = roundMoney(
    priorYtd.childEducation +
      priorYtd.housingLoan +
      priorYtd.housingRent +
      priorYtd.elderlySupport +
      priorYtd.continuingEducation +
      priorYtd.infantCare +
      monthlySpecial.childEducation +
      monthlySpecial.housingLoan +
      monthlySpecial.housingRent +
      monthlySpecial.elderlySupport +
      monthlySpecial.continuingEducation +
      monthlySpecial.infantCare
  );
  const cumulativeOtherDeduction = roundMoney(
    priorYtd.otherDeduction + num(normalized.otherDeduction)
  );
  const cumulativeTaxPaid = roundMoney(priorYtd.withheldTax);
  const { cumulativeTaxPayable, withheldTax } = calcSalaryWithholdingTax({
    employmentMonthNumber,
    cumulativeIncome,
    cumulativeSpecialDeduction,
    cumulativeSpecialAdditionalTotal,
    cumulativeOtherDeduction,
    cumulativeTaxPaid
  });
  const netSalary = roundMoney(
    preTaxSalary - socialSecurityTotal - num(normalized.otherDeduction) - withheldTax
  );

  return {
    ...normalized,
    preTaxSalary,
    socialSecurityTotal,
    cumulativeIncome,
    cumulativeSpecialDeduction,
    cumulativeSpecialAdditionalTotal,
    cumulativeOtherDeduction,
    cumulativeTaxPaid,
    cumulativeTaxPayable,
    withheldTax,
    netSalary
  };
}

export function normalizeLaborRow(row: LaborLedgerRow): LaborLedgerRow {
  return {
    ...row,
    grossAmount: num(row.grossAmount),
    personalVat: num(row.personalVat)
  };
}

export function calcLaborRow(row: LaborLedgerRow): LaborLedgerRowCalculated {
  const normalized = normalizeLaborRow(row);
  const grossAmount = num(normalized.grossAmount);
  const personalVat = num(normalized.personalVat);
  const incomeAfterVat = roundMoney(Math.max(0, grossAmount - personalVat));
  const taxExemptExpense = roundMoney(Math.max(incomeAfterVat * 0.2, 800));
  const taxableIncome = roundMoney(Math.max(0, incomeAfterVat - taxExemptExpense));
  const withheldTax = roundMoney(taxableIncome * 0.2);
  const netAmount = roundMoney(Math.max(0, grossAmount - withheldTax));

  return {
    ...normalized,
    grossAmount,
    personalVat,
    withheldTax,
    incomeAfterVat,
    taxExemptExpense,
    taxableIncome,
    netAmount
  };
}

function sumSalaryRows(rows: SalaryPayrollRowCalculated[]) {
  const totals = rows.reduce(
    (acc, row) => ({
      baseSalary: acc.baseSalary + num(row.baseSalary),
      allowance: acc.allowance + num(row.allowance),
      performanceBonus: acc.performanceBonus + num(row.performanceBonus),
      subsidy: acc.subsidy + num(row.subsidy),
      absenceDeduction: acc.absenceDeduction + num(row.absenceDeduction),
      preTaxSalary: acc.preTaxSalary + num(row.preTaxSalary),
      pension: acc.pension + num(row.pension),
      medical: acc.medical + num(row.medical),
      unemployment: acc.unemployment + num(row.unemployment),
      workInjury: acc.workInjury + num(row.workInjury),
      maternityInsurance: acc.maternityInsurance + num(row.maternityInsurance),
      housingFund: acc.housingFund + num(row.housingFund),
      socialSecurityTotal: acc.socialSecurityTotal + num(row.socialSecurityTotal),
      otherDeduction: acc.otherDeduction + num(row.otherDeduction),
      cumulativeIncome: acc.cumulativeIncome + num(row.cumulativeIncome),
      cumulativeSpecialDeduction:
        acc.cumulativeSpecialDeduction + num(row.cumulativeSpecialDeduction),
      childEducation: acc.childEducation + num(row.childEducation),
      housingLoan: acc.housingLoan + num(row.housingLoan),
      housingRent: acc.housingRent + num(row.housingRent),
      elderlySupport: acc.elderlySupport + num(row.elderlySupport),
      continuingEducation: acc.continuingEducation + num(row.continuingEducation),
      infantCare: acc.infantCare + num(row.infantCare),
      cumulativeSpecialAdditionalTotal:
        acc.cumulativeSpecialAdditionalTotal + num(row.cumulativeSpecialAdditionalTotal),
      cumulativeOtherDeduction: acc.cumulativeOtherDeduction + num(row.cumulativeOtherDeduction),
      cumulativeTaxPayable: acc.cumulativeTaxPayable + num(row.cumulativeTaxPayable),
      cumulativeTaxPaid: acc.cumulativeTaxPaid + num(row.cumulativeTaxPaid),
      withheldTax: acc.withheldTax + num(row.withheldTax),
      netSalary: acc.netSalary + num(row.netSalary)
    }),
    {
      baseSalary: 0,
      allowance: 0,
      performanceBonus: 0,
      subsidy: 0,
      absenceDeduction: 0,
      preTaxSalary: 0,
      pension: 0,
      medical: 0,
      unemployment: 0,
      workInjury: 0,
      maternityInsurance: 0,
      housingFund: 0,
      socialSecurityTotal: 0,
      otherDeduction: 0,
      cumulativeIncome: 0,
      cumulativeSpecialDeduction: 0,
      childEducation: 0,
      housingLoan: 0,
      housingRent: 0,
      elderlySupport: 0,
      continuingEducation: 0,
      infantCare: 0,
      cumulativeSpecialAdditionalTotal: 0,
      cumulativeOtherDeduction: 0,
      cumulativeTaxPayable: 0,
      cumulativeTaxPaid: 0,
      withheldTax: 0,
      netSalary: 0
    }
  );

  return Object.fromEntries(
    Object.entries(totals).map(([key, value]) => [key, roundMoney(value)])
  ) as PayrollPeriodView['salaryTotals'];
}

function sumLaborRows(rows: LaborLedgerRowCalculated[]): PayrollPeriodView['laborTotals'] {
  const totals = rows.reduce(
    (acc, row) => ({
      grossAmount: acc.grossAmount + num(row.grossAmount),
      personalVat: acc.personalVat + num(row.personalVat),
      incomeAfterVat: acc.incomeAfterVat + num(row.incomeAfterVat),
      taxExemptExpense: acc.taxExemptExpense + num(row.taxExemptExpense),
      taxableIncome: acc.taxableIncome + num(row.taxableIncome),
      withheldTax: acc.withheldTax + num(row.withheldTax),
      netAmount: acc.netAmount + num(row.netAmount)
    }),
    {
      grossAmount: 0,
      personalVat: 0,
      incomeAfterVat: 0,
      taxExemptExpense: 0,
      taxableIncome: 0,
      withheldTax: 0,
      netAmount: 0
    }
  );

  return Object.fromEntries(
    Object.entries(totals).map(([key, value]) => [key, roundMoney(value)])
  ) as PayrollPeriodView['laborTotals'];
}

function resolveLinkLabel(link: PayrollVoucherLink) {
  if (link.linkType === 'other' && link.customLabel?.trim()) {
    return link.customLabel.trim();
  }
  return PAYROLL_VOUCHER_LABELS[link.linkType];
}

async function readStore(): Promise<PayrollStore> {
  const raw = await ErpApi.getSetting(SETTING_KEY);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as PayrollStore;
}

async function writeStore(store: PayrollStore) {
  await ErpApi.setSetting(SETTING_KEY, store);
}

function emptyPeriod(periodKey: string): PayrollPeriodData {
  return {
    periodKey,
    voucherLinks: [],
    salaryRows: [],
    laborRows: [],
    updatedAt: new Date().toISOString()
  };
}

function normalizePeriod(data: PayrollPeriodData): PayrollPeriodData {
  return {
    ...data,
    employerCosts: normalizeEmployerCosts(data.employerCosts),
    salaryRows: (data.salaryRows || []).map(normalizeSalaryRow),
    laborRows: (data.laborRows || []).map(normalizeLaborRow)
  };
}

function previousPeriodKey(periodKey: string) {
  const [yearText, monthText] = periodKey.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  if (!year || !month) return null;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  return `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
}

export function createSalaryRow(periodKey: string): SalaryPayrollRow {
  return {
    id: ErpApi.generateId(),
    salaryMonth: periodKey,
    name: '',
    baseSalary: 0,
    allowance: 0,
    performanceBonus: 0,
    subsidy: 0,
    absenceDeduction: 0,
    pension: 0,
    medical: 0,
    unemployment: 0,
    workInjury: 0,
    maternityInsurance: 0,
    housingFund: 0,
    otherDeduction: 0,
    cumulativeIncome: 0,
    cumulativeSpecialDeduction: 0,
    childEducation: 0,
    housingLoan: 0,
    housingRent: 0,
    elderlySupport: 0,
    continuingEducation: 0,
    infantCare: 0,
    cumulativeOtherDeduction: 0,
    cumulativeTaxPayable: 0,
    cumulativeTaxPaid: 0,
    withheldTax: 0,
    paymentDate: ''
  };
}

export function seedPayrollPeriodRows(data: PayrollPeriodData): PayrollPeriodData {
  const salaryRows = data.salaryRows.length ? data.salaryRows : [createSalaryRow(data.periodKey)];
  const laborRows = data.laborRows.length ? data.laborRows : [createLaborRow(data.periodKey)];
  if (salaryRows === data.salaryRows && laborRows === data.laborRows) {
    return data;
  }
  return { ...data, salaryRows, laborRows };
}

export function createLaborRow(periodKey: string): LaborLedgerRow {
  return {
    id: ErpApi.generateId(),
    salaryMonth: periodKey,
    name: '',
    grossAmount: 0,
    personalVat: 0,
    withheldTax: 0,
    paymentDate: '',
    remark: ''
  };
}

async function enrichVoucherLinks(
  links: PayrollVoucherLink[],
  vouchers: VoucherRecord[]
): Promise<PayrollVoucherLinkView[]> {
  const byId = new Map(vouchers.map((v) => [v.id, v]));
  return links.map((link) => {
    const voucher = byId.get(link.voucherId);
    return {
      ...link,
      label: resolveLinkLabel(link),
      voucherNo: voucher?.voucherNo,
      voucherDate: voucher?.date,
      missing: !voucher
    };
  });
}

function formatMoney(value: number | string | undefined) {
  const n = num(value);
  if (Math.abs(n) < 0.005) return '';
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateTime(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

async function buildPeriodView(data: PayrollPeriodData, store?: PayrollStore): Promise<PayrollPeriodView> {
  const normalized = normalizePeriod(data);
  const payrollStore = store ?? (await readStore());
  const vouchers = await Voucher.getAll();
  const salaryRowsCalculated = calcSalaryRowsForPeriod(
    payrollStore,
    normalized.periodKey,
    normalized.salaryRows
  );
  const laborRowsCalculated = normalized.laborRows.map(calcLaborRow);

  return {
    ...normalized,
    salaryRowsCalculated,
    laborRowsCalculated,
    salaryTotals: sumSalaryRows(salaryRowsCalculated),
    laborTotals: sumLaborRows(laborRowsCalculated),
    voucherLinksView: await enrichVoucherLinks(normalized.voucherLinks, vouchers)
  };
}

async function buildListItem(
  data: PayrollPeriodData,
  voucherLinksView: PayrollVoucherLinkView[],
  store: PayrollStore
): Promise<PayrollSheetListItem> {
  const salaryRows = calcSalaryRowsForPeriod(store, data.periodKey, data.salaryRows);
  const laborRows = data.laborRows.map(calcLaborRow);
  const totals = sumSalaryRows(salaryRows);
  const laborTotals = sumLaborRows(laborRows);
  const staffCount = salaryRows.filter((row) => row.name.trim()).length;
  const laborCount = laborRows.filter((row) => row.name.trim()).length;
  const { accrualVouchers, paymentVouchers } = splitPayrollVoucherLinks(voucherLinksView);
  const hasRows = staffCount > 0 || laborCount > 0;
  const employerCostTotal = calcEmployerCostSummary({
    employerCosts: data.employerCosts,
    salaryRows: data.salaryRows,
    laborRows: data.laborRows,
    salaryTotals: totals,
    laborTotals
  }).totalCost;

  return {
    periodKey: data.periodKey,
    periodLabel: formatPeriodLabel(data.periodKey),
    salaryCategory: data.salaryCategory || '',
    staffCount,
    grossTotal: totals.preTaxSalary,
    netSalary: totals.netSalary,
    laborCount,
    laborGrossTotal: laborTotals.grossAmount,
    laborNetTotal: laborTotals.netAmount,
    employerCostTotal,
    accrualVouchers,
    paymentVouchers,
    creationMethod: data.creationMethod
      ? PAYROLL_CREATION_METHOD_LABELS[data.creationMethod]
      : hasRows
        ? '手动录入'
        : '—',
    createdBy: data.createdBy || '—',
    createdAt: formatDateTime(data.createdAt || data.updatedAt)
  };
}

export function calcLaborTotals(rows: LaborLedgerRow[]) {
  return sumLaborRows(rows.map(calcLaborRow));
}

export function calcSalaryTotals(
  rows: SalaryPayrollRow[],
  store: PayrollStore,
  periodKey: string,
  ytdPriorMap: Map<string, SalaryYtdPriorTotals>
) {
  return sumSalaryRows(calcSalaryRowsWithYtdMap(store, periodKey, rows, ytdPriorMap));
}

export const Salary = {
  async getPeriod(periodKey: string): Promise<PayrollPeriodView> {
    const store = await readStore();
    const data = store[periodKey] || emptyPeriod(periodKey);
    return buildPeriodView(data, store);
  },

  async getSalaryYtdPriorMap(periodKey: string) {
    const store = await readStore();
    return buildSalaryYtdPriorMap(store, periodKey);
  },

  async getSalaryCalcContext(periodKey: string) {
    const store = await readStore();
    return {
      store,
      ytdPriorMap: buildSalaryYtdPriorMap(store, periodKey)
    };
  },

  async listSheets(startKey: string, endKey: string): Promise<PayrollSheetListItem[]> {
    const store = await readStore();
    const vouchers = await Voucher.getAll();
    const rows = Object.values(store)
      .filter((item) => item.periodKey >= startKey && item.periodKey <= endKey)
      .sort((a, b) => b.periodKey.localeCompare(a.periodKey));

    return Promise.all(
      rows.map(async (item) => {
        const links = await enrichVoucherLinks(item.voucherLinks, vouchers);
        return buildListItem(normalizePeriod(item), links, store);
      })
    );
  },

  async getEmployerCostRange(startKey: string, endKey: string): Promise<EmployerCostRangeResult> {
    const store = await readStore();
    const periods = Object.values(store)
      .filter((item) => item.periodKey >= startKey && item.periodKey <= endKey)
      .sort((a, b) => a.periodKey.localeCompare(b.periodKey));

    const periodViews = await Promise.all(
      periods.map((item) => buildPeriodView(normalizePeriod(item), store))
    );

    const monthly: EmployerCostMonthlyRow[] = periodViews.map((view) => ({
      ...calcEmployerCostSummary(view),
      periodKey: view.periodKey,
      periodLabel: formatPeriodLabel(view.periodKey)
    }));

    return {
      startKey,
      endKey,
      summary: mergeEmployerCostSummaries(monthly),
      monthly,
      periods: periodViews
    };
  },

  async savePeriod(data: PayrollPeriodData) {
    const store = await readStore();
    const existing = store[data.periodKey];
    const calculatedRows = calcSalaryRowsForPeriod(store, data.periodKey, data.salaryRows);
    const salaryRows = data.salaryRows.map((row, index) => ({
      ...normalizeSalaryRow(row),
      withheldTax: calculatedRows[index]?.withheldTax ?? 0
    }));
    const next: PayrollPeriodData = normalizePeriod({
      ...data,
      salaryRows,
      createdAt: data.createdAt || existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    store[data.periodKey] = next;
    await writeStore(store);
    await ErpApi.addAuditLog('保存', '工资薪金', data.periodKey);
    return next;
  },

  async saveEmployerCosts(periodKey: string, costs: PayrollEmployerCosts) {
    await TaxDeclaration.assertPayrollPeriodNotDeclared(periodKey);
    const store = await readStore();
    const current = store[periodKey] || emptyPeriod(periodKey);
    const next = normalizePeriod({
      ...current,
      employerCosts: normalizeEmployerCosts(costs),
      updatedAt: new Date().toISOString()
    });
    store[periodKey] = next;
    await writeStore(store);
    return buildPeriodView(next, store);
  },

  async syncEmployerCostsFromVouchers(periodKey: string) {
    const costs = await this.suggestEmployerCosts(periodKey);
    return this.saveEmployerCosts(periodKey, costs);
  },

  async addVoucherLinkAndSyncEmployerCosts(
    periodKey: string,
    link: Omit<PayrollVoucherLink, 'id'> & { id?: string }
  ) {
    if (link.linkType === 'socialSecurity' || link.linkType === 'housingFund') {
      await TaxDeclaration.assertPayrollPeriodNotDeclared(periodKey);
    }
    await this.addVoucherLink(periodKey, link);
    if (link.linkType === 'socialSecurity' || link.linkType === 'housingFund') {
      return this.syncEmployerCostsFromVouchers(periodKey);
    }
    return this.getPeriod(periodKey);
  },

  async removeVoucherLinkAndSyncEmployerCosts(periodKey: string, linkId: string) {
    const store = await readStore();
    const removed = store[periodKey]?.voucherLinks.find((item) => item.id === linkId);
    if (
      removed &&
      (removed.linkType === 'socialSecurity' || removed.linkType === 'housingFund')
    ) {
      await TaxDeclaration.assertPayrollPeriodNotDeclared(periodKey);
    }
    await this.removeVoucherLink(periodKey, linkId);
    if (
      removed &&
      (removed.linkType === 'socialSecurity' || removed.linkType === 'housingFund')
    ) {
      return this.syncEmployerCostsFromVouchers(periodKey);
    }
    return this.getPeriod(periodKey);
  },

  async suggestEmployerCosts(periodKey: string): Promise<PayrollEmployerCosts> {
    const store = await readStore();
    const data = store[periodKey] || emptyPeriod(periodKey);
    const vouchers = await Voucher.getAll();
    const byId = new Map(vouchers.map((item) => [item.id, item]));
    let socialSecurity = 0;
    let housingFund = 0;

    for (const link of data.voucherLinks) {
      const voucher = byId.get(link.voucherId);
      if (!voucher) continue;
      const amount = sumEmployerPortionFromVoucher(voucher);
      if (link.linkType === 'socialSecurity') {
        socialSecurity = roundMoney(socialSecurity + amount);
      }
      if (link.linkType === 'housingFund') {
        housingFund = roundMoney(housingFund + amount);
      }
    }

    return { socialSecurity, housingFund };
  },

  async ensurePeriod(
    periodKey: string,
    options: {
      creationMethod?: PayrollCreationMethod;
      createdBy?: string;
      salaryCategory?: string;
    } = {}
  ) {
    const store = await readStore();
    if (store[periodKey]?.salaryRows?.length || store[periodKey]?.laborRows?.length) {
      return buildPeriodView(store[periodKey], store);
    }
    const next = normalizePeriod(
      seedPayrollPeriodRows({
        ...emptyPeriod(periodKey),
        creationMethod: options.creationMethod || 'manual',
        createdBy: options.createdBy,
        salaryCategory: options.salaryCategory || '',
        createdAt: new Date().toISOString()
      })
    );
    store[periodKey] = next;
    await writeStore(store);
    return buildPeriodView(next, store);
  },

  async copyFromPreviousMonth(periodKey: string, createdBy?: string) {
    const prevKey = previousPeriodKey(periodKey);
    if (!prevKey) throw new Error('无法计算上月');
    const store = await readStore();
    const source = store[prevKey];
    if (!source?.salaryRows?.length && !source?.laborRows?.length) {
      throw new Error('上月暂无工资或劳务数据');
    }

    const next = normalizePeriod({
      ...emptyPeriod(periodKey),
      salaryCategory: source.salaryCategory || '',
      creationMethod: 'copy',
      createdBy,
      createdAt: new Date().toISOString(),
      salaryRows: (source.salaryRows || []).map((row) => ({
        ...normalizeSalaryRow(row),
        id: ErpApi.generateId(),
        salaryMonth: periodKey
      })),
      laborRows: (source.laborRows || []).map((row) => ({
        ...row,
        id: ErpApi.generateId(),
        salaryMonth: periodKey
      }))
    });
    store[periodKey] = next;
    await writeStore(store);
    await ErpApi.addAuditLog('复制', '工资薪金', periodKey);
    return buildPeriodView(next, store);
  },

  previousPeriodKey,

  async hasPeriodSalaryData(periodKey: string) {
    const store = await readStore();
    return Boolean(store[periodKey]?.salaryRows?.length);
  },

  async hasPeriodLaborData(periodKey: string) {
    const store = await readStore();
    return Boolean(store[periodKey]?.laborRows?.length);
  },

  async hasPeriodCopySource(periodKey: string) {
    const store = await readStore();
    const data = store[periodKey];
    return Boolean(data?.salaryRows?.length || data?.laborRows?.length);
  },

  async deletePeriod(periodKey: string) {
    const store = await readStore();
    const current = store[periodKey];
    if (!current) return;
    if (hasPayrollVoucherLinks(current)) {
      throw new Error(PAYROLL_DELETE_BLOCKED_BY_VOUCHER_MESSAGE);
    }
    delete store[periodKey];
    await writeStore(store);
    await ErpApi.addAuditLog('删除', '工资薪金', periodKey);
  },

  async addVoucherLink(
    periodKey: string,
    link: Omit<PayrollVoucherLink, 'id'> & { id?: string }
  ) {
    const store = await readStore();
    const current = store[periodKey] || emptyPeriod(periodKey);
    if (current.voucherLinks.some((item) => item.voucherId === link.voucherId)) {
      throw new Error('该凭证已关联');
    }
    const nextLink: PayrollVoucherLink = {
      id: link.id || ErpApi.generateId(),
      voucherId: link.voucherId,
      linkType: link.linkType,
      customLabel: link.customLabel
    };
    const next = {
      ...current,
      voucherLinks: [...current.voucherLinks, nextLink]
    };
    await this.savePeriod(next);
    return nextLink;
  },

  async removeVoucherLink(periodKey: string, linkId: string) {
    const store = await readStore();
    const current = store[periodKey] || emptyPeriod(periodKey);
    const next = {
      ...current,
      voucherLinks: current.voucherLinks.filter((item) => item.id !== linkId)
    };
    await this.savePeriod(next);
  },

  formatMoney,

  formatMoneyDisplay(value: number | string | undefined) {
    const text = formatMoney(value);
    return text || '—';
  },

  formatPeriodLabel,

  async getPeriodStats(year: number) {
    const store = await readStore();
    const prefix = `${year}-`;
    const periods = Object.values(store)
      .filter((item) => item.periodKey.startsWith(prefix))
      .sort((a, b) => a.periodKey.localeCompare(b.periodKey));

    const rows = periods.map((period) => {
      const salaryRows = calcSalaryRowsForPeriod(store, period.periodKey, period.salaryRows);
      const laborRows = period.laborRows.map(calcLaborRow);
      const salaryTotals = sumSalaryRows(salaryRows);
      const laborTotals = sumLaborRows(laborRows);
      const [y, m] = period.periodKey.split('-');
      return {
        periodKey: period.periodKey,
        periodLabel: `${y}年${m}期`,
        salaryHeadcount: salaryRows.filter((row) => row.name.trim()).length,
        grossTotal: salaryTotals.preTaxSalary,
        preTaxSalary: salaryTotals.preTaxSalary,
        netSalary: salaryTotals.netSalary,
        withheldTax: salaryTotals.withheldTax,
        laborHeadcount: laborRows.filter((row) => row.name.trim()).length,
        laborNet: laborTotals.netAmount,
        voucherLinkCount: period.voucherLinks.length
      };
    });

    const yearTotal = rows.reduce(
      (acc, row) => ({
        grossTotal: roundMoney(acc.grossTotal + row.grossTotal),
        preTaxSalary: roundMoney(acc.preTaxSalary + row.preTaxSalary),
        netSalary: roundMoney(acc.netSalary + row.netSalary),
        withheldTax: roundMoney(acc.withheldTax + row.withheldTax),
        laborNet: roundMoney(acc.laborNet + row.laborNet),
        salaryHeadcount: acc.salaryHeadcount + row.salaryHeadcount,
        laborHeadcount: acc.laborHeadcount + row.laborHeadcount,
        voucherLinkCount: acc.voucherLinkCount + row.voucherLinkCount
      }),
      {
        grossTotal: 0,
        preTaxSalary: 0,
        netSalary: 0,
        withheldTax: 0,
        laborNet: 0,
        salaryHeadcount: 0,
        laborHeadcount: 0,
        voucherLinkCount: 0
      }
    );

    return { year, periods: rows, yearTotal };
  }
};
