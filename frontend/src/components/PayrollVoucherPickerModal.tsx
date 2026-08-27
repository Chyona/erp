import { useEffect, useMemo, useState } from 'react';
import { Input, Modal, Select, Space, Tag, Typography } from 'antd';
import AppTable from './AppTable';
import { Voucher } from '../services/voucher';
import type { Voucher as VoucherRecord } from '../types';
import {
  PAYROLL_VOUCHER_LABELS,
  type PayrollVoucherLinkType
} from '../services/salary';

const { Text } = Typography;

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
    setKeyword('');
    setVoucherId(null);
    setLinkType('accrual');
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

  const options = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return vouchers
      .filter((item) => !existingVoucherIds.includes(item.id))
      .filter((item) => {
        if (!q) return true;
        const hay = `${item.voucherNo} ${item.date} ${item.remark || ''} ${item.businessType || ''}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 200)
      .map((item) => ({
        value: item.id,
        label: `${item.voucherNo} · ${item.date} · ${item.businessType || '—'}`
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
            options={Object.entries(PAYROLL_VOUCHER_LABELS).map(([value, label]) => ({
              value,
              label
            }))}
            onChange={setLinkType}
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
            placeholder="输入凭证号、日期或备注搜索"
            style={{ width: '100%', marginTop: 6 }}
            value={voucherId ?? undefined}
            options={options}
            loading={loading}
            filterOption={false}
            onSearch={setKeyword}
            onChange={(value) => setVoucherId(value || null)}
          />
        </div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          可关联多张凭证，例如计提、发放工资、缴纳个税等；本模块不支持上传附件。
        </Text>
      </Space>
    </Modal>
  );
}
