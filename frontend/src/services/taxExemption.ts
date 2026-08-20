import { DB } from './db';
import { Accounts } from './accounts';
import { Voucher } from './voucher';
import { INVOICE_TYPE } from '../constants/invoice';
import type { TaxExemptionTaxLine, Voucher as VoucherRecord } from '../types';
import {
  formatTaxExemptionPeriod,
  reportPeriodEndDate,
  taxExemptionPeriodKey,
  voucherInReportPeriod
} from '../utils/reportPeriod';

function roundMoney(n) {
  return Math.round((parseFloat(n) || 0) * 100) / 100;
}

/** 销售凭证增值税：汇总分录中 2221 贷方合计（同一凭证可能有多条税额分录） */
function sumSalesTaxCredits(voucher) {
  let tax = 0;
  for (const e of voucher.entries || []) {
    if (e.accountCode === '2221') {
      tax += parseFloat(String(e.credit)) || 0;
    }
  }
  return roundMoney(tax);
}

function resolveSalesTaxAmount(voucher) {
  const fromEntries = sumSalesTaxCredits(voucher);
  if (fromEntries > 0) return fromEntries;
  return roundMoney(voucher.taxAmount);
}

/** 销售凭证：价税合计=含税收款，不含税金额=主营业务收入，税额=增值税 */
function getSalesInvoiceAmounts(voucher) {
  const tax = resolveSalesTaxAmount(voucher);
  const entries = voucher.entries || [];

  const revenueEntry = entries.find((e) => e.accountCode === '5001');
  let netAmount = revenueEntry
    ? roundMoney(Math.max(revenueEntry.credit || 0, revenueEntry.debit || 0))
    : 0;

  const bankEntry = entries.find((e) => e.accountCode === '1002' || e.accountCode === '1001');
  let grossAmount = bankEntry
    ? roundMoney(Math.max(bankEntry.debit || 0, bankEntry.credit || 0))
    : 0;

  if (!netAmount && grossAmount && tax) {
    netAmount = roundMoney(grossAmount - tax);
  }
  if (!grossAmount && netAmount) {
    grossAmount = roundMoney(netAmount + tax);
  }
  if (!netAmount && !grossAmount && voucher.totalDebit) {
    grossAmount = roundMoney(voucher.totalDebit);
    netAmount = roundMoney(grossAmount - tax);
  }

  return { grossAmount, netAmount, taxAmount: tax };
}

function getVoucherEntrySummary(voucher) {
  const entries = voucher.entries || [];
  const first = entries.find((e) => e.summary?.trim());
  if (first) return first.summary.trim();
  return entries.map((e) => e.summary).filter(Boolean).join('；');
}

/** 展开销售凭证中的 2221 贷方分录，每条税额单独一行 */
function expandSalesTaxLines(voucher: VoucherRecord): TaxExemptionTaxLine[] {
  const lines: TaxExemptionTaxLine[] = [];
  const entries = voucher.entries || [];

  entries.forEach((e, index) => {
    if (e.accountCode !== '2221') return;
    const amount = roundMoney(parseFloat(String(e.credit)) || 0);
    if (amount <= 0) return;
    lines.push({
      id: `${voucher.id}-${index}`,
      voucherId: voucher.id,
      voucherNo: voucher.voucherNo,
      date: voucher.date,
      taxAmount: amount,
      entrySummary: e.summary?.trim() || getVoucherEntrySummary(voucher),
      remark: voucher.remark?.trim() || '',
      entryIndex: index
    });
  });

  if (!lines.length) {
    const tax = roundMoney(voucher.taxAmount);
    if (tax > 0) {
      lines.push({
        id: `${voucher.id}-tax`,
        voucherId: voucher.id,
        voucherNo: voucher.voucherNo,
        date: voucher.date,
        taxAmount: tax,
        entrySummary: getVoucherEntrySummary(voucher),
        remark: voucher.remark?.trim() || '',
        entryIndex: -1
      });
    }
  }

  return lines;
}

function uniqueVoucherIds(lines: TaxExemptionTaxLine[]) {
  return [...new Set(lines.map((line) => line.voucherId))];
}

function enrichSalesVoucher(voucher, extra = {}) {
  const amounts = getSalesInvoiceAmounts(voucher);
  return {
    ...voucher,
    ...amounts,
    entrySummary: getVoucherEntrySummary(voucher),
    ...extra
  };
}

function isSalesVoucher(voucher) {
  return voucher.businessType === '销售收入';
}

function inferPeriodType(periodKey) {
  return /-Q[1-4]$/.test(periodKey) ? 'quarter' : 'month';
}

function matchesCarryForward(voucher, periodKey, periodType) {
  if (!voucher.isTaxExemptionCarryForward) return false;
  if (voucher.taxExemptionPeriod !== periodKey) return false;
  const storedType = voucher.taxExemptionPeriodType || inferPeriodType(periodKey);
  return storedType === periodType;
}

