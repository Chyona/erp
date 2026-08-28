import { Button, InputNumber, Space } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Salary } from '../services/salary';

/** 工资/劳务表共用金额单元格（只读展示或可编辑 InputNumber）。 */
export function PayrollMoneyCell({
  value,
  readOnly,
  onChange
}: {
  value: number;
  readOnly?: boolean;
  onChange: (value: number) => void;
}) {
  if (readOnly) {
    return <span className="payroll-table__money">{Salary.formatMoneyDisplay(value)}</span>;
  }
  return (
    <InputNumber
      size="small"
      className="payroll-table__input-number"
      value={value || undefined}
      min={0}
      precision={2}
      controls={false}
      onChange={(next) => onChange(Number(next) || 0)}
    />
  );
}

/** 工资/劳务表行操作：新增 / 删除。 */
export function PayrollRowActions({
  onAddRow,
  onRemoveRow
}: {
  onAddRow: () => void;
  onRemoveRow: () => void;
}) {
  return (
    <Space size={4}>
      <Button type="text" size="small" icon={<PlusOutlined />} aria-label="新增" onClick={onAddRow} />
      <Button
        type="text"
        size="small"
        danger
        icon={<DeleteOutlined />}
        aria-label="删除"
        onClick={onRemoveRow}
      />
    </Space>
  );
}
