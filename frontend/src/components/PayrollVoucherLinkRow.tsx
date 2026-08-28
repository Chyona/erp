import { Button, Tag } from 'antd';
import {
  formatPayrollVoucherLinkNo,
  resolvePayrollVoucherShortLabel,
  resolvePayrollVoucherTagClassName,
  type PayrollVoucherLinkView
} from '../services/salary';

/** 工资表/人力成本页共用的凭证关联行（字号 + 可选类型标签 + 删除）。 */
export default function PayrollVoucherLinkRow({
  link,
  showTag = true,
  readOnly = false,
  onOpen,
  onRemove
}: {
  link: PayrollVoucherLinkView;
  showTag?: boolean;
  readOnly?: boolean;
  onOpen: (voucherId: string) => void;
  onRemove?: (linkId: string) => void;
}) {
  return (
    <div className="payroll-sheet-list__voucher-link-row">
      <span className="payroll-sheet-list__voucher-badge">
        <Button
          type="link"
          size="small"
          className="payroll-sheet-list__voucher-link"
          disabled={link.missing}
          onClick={() => (link.missing ? undefined : onOpen(link.voucherId))}
        >
          {formatPayrollVoucherLinkNo(link)}
        </Button>
        {showTag ? (
          <Tag
            bordered={false}
            className={`payroll-sheet-list__voucher-badge-tag ${resolvePayrollVoucherTagClassName(link.linkType)}`}
          >
            {resolvePayrollVoucherShortLabel(link)}
          </Tag>
        ) : null}
      </span>
      {!readOnly && onRemove ? (
        <Button
          type="link"
          size="small"
          danger
          className="payroll-sheet-list__voucher-remove"
          onClick={() => onRemove(link.id)}
        >
          删除
        </Button>
      ) : null}
    </div>
  );
}
