import { useState, type ReactNode } from 'react';
import { Button, Input, InputNumber, Select, Space } from 'antd';
import { DownOutlined, UpOutlined } from '@ant-design/icons';
import type { VoucherFilters } from '../types';

const UNLIMITED = '';

const STATUS_OPTIONS = [  { value: UNLIMITED, label: '不限' },
  { value: 'draft', label: '草稿' },
  { value: 'approved', label: '已审核' },
  { value: 'locked', label: '已锁定' }
];

const BUSINESS_TYPE_OPTIONS = [
  { value: UNLIMITED, label: '不限' },
  { value: '日常费用', label: '日常费用' },
  { value: '销售收入', label: '销售收入' },
  { value: '采购支出', label: '采购支出' },
  { value: '工资薪酬', label: '工资薪酬' },
  { value: '固定资产', label: '固定资产' },
  { value: '税费缴纳', label: '税费缴纳' },
  { value: '银行往来', label: '银行往来' },
  { value: '其他', label: '其他' }
];

export const EMPTY_VOUCHER_FILTERS: VoucherFilters = {
  startDate: '',
  endDate: '',
  voucherNumber: '',
  status: '',
  summary: '',
  accountCode: '',
  amountMin: '',
  amountMax: '',
  businessType: '',
  signatory: '',
  remark: ''
};

type VoucherFilterPanelProps = {
  value: VoucherFilters;
  onChange: (next: VoucherFilters) => void;
  onSearch: () => void;
  onReset: () => void;
};

function FilterRow({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="voucher-filter-panel__row">
      <div className="voucher-filter-panel__label">{label}</div>
      <div className="voucher-filter-panel__field">
        {children}
        {hint ? <div className="voucher-filter-panel__hint">{hint}</div> : null}
      </div>
    </div>
  );
}

export default function VoucherFilterPanel({
  value,
  onChange,
  onSearch,
  onReset
}: VoucherFilterPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const patch = (partial: Partial<VoucherFilters>) => {
    onChange({ ...value, ...partial });
  };

  return (
    <div className="voucher-filter-panel">
      <FilterRow label="凭证号" hint="例：1, 3, 5-7">
        <Input
          allowClear
          placeholder="请输入凭证号或凭证号范围"
          value={value.voucherNumber || ''}
          onChange={(e) => patch({ voucherNumber: e.target.value })}
          onPressEnter={onSearch}
        />
      </FilterRow>

      <FilterRow label="状态">
        <Select
          value={value.status || UNLIMITED}
          options={STATUS_OPTIONS}
          onChange={(v) => patch({ status: v === UNLIMITED ? '' : v })}
        />
      </FilterRow>

      <FilterRow label="摘要">
        <Input
          allowClear
          placeholder="请输入内容"
          value={value.summary || ''}
          onChange={(e) => patch({ summary: e.target.value })}
          onPressEnter={onSearch}
        />
      </FilterRow>

      <FilterRow label="科目" hint="例：1001, 1009, 2121-2131">
        <Input
          allowClear
          placeholder="请输入科目编码，或科目编码范围"
          value={value.accountCode || ''}
          onChange={(e) => patch({ accountCode: e.target.value })}
          onPressEnter={onSearch}
        />
      </FilterRow>

      <FilterRow label="金额">
        <div className="voucher-filter-panel__range">
          <InputNumber
            placeholder="请输入"
            controls={false}
            value={value.amountMin === '' ? null : Number(value.amountMin)}
            onChange={(v) => patch({ amountMin: v ?? '' })}
          />
          <span className="voucher-filter-panel__range-sep">至</span>
          <InputNumber
            placeholder="请输入"
            controls={false}
            value={value.amountMax === '' ? null : Number(value.amountMax)}
            onChange={(v) => patch({ amountMax: v ?? '' })}
          />
        </div>
      </FilterRow>

      {expanded ? (
        <>
          <FilterRow label="业务类型">
            <Select
              value={value.businessType || UNLIMITED}
              options={BUSINESS_TYPE_OPTIONS}
              onChange={(v) => patch({ businessType: v === UNLIMITED ? '' : v })}
            />
          </FilterRow>

          <FilterRow label="制单人">
            <Input
              allowClear
              placeholder="请输入名字"
              value={value.signatory || ''}
              onChange={(e) => patch({ signatory: e.target.value })}
              onPressEnter={onSearch}
            />
          </FilterRow>

          <FilterRow label="备注">
            <Input
              allowClear
              placeholder="请输入内容"
              value={value.remark || ''}
              onChange={(e) => patch({ remark: e.target.value })}
              onPressEnter={onSearch}
            />
          </FilterRow>
        </>
      ) : null}

      <div className="voucher-filter-panel__footer">
        <Button
          type="link"
          className="voucher-filter-panel__expand"
          icon={expanded ? <UpOutlined /> : <DownOutlined />}
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? '收起' : '展开更多'}
        </Button>
        <Space>
          <Button onClick={onReset}>重置</Button>
          <Button type="primary" onClick={onSearch}>
            查询
          </Button>
        </Space>
      </div>
    </div>
  );
}
