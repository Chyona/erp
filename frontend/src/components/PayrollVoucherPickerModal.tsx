import { useEffect, useMemo, useState } from 'react';
import { Input, Modal, Select, Space, Typography } from 'antd';
import {
  PAYROLL_ACCRUAL_LINK_TYPES,
  PAYROLL_PAYMENT_LINK_TYPES,
  PAYROLL_VOUCHER_LABELS,
  payrollVoucherSearchKeyword,
  type PayrollVoucherLinkType
} from '../services/salary';
import { Voucher } from '../services/voucher';
import type { Voucher as VoucherRecord } from '../types';

const { Text } = Typography;

function formatVoucherEntrySummaries(entries: VoucherRecord['entries'] = []) {
  const summaries = [...new Set(entries.map((entry) => entry.summary?.trim()).filter(Boolean))];
  if (!summaries.length) return '—';
  const text = summaries.join('；');
  return text.length > 48 ? `${text.slice(0, 48)}…` : text;
}

function voucherOptionLabel(item: VoucherRecord) {
  return `${item.voucherNo} · ${item.date} · ${formatVoucherEntrySummaries(item.entries)}`;
}

const LINK_TYPE_OPTIONS = [
  {
    label: '计提',
    options: PAYROLL_ACCRUAL_LINK_TYPES.map((value) => ({
      value,
      label: PAYROLL_VOUCHER_LABELS[value]
    }))
  },
  {
    label: '发放/支付',
    options: PAYROLL_PAYMENT_LINK_TYPES.map((value) => ({
      value,
      label: PAYROLL_VOUCHER_LABELS[value]
    }))
  }
];

type PayrollVoucherPickerModalProps = {
  open: boolean;
  periodLabel: string;
  existingVoucherIds: string[];
  confirmLoading?: boolean;
  onCancel: () => void;
  onConfirm: (payload: {
    voucherId: string;
    linkType: PayrollVoucherLinkType;
    customLabel?: string;
  }) => void | Promise<void>;
};

export default function PayrollVoucherPickerModal({
  open,
  periodLabel,
  existingVoucherIds,
  confirmLoading = false,
  onCancel,
  onConfirm
}: PayrollVoucherPickerModalProps) {
  const [loading, setLoading] = useState(false);
  const [vouchers, setVouchers] = useState<VoucherRecord[]>([]);
  const [keyword, setKeyword] = useState('');
  const [voucherId, setVoucherId] = useState<string | null>(null);
  const [linkType, setLinkType] = useState<PayrollVoucherLinkType>('accrual');
  const [customLabel, setCustomLabel] = useState('');

  useEffect(() => {
    if (!open) return;
    const initialLinkType: PayrollVoucherLinkType = 'accrual';
    setKeyword(payrollVoucherSearchKeyword(initialLinkType));
    setVoucherId(null);
    setLinkType(initialLinkType);
    setCustomLabel('');
    setLoading(true);
    void Voucher.getAll()
      .then((list) => {
        setVouchers(
          list
            .filter((item) => item.status !== Voucher.STATUS.DRAFT)
            .sort((a, b) => b.date.localeCompare(a.date) || b.voucherNo.localeCompare(a.voucherNo))
        );
      })
      .finally(() => setLoading(false));
  }, [open]);

  const handleLinkTypeChange = (value: PayrollVoucherLinkType) => {
    setLinkType(value);
    setKeyword(payrollVoucherSearchKeyword(value));
    setVoucherId(null);
  };

  const options = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return vouchers
      .filter((item) => !existingVoucherIds.includes(item.id))
      .filter((item) => {
        if (!q) return true;
        const entryText = (item.entries || []).map((entry) => entry.summary || '').join(' ');
        const hay = `${item.voucherNo} ${item.date} ${item.remark || ''} ${item.businessType || ''} ${entryText}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 200)
      .map((item) => ({
        value: item.id,
        label: voucherOptionLabel(item)
      }));
  }, [existingVoucherIds, keyword, vouchers]);

  const handleOk = () => {
    if (!voucherId) return;
    if (linkType === 'other' && !customLabel.trim()) return;
    return onConfirm({
      voucherId,
      linkType,
      customLabel: linkType === 'other' ? customLabel.trim() : undefined
    });
  };

  return (
    <Modal
      title={`关联凭证 · ${periodLabel}`}
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={confirmLoading}
      okButtonProps={{
        disabled: !voucherId || (linkType === 'other' && !customLabel.trim())
      }}
      destroyOnHidden
      width={720}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <div>
          <Text type="secondary">凭证类型</Text>
          <Select
            style={{ width: '100%', marginTop: 6 }}
            value={linkType}
            options={LINK_TYPE_OPTIONS}
            onChange={handleLinkTypeChange}
          />
        </div>
        {linkType === 'other' ? (
          <div>
            <Text type="secondary">自定义标签</Text>
            <Input
              value={customLabel}
              placeholder="如：补充计提"
              onChange={(e) => setCustomLabel(e.target.value)}
              style={{ marginTop: 6 }}
            />
          </div>
        ) : null}
        <div>
          <Text type="secondary">搜索并选择凭证</Text>
          <Select
            showSearch
            allowClear
            placeholder="输入凭证号、日期、摘要或备注搜索"
            style={{ width: '100%', marginTop: 6 }}
            value={voucherId ?? undefined}
            options={options}
            loading={loading}
            filterOption={false}
            searchValue={keyword}
            onSearch={setKeyword}
            onChange={(value) => setVoucherId(value || null)}
          />
        </div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          计提、发放/支付两类均可关联多张凭证（如工资计提、劳务计提等），保存后可继续添加。
        </Text>
      </Space>
    </Modal>
  );
}