function collectRelatedCarryForwardVouchers(
  vouchers,
  period,
  periodKey,
  periodType,
  linkedCfIds
) {
  const related = [];
  const seen = new Set();

  for (const voucher of vouchers) {
    if (!voucher.isTaxExemptionCarryForward || seen.has(voucher.id)) continue;
    if (matchesCarryForward(voucher, periodKey, periodType)) {
      related.push(voucher);
      seen.add(voucher.id);
    }
  }

  for (const cfId of linkedCfIds) {
    const voucher = vouchers.find((v) => v.id === cfId);
    if (voucher?.isTaxExemptionCarryForward && !seen.has(voucher.id)) {
      related.push(voucher);
      seen.add(voucher.id);
    }
  }

  for (const voucher of vouchers) {
    if (!voucher.isTaxExemptionCarryForward || seen.has(voucher.id)) continue;
    if (voucherInReportPeriod(voucher.date, period)) {
      related.push(voucher);
      seen.add(voucher.id);
    }
  }

  return related;
}

function isCarryForwardActive(voucher, voucherById) {
  if (!voucher.taxExemptionDone) return false;
  if (!voucher.taxExemptionVoucherId) return false;
  const carryForward = voucherById.get(voucher.taxExemptionVoucherId);
  return Boolean(carryForward?.isTaxExemptionCarryForward);
}

/** 结转凭证被手动删除后，清除销售凭证上的失效结转标记 */
async function repairOrphanTaxExemptionLinks(vouchers) {
  const voucherById = new Map(vouchers.map((v) => [v.id, v]));
  let repaired = 0;

  for (const voucher of vouchers) {
    if (!voucher.taxExemptionDone) continue;
    if (isCarryForwardActive(voucher, voucherById)) continue;

    voucher.taxExemptionDone = false;
    voucher.taxExemptionVoucherId = '';
    await DB.put('vouchers', voucher);
    repaired += 1;
  }

  return repaired;
}

/** 指定期间（按月 / 按季）普票 / 专票减免结转汇总 */
export async function getPeriodSummary(period) {
  const periodKey = taxExemptionPeriodKey(period);
  const periodType = period.type;
  let vouchers = await Voucher.getAll();
  const restoredOrphanCount = await repairOrphanTaxExemptionLinks(vouchers);
  if (restoredOrphanCount > 0) {
    vouchers = await Voucher.getAll();
  }
  const voucherById = new Map(vouchers.map((v) => [v.id, v]));
  const inPeriod = vouchers.filter(
    (v) => voucherInReportPeriod(v.date, period) && v.status !== Voucher.STATUS.DRAFT
  );

  const ordinaryPending: TaxExemptionTaxLine[] = [];
  const ordinaryDone: TaxExemptionTaxLine[] = [];
  const specialInvoices = [];
  const ordinaryWithoutTax = [];

  for (const v of inPeriod) {
    if (!isSalesVoucher(v)) continue;

    if (v.invoiceType === INVOICE_TYPE.SPECIAL) {
      specialInvoices.push(enrichSalesVoucher(v));
      continue;
    }

    if (v.invoiceType === INVOICE_TYPE.ORDINARY) {
      const taxLines = expandSalesTaxLines(v);
      if (!taxLines.length) {
        ordinaryWithoutTax.push(enrichSalesVoucher(v));
        continue;
      }
      if (isCarryForwardActive(v, voucherById)) {
        ordinaryDone.push(...taxLines);
      } else {
        ordinaryPending.push(...taxLines);
      }
    }
  }

  const linkedCfIds = [
    ...new Set(
      ordinaryDone
        .map((line) => voucherById.get(line.voucherId)?.taxExemptionVoucherId)
        .filter(Boolean)
    )
  ];
  const relatedCarryForwardVouchers = collectRelatedCarryForwardVouchers(
    vouchers,
    period,
    periodKey,
    periodType,
    linkedCfIds
  ).filter((v) => voucherById.has(v.id));
  const carryForwardVoucher = relatedCarryForwardVouchers[0] || null;
  const exactCarryForwardVoucher =
    vouchers.find((v) => matchesCarryForward(v, periodKey, periodType)) || null;

  const pendingTaxTotal = ordinaryPending.reduce((sum, line) => sum + line.taxAmount, 0);

  return {
    period,
    periodKey,
    periodType,
    ordinaryPending,
    ordinaryDone,
    ordinaryPendingVoucherCount: uniqueVoucherIds(ordinaryPending).length,
    ordinaryDoneVoucherCount: uniqueVoucherIds(ordinaryDone).length,
    ordinaryWithoutTax,
    specialInvoices,
    pendingTaxTotal: roundMoney(pendingTaxTotal),
    carryForwardVoucher,
    exactCarryForwardVoucher,
    relatedCarryForwardVouchers,
    restoredOrphanCount
  };
}

