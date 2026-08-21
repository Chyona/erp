import type { Voucher } from '../types';

export const CARRY_FORWARD_VOUCHER_READONLY_TIP =
  '系统自动结转凭证不可修改或删除，请在工作台「季末结转」使用反结转撤销';

export function isCarryForwardVoucher(
  voucher: Pick<Voucher, 'isTaxExemptionCarryForward' | 'isProfitLossClosing'> | null | undefined
) {
  return Boolean(voucher?.isTaxExemptionCarryForward || voucher?.isProfitLossClosing);
}

/** 导入用：识别系统结转凭证（显式标识或摘要/备注特征），此类凭证不入库。 */
export function isCarryForwardImportVoucher(
  voucher: {
    isTaxExemptionCarryForward?: boolean;
    isProfitLossClosing?: boolean;
    remark?: string;
    entries?: Array<{ summary?: string }>;
  } | null | undefined
): boolean {
  if (!voucher) return false;
  if (isCarryForwardVoucher(voucher)) return true;

  const texts = [
    voucher.remark || '',
    ...(voucher.entries || []).map((e) => e.summary || '')
  ].join('\n');

  // 与本系统生成的结转凭证文案对齐；避免仅因普通「结转成本」等业务摘要误杀
  return (
    /普票.*(?:增值税)?减免结转/.test(texts) ||
    /结转损益/.test(texts) ||
    /损益结转/.test(texts)
  );
}

/** 导入提示：结转跳过规则文案（与 isCarryForwardImportVoucher 保持一致） */
export const CARRY_FORWARD_IMPORT_SKIP_TIP =
  '结转跳过：摘要/备注含「普票减免结转」「结转损益」「损益结转」的凭证不导入；普通业务如「结转成本」不受影响，请在「季末结转」重新生成。';
