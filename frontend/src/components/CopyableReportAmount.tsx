import type { ReactNode } from 'react';
import { App, Tooltip } from 'antd';
import { formatReportAmount } from '../utils/reportAmount';

type CopyableReportAmountProps = {
  value: unknown;
  format?: 'report' | 'plain';
  strong?: boolean;
  className?: string;
  showZero?: boolean;
};

function getAmountText(value: unknown, format: 'report' | 'plain', showZero = false) {
  if (value == null) return '';
  const amount = Number(value);
  if (!showZero && Math.abs(amount) < 0.005) return '';
  if (Number.isNaN(amount)) return '';
  return format === 'plain' ? amount.toFixed(2) : formatReportAmount(showZero ? amount : value);
}

export default function CopyableReportAmount({
  value,
  format = 'report',
  strong = false,
  className,
  showZero = false
}: CopyableReportAmountProps) {
  const { message } = App.useApp();
  const text = getAmountText(value, format, showZero);

  if (!text) return null;

  const handleCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    try {
      await navigator.clipboard.writeText(text);
      message.success('已复制金额');
    } catch {
      message.error('复制失败');
    }
  };

  const content: ReactNode = strong ? <strong>{text}</strong> : text;

  return (
    <Tooltip
      placement="bottom"
      color="#fff"
      mouseEnterDelay={0.1}
      classNames={{ root: 'copyable-report-amount-tooltip' }}
      title={
        <button
          type="button"
          className="copyable-report-amount-tooltip__action"
          onClick={handleCopy}
        >
          复制金额
        </button>
      }
    >
      <span
        className={['copyable-report-amount', className].filter(Boolean).join(' ')}
      >
        <span className="copyable-report-amount__text">{content}</span>
      </span>
    </Tooltip>
  );
}
