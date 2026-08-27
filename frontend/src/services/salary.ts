import { ErpApi } from './erpApi';
import { Voucher } from './voucher';
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

export function payrollVoucherSearchKeyword(linkType: PayrollVoucherLinkType): string {
  if (linkType === 'other') return '';
  return PAYROLL_VOUCHER_SHORT_LABELS[linkType];
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
  criticalIllness: number;
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

export type PayrollPeriodData = {
  periodKey: string;
  salaryCategory?: string;
  creationMethod?: PayrollCreationMethod;
  createdBy?: string;
  createdAt?: string;
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
  accrualVouchers: PayrollVoucherLinkView[];
  paymentVouchers: PayrollVoucherLinkView[];
  creationMethod: string;
  createdBy: string;
  createdAt: string;
};

type PayrollStore = Record<string, PayrollPeriodData>;

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

export function normalizeSalaryRow(row: SalaryPayrollRow): SalaryPayrollRow {
  return {
    ...row,
    allowance: num(row.allowance ?? row.housingAllowance),
    subsidy: num(row.subsidy ?? row.transportAllowance),
    absenceDeduction: num(row.absenceDeduction ?? row.personalLeave),
    housingLoan: num(row.housingLoan ?? row.housingDeduction),
    baseSalary: num(row.baseSalary),
    performanceBonus: num(row.performanceBonus),
    pension: num(row.pension),
    medical: num(row.medical),
    unemployment: num(row.unemployment),
    criticalIllness: num(row.criticalIllness),
    housingFund: num(row.housingFund),
    otherDeduction: num(row.otherDeduction),
    cumulativeIncome: num(row.cumulativeIncome),
    cumulativeSpecialDeduction: num(row.cumulativeSpecialDeduction),
    childEducation: num(row.childEducation),
    housingRent: num(row.housingRent),
    elderlySupport: num(row.elderlySupport),
    continuingEducation: num(row.continuingEducation),
    infantCare: num(row.infantCare),
    cumulativeOtherDeduction: num(row.cumulativeOtherDeduction),
    cumulativeTaxPayable: num(row.cumulativeTaxPayable),
    cumulativeTaxPaid: num(row.cumulativeTaxPaid),
    withheldTax: num(row.withheldTax)
  };
}

export function calcSalaryRow(row: SalaryPayrollRow): SalaryPayrollRowCalculated {
  const normalized = normalizeSalaryRow(row);
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
      num(normalized.criticalIllness) +
      num(normalized.housingFund)
  );
  const cumulativeSpecialAdditionalTotal = roundMoney(
    num(normalized.childEducation) +
      num(normalized.housingLoan) +
      num(normalized.housingRent) +
      num(normalized.elderlySupport) +
      num(normalized.continuingEducation) +
      num(normalized.infantCare)
  );
  const netSalary = roundMoney(
    preTaxSalary - socialSecurityTotal - num(normalized.otherDeduction) - num(normalized.withheldTax)
  );

  return {
    ...normalized,
    preTaxSalary,
    socialSecurityTotal,
    cumulativeSpecialAdditionalTotal,
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
      criticalIllness: acc.criticalIllness + num(row.criticalIllness),
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
      criticalIllness: 0,
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
    criticalIllness: 0,
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

async function buildPeriodView(data: PayrollPeriodData): Promise<PayrollPeriodView> {
  const normalized = normalizePeriod(data);
  const vouchers = await Voucher.getAll();
  const salaryRowsCalculated = normalized.salaryRows.map(calcSalaryRow);
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
  voucherLinksView: PayrollVoucherLinkView[]
): Promise<PayrollSheetListItem> {
  const salaryRows = data.salaryRows.map(calcSalaryRow);
  const laborRows = data.laborRows.map(calcLaborRow);
  const totals = sumSalaryRows(salaryRows);
  const laborTotals = sumLaborRows(laborRows);
  const staffCount = salaryRows.filter((row) => row.name.trim()).length;
  const laborCount = laborRows.filter((row) => row.name.trim()).length;
  const { accrualVouchers, paymentVouchers } = splitPayrollVoucherLinks(voucherLinksView);
  const hasRows = staffCount > 0 || laborCount > 0;

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

export function calcSalaryTotals(rows: SalaryPayrollRow[]) {
  return sumSalaryRows(rows.map(calcSalaryRow));
}

export const Salary = {
  async getPeriod(periodKey: string): Promise<PayrollPeriodView> {
    const store = await readStore();
    const data = store[periodKey] || emptyPeriod(periodKey);
    return buildPeriodView(data);
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
        return buildListItem(normalizePeriod(item), links);
      })
    );
  },

  async savePeriod(data: PayrollPeriodData) {
    const store = await readStore();
    const existing = store[data.periodKey];
    const next: PayrollPeriodData = normalizePeriod({
      ...data,
      createdAt: data.createdAt || existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    store[data.periodKey] = next;
    await writeStore(store);
    await ErpApi.addAuditLog('保存', '工资薪金', data.periodKey);
    return next;
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
      return buildPeriodView(store[periodKey]);
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
    return buildPeriodView(next);
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
    return buildPeriodView(next);
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
      const salaryRows = period.salaryRows.map(calcSalaryRow);
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
