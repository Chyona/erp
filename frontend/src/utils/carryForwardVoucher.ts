import type { Voucher } from '../types';

export const CARRY_FORWARD_VOUCHER_READONLY_TIP =
  '系统自动结转凭证不可修改或删除，请在工作台「季末结转」使用反结转撤销';

export function isCarryForwardVoucher(
  voucher: Pick<Voucher, 'isTaxExemptionCarryForward' | 'isProfitLossClosing'> | null | undefined
) {
  return Boolean(voucher?.isTaxExemptionCarryForward || voucher?.isProfitLossClosing);
}
