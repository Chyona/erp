import { INVOICE_TYPE } from '../constants/invoice';
import type { InvoiceType, VoucherEntry } from '../types';

export const SALES_TAX_SUMMARY_ORDINARY = '销项税额（普票）';
export const SALES_TAX_SUMMARY_SPECIAL = '销项税额（专票）';

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

function isSalesTaxEntry(entry: Pick<VoucherEntry, 'accountCode' | 'credit'>) {
  return entry.accountCode === '2221' && (parseFloat(String(entry.credit)) || 0) > 0;
}

/** 从 2221 贷方分录摘要推断开票类型（兼容旧「销项税额」写法） */
export function inferInvoiceTypeFromEntries(
  entries: VoucherEntry[] | undefined,
  businessType?: string,
  storedInvoiceType?: InvoiceType | string
): InvoiceType {
  if (businessType && businessType !== '销售收入') return INVOICE_TYPE.NONE as InvoiceType;

  let hasOrdinary = false;
  let hasSpecial = false;
  let hasLegacyTax = false;

  for (const entry of entries || []) {
    if (!isSalesTaxEntry(entry)) continue;
    const summary = (entry.summary || '').trim();
    if (/专票/.test(summary)) hasSpecial = true;
    else if (/普票/.test(summary)) hasOrdinary = true;
    else if (/销项税/.test(summary)) hasLegacyTax = true;
  }

  if (hasSpecial && !hasOrdinary) return INVOICE_TYPE.SPECIAL as InvoiceType;
  if (hasOrdinary && !hasSpecial) return INVOICE_TYPE.ORDINARY as InvoiceType;
  if (hasLegacyTax) {
    return storedInvoiceType === INVOICE_TYPE.SPECIAL
      ? (INVOICE_TYPE.SPECIAL as InvoiceType)
      : (INVOICE_TYPE.ORDINARY as InvoiceType);
  }
  if (storedInvoiceType === INVOICE_TYPE.SPECIAL || storedInvoiceType === INVOICE_TYPE.ORDINARY) {
    return storedInvoiceType as InvoiceType;
  }
  return INVOICE_TYPE.NONE as InvoiceType;
}

export function sumSalesTaxCredits(entries: VoucherEntry[] | undefined) {
  let tax = 0;
  for (const entry of entries || []) {
    if (entry.accountCode === '2221') {
      tax += parseFloat(String(entry.credit)) || 0;
    }
  }
  return roundMoney(tax);
}

export function syncSalesVoucherMeta(voucher: {
  businessType?: string;
  entries?: VoucherEntry[];
  invoiceType?: InvoiceType | string;
}) {
  if (voucher.businessType !== '销售收入') {
    return { invoiceType: INVOICE_TYPE.NONE as InvoiceType, taxAmount: 0 };
  }
  const invoiceType = inferInvoiceTypeFromEntries(
    voucher.entries,
    voucher.businessType,
    voucher.invoiceType
  );
  return {
    invoiceType,
    taxAmount: sumSalesTaxCredits(voucher.entries)
  };
}

/** 导入/保存时：将通用「销项税额」规范为带票种摘要 */
export function normalizeSalesTaxEntrySummaries(
  entries: VoucherEntry[] | undefined,
  invoiceType: InvoiceType | string
) {
  if (!entries?.length) return entries;
  if (invoiceType !== INVOICE_TYPE.ORDINARY && invoiceType !== INVOICE_TYPE.SPECIAL) {
    return entries;
  }
  const target =
    invoiceType === INVOICE_TYPE.SPECIAL
      ? SALES_TAX_SUMMARY_SPECIAL
      : SALES_TAX_SUMMARY_ORDINARY;

  return entries.map((entry) => {
    if (!isSalesTaxEntry(entry)) return entry;
    const summary = (entry.summary || '').trim();
    if (summary === SALES_TAX_SUMMARY_ORDINARY || summary === SALES_TAX_SUMMARY_SPECIAL) {
      return entry;
    }
    if (summary === '销项税额' || /^销项税/.test(summary)) {
      return { ...entry, summary: target };
    }
    return entry;
  });
}