/** 生成普票增值税减免结转凭证，并标记来源销售凭证 */
export async function createCarryForward(period, { approve = true } = {}) {
  const summary = await getPeriodSummary(period);
  const periodLabel = formatTaxExemptionPeriod(period);

  if (summary.exactCarryForwardVoucher) {
    throw new Error(
      `${periodLabel} 已存在减免结转凭证 ${summary.exactCarryForwardVoucher.voucherNo}`
    );
  }
  if (!summary.ordinaryPending.length) {
    throw new Error('该期间没有待结转的普票增值税（需为已审核的销售凭证且填写税额）');
  }

  const totalTax = summary.pendingTaxTotal;
  const pendingVoucherIds = uniqueVoucherIds(summary.ordinaryPending);
  const accounts = await Accounts.getAll();
  const acc2221 = accounts.find((a) => a.code === '2221');
  const acc5301 = accounts.find((a) => a.code === '5301');
  if (!acc2221 || !acc5301) {
    throw new Error('缺少 2221 应交税费 或 5301 营业外收入 科目');
  }

  const signatory = String((await DB.getSetting('defaultSignatory')) ?? '');
  const scopeLabel = period.type === 'quarter' ? '季度' : '月度';

  const voucherData = {
    voucherType: '记',
    date: reportPeriodEndDate(period),
    attachmentCount: 0,
    businessType: '税费缴纳',
    invoiceType: INVOICE_TYPE.NONE,
    taxAmount: 0,
    isTaxExemptionCarryForward: true,
    taxExemptionPeriodType: period.type,
    taxExemptionPeriod: summary.periodKey,
    invoiceNumbers: '',
    remark: `${scopeLabel}普票增值税减免结转，${pendingVoucherIds.length} 张凭证 ${summary.ordinaryPending.length} 条税额`,
    entries: [
      ...summary.ordinaryPending.map((line) => ({
        summary: line.entrySummary || `${periodLabel}普票增值税减免结转`,
        accountId: acc2221.id,
        accountCode: acc2221.code,
        accountName: acc2221.name,
        debit: line.taxAmount,
        credit: 0
      })),
      {
        summary: `${periodLabel}免税收入`,
        accountId: acc5301.id,
        accountCode: acc5301.code,
        accountName: acc5301.name,
        debit: 0,
        credit: totalTax
      }
    ],
    attachmentIds: [],
    preparedBy: signatory,
    reviewedBy: signatory,
    postedBy: signatory,
    cashierBy: signatory
  };

  const saved = await Voucher.save(voucherData as import('../types').VoucherInput, approve);

  for (const voucherId of pendingVoucherIds) {
    const source = await Voucher.getById(voucherId);
    if (!source) continue;
    source.taxExemptionDone = true;
    source.taxExemptionVoucherId = saved.id;
    await DB.put('vouchers', source);
  }

  await DB.addAuditLog(
    approve ? '新建并审核' : '新建草稿',
    '普票减免结转',
    `${saved.voucherNo} ${totalTax.toFixed(2)} 元，${summary.ordinaryPending.length} 条税额 / ${pendingVoucherIds.length} 张凭证（${periodLabel}）`
  );

  return {
    voucher: saved,
    count: summary.ordinaryPending.length,
    voucherCount: pendingVoucherIds.length,
    totalTax
  };
}

/** 反结转：删除减免结转凭证，并恢复来源销售凭证的待结转状态 */
export async function reverseCarryForward(period, carryForwardId) {
  let cf;
  if (carryForwardId) {
    cf = await Voucher.getById(carryForwardId);
    if (!cf?.isTaxExemptionCarryForward) {
      throw new Error('无效的减免结转凭证');
    }
  } else {
    const summary = await getPeriodSummary(period);
    cf = summary.carryForwardVoucher;
  }

  const periodLabel = formatTaxExemptionPeriod(period);

  if (!cf) {
    throw new Error(`${periodLabel} 不存在减免结转凭证，无法反结转`);
  }

  const allVouchers = await Voucher.getAll();
  const linked = allVouchers.filter((v) => v.taxExemptionVoucherId === cf.id);

  for (const v of linked) {
    v.taxExemptionDone = false;
    v.taxExemptionVoucherId = '';
    await DB.put('vouchers', v);
  }

  if (cf.status === Voucher.STATUS.LOCKED) {
    await Voucher.forceRemove(cf.id, { allowCarryForwardBypass: true });
  } else {
    await Voucher.remove(cf.id, { allowCarryForwardBypass: true });
  }

  await DB.addAuditLog(
    '反结转',
    '普票减免结转',
    `删除 ${cf.voucherNo}，恢复 ${linked.length} 笔销售凭证待结转状态（${periodLabel}）`
  );

  return {
    voucher: cf,
    restoredCount: linked.length
  };
}

export const TaxExemption = {
  getPeriodSummary,
  createCarryForward,
  reverseCarryForward
};
