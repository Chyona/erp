import { Space, Tag } from 'antd';
import { Voucher } from '../services/voucher';
import type { Voucher as VoucherRecord } from '../types';

const STATUS_COLOR = {
  draft: 'gold',
  approved: 'green',
  locked: 'blue'
};

/** 系统结转类型标记：普票免税结转 / 损益结转 */
export function CarryForwardBadge({
  voucher
}: {
  voucher?: Pick<VoucherRecord, 'isTaxExemptionCarryForward' | 'isProfitLossClosing'> | null;
}) {
  if (voucher?.isTaxExemptionCarryForward) {
    return (
      <Tag color="purple" title="季度销售额未超标时的普票增值税减免结转（贷 5301 免税收入）">
        免税结转
      </Tag>
    );
  }
  if (voucher?.isProfitLossClosing) {
    return (
      <Tag color="cyan" title="损益类科目结转至本年利润">
        结转损益
      </Tag>
    );
  }
  return null;
}

export default function StatusBadge({
  status,
  voucher
}: {
  status: string;
  voucher?: Pick<VoucherRecord, 'isTaxExemptionCarryForward' | 'isProfitLossClosing'> | null;
}) {
  return (
    <Space size={4} wrap>
      <Tag color={STATUS_COLOR[status] || 'default'}>
        {Voucher.STATUS_LABEL[status] || status}
      </Tag>
      <CarryForwardBadge voucher={voucher} />
    </Space>
  );
}

export function getVoucherSummary(voucher, maxLen = 40) {
  const summary = voucher.entries
    .map((e) => e.summary)
    .filter(Boolean)
    .join('；');
  if (summary.length <= maxLen) return summary;
  return summary.slice(0, maxLen) + '...';
}
