import { Tag } from 'antd';
import { Voucher } from '../services/voucher.js';

const STATUS_COLOR = {
  draft: 'gold',
  approved: 'green',
  locked: 'blue'
};

export default function StatusBadge({ status }) {
  return (
    <Tag color={STATUS_COLOR[status] || 'default'}>
      {Voucher.STATUS_LABEL[status] || status}
    </Tag>
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
