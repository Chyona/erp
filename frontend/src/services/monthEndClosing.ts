import { TaxExemption } from './taxExemption';
import { ProfitLossClosing } from './profitLossClosing';
import { ErpApi } from './erpApi';
import { TaxDeclaration } from './taxDeclaration';
import { formatReportPeriod } from '../utils/reportPeriod';
import type { Voucher } from '../types';

type ReportPeriod = {
  type: 'month' | 'quarter';
  year: number;
  month?: number;
  quarter?: number;
};

function closingPeriodLabel(period: ReportPeriod) {
  return period.type === 'quarter' ? '季末结转' : '月末结转';
}

async function assertPeriodNotDeclared(period: ReportPeriod) {
  if (period.type !== 'quarter' || !period.quarter) return;
  if (await TaxDeclaration.isQuarterDeclared({ type: 'quarter', year: period.year, quarter: period.quarter })) {
    throw new Error(
      `${formatReportPeriod(period)} 已申报，不可变更结转数据。${TaxDeclaration.DECLARED_QUARTER_READONLY_TIP}`
    );
  }
}

/** 季末/月末结转汇总：普票减免 + 损益结转 */
export async function getUnifiedSummary(period: ReportPeriod) {
  const periodLabel = formatReportPeriod(period);
  const closingLabel = closingPeriodLabel(period);
  const [tax, profitLossBase] = await Promise.all([
    TaxExemption.getPeriodSummary(period),
    ProfitLossClosing.getPeriodSummary(period)
  ]);

  const taxPendingCount = tax.ordinaryPending.length;
  const taxPendingTotal = tax.pendingTaxTotal;
  const taxVoucher = tax.exactCarryForwardVoucher || tax.carryForwardVoucher;
  const profitLossVoucher = profitLossBase.closingVoucher;

  const profitLoss =
    taxPendingCount > 0 && !taxVoucher
      ? await ProfitLossClosing.getPeriodSummary(period, {
          projectPendingTaxExemption: true
        })
      : profitLossBase;

  const profitLossPendingCount = profitLoss.accountLines.length;

  const taxSettled = taxPendingCount === 0;
  /** 已有损益结转凭证且普票已结清即视为完成（不要求科目余额为零，兼容历史导入） */
  const fullyClosed = taxSettled && Boolean(profitLossVoucher);
  const declared =
    period.type === 'quarter' && period.quarter
      ? await TaxDeclaration.isQuarterDeclared({
          type: 'quarter',
          year: period.year,
          quarter: period.quarter
        })
      : false;
  const staleAfterProfitLoss =
    Boolean(profitLossVoucher) && taxPendingCount > 0;

  let blockReason = '';
  let canClose = false;

  if (profitLoss.draftCount > 0) {
    blockReason = `该期间还有 ${profitLoss.draftCount} 张草稿凭证未审核，请先审核后再结转`;
  } else if (declared) {
    blockReason = `${periodLabel} 已申报`;
  } else if (fullyClosed) {
    blockReason = `${periodLabel} 已完成${closingLabel}`;
  } else if (staleAfterProfitLoss) {
    blockReason = `损益结转已完成，但仍有 ${taxPendingCount} 条普票税额待减免结转，请先反结转后重新操作`;
  } else if (taxVoucher && !profitLossVoucher && profitLossPendingCount === 0) {
    blockReason = `${periodLabel} 普票减免已结转，损益类科目无余额，无需再生成损益结转`;
  } else if (taxSettled && profitLossPendingCount === 0 && !profitLossVoucher) {
    blockReason = `该期间无需${closingLabel}（无待结转普票且损益类科目无余额）`;
  } else {
    canClose = true;
  }

  return {
    period,
    periodLabel,
    closingLabel,
    tax,
    profitLoss,
    taxPendingCount,
    taxPendingTotal,
    taxVoucher,
    profitLossVoucher,
    profitLossPendingCount,
    netProfit: profitLoss.netProfit,
    fullyClosed,
    declared,
    staleAfterProfitLoss,
    canClose,
    blockReason,
    taxExemptionWarnings: profitLoss.taxExemption.warnings
  };
}

/** 一键结转：先普票减免（如有），再损益结转（如有） */
export async function createUnifiedClosing(period: ReportPeriod, { approve = true } = {}) {
  await assertPeriodNotDeclared(period);
  const summary = await getUnifiedSummary(period);
  if (!summary.canClose) {
    throw new Error(summary.blockReason || '当前期间无法结转');
  }

  let taxVoucher: Voucher | null = null;
  let profitLossVoucher: Voucher | null = null;
  let taxCount = 0;
  let taxTotal = 0;
  let accountCount = 0;
  let netProfit = 0;

  if (summary.taxPendingCount > 0) {
    const taxResult = await TaxExemption.createCarryForward(period, { approve });
    taxVoucher = taxResult.voucher;
    taxCount = taxResult.count;
    taxTotal = taxResult.totalTax;
  }

  const refreshed = await ProfitLossClosing.getPeriodSummary(period);
  if (refreshed.previewEntries.length > 0) {
    const plResult = await ProfitLossClosing.createClosing(period, { approve });
    profitLossVoucher = plResult.voucher;
    accountCount = plResult.accountCount;
    netProfit = plResult.netProfit;
  }

  if (!taxVoucher && !profitLossVoucher) {
    throw new Error('没有生成任何结转凭证');
  }

  const parts: string[] = [];
  if (taxVoucher) parts.push(`普票 ${taxVoucher.voucherNo}`);
  if (profitLossVoucher) parts.push(`损益 ${profitLossVoucher.voucherNo}`);

  await ErpApi.addAuditLog(
    approve ? '新建并审核' : '新建草稿',
    summary.closingLabel,
    `${summary.periodLabel}：${parts.join('、')}`
  );

  return {
    taxVoucher,
    profitLossVoucher,
    taxCount,
    taxTotal,
    accountCount,
    netProfit
  };
}

/** 反结转：先撤销损益结转，再撤销普票减免结转 */
export async function reverseUnifiedClosing(period: ReportPeriod) {
  await assertPeriodNotDeclared(period);
  const summary = await getUnifiedSummary(period);

  if (!summary.profitLossVoucher && !summary.taxVoucher) {
    throw new Error(`${summary.periodLabel} 没有可反结转的凭证`);
  }

  if (summary.profitLossVoucher) {
    await ProfitLossClosing.reverseClosing(period, summary.profitLossVoucher.id);
  }

  const refreshedTax = await TaxExemption.getPeriodSummary(period);
  const taxCf =
    refreshedTax.exactCarryForwardVoucher || refreshedTax.carryForwardVoucher;
  if (taxCf) {
    await TaxExemption.reverseCarryForward(period, taxCf.id);
  }

  await ErpApi.addAuditLog('反结转', summary.closingLabel, summary.periodLabel);

  return {
    profitLossVoucher: summary.profitLossVoucher,
    taxVoucher: summary.taxVoucher
  };
}

export const MonthEndClosing = {
  getUnifiedSummary,
  createUnifiedClosing,
  reverseUnifiedClosing
};
