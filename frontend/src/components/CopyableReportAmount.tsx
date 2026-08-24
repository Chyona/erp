import type { ReactNode } from 'react';
import { App, Tooltip } from 'antd';
import { formatReportAmount } from '../utils/reportAmount';

type CopyableReportAmountProps = {
  value: unknown;
  format?: 'report' | 'plain';
  strong?: boolean;
  className?: string;
};

function getAmountText(value: unknown, format: 'report' | 'plain') {
  if (value == null || Math.abs(Number(value)) < 0.005) return '';
  return format === 'plain' ? Number(value).toFixed(2) : formatReportAmount(value);
}

export default function CopyableReportAmount({
  value,
  format = 'report',
  strong = false,
  className
}: CopyableReportAmountProps) {
  const { message } = App.useApp();
  const text = getAmountText(value, format);

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
      overlayClassName="copyable-report-amount-tooltip"
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
