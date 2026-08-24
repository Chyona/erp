import { useEffect, useState } from 'react';
import type { ColumnsType } from 'antd/es/table';
import {
  Button,
  Typography,
  Alert,
  Space,
  Tag,
  App
} from 'antd';
import AppTable from './AppTable';
import { useNavigate } from 'react-router-dom';
import { TaxExemption } from '../services/taxExemption';
import { ProfitLossClosing } from '../services/profitLossClosing';
import { INVOICE_TYPE_LABEL } from '../constants/invoice';
import { useApp } from '../context/AppContext';
import { useTabDataRefresh } from '../context/PageTabsContext';
import { confirmDanger } from '../utils/confirmAction';
import ReportPeriodFilter from './ReportPeriodFilter';
import {
  defaultTaxExemptionPeriod,
  formatStoredTaxExemptionPeriod,
  formatTaxExemptionPeriod,
  taxExemptionPeriodKey
} from '../utils/reportPeriod';

const { Text } = Typography;

function renderMoney(v) {
  if (v == null || Math.abs(v) < 0.005) return '—';
  return `¥${v.toFixed(2)}`;
}

function renderTaxAmount(v) {
  if (v == null || Math.abs(v) < 0.005) return '—';
  return <span className="tax-exemption-panel__tax-value">¥{v.toFixed(2)}</span>;
}

const amountColumns: ColumnsType<any> = [
  {
    title: '价税合计',
    dataIndex: 'grossAmount',
    width: 110,
    align: 'right',
    render: renderMoney
  },
  {
    title: '不含税金额',
    dataIndex: 'netAmount',
    width: 110,
    align: 'right',
    render: renderMoney
  },
  {
    title: '税额',
    dataIndex: 'taxAmount',
    width: 110,
    align: 'right',
    render: renderTaxAmount
  }
];

const PENDING_TAX_FIXED_COLS = {
  voucherNo: 68,
  date: 88,
  taxAmount: 72
} as const;

const summaryColumn = {
  title: '摘要',
  dataIndex: 'entrySummary',
  ellipsis: true
};

const pendingTaxDetailColumns: ColumnsType<any> = [
  {
    title: '凭证号',
    dataIndex: 'voucherNo',
    width: PENDING_TAX_FIXED_COLS.voucherNo,
    align: 'center'
  },
  { title: '日期', dataIndex: 'date', width: PENDING_TAX_FIXED_COLS.date },
  {
    title: '税额',
    dataIndex: 'taxAmount',
    width: PENDING_TAX_FIXED_COLS.taxAmount,
    align: 'right',
    render: renderTaxAmount
  },
  summaryColumn,
  { title: '备注', dataIndex: 'remark', ellipsis: true }
];

export default function TaxExemptionPanel({
  onGoProfitLossClosing
}: {
  onGoProfitLossClosing?: () => void;
}) {
  const { message, modal } = App.useApp();
  const { refreshKey, refresh } = useApp();
  const tabDataRefresh = useTabDataRefresh();
  const navigate = useNavigate();
  const [period, setPeriod] = useState(defaultTaxExemptionPeriod);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reversing, setReversing] = useState('');

  const periodLabel = formatTaxExemptionPeriod(period);
  const periodKey = taxExemptionPeriodKey(period);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const data = await TaxExemption.getPeriodSummary(period);
      setSummary(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [periodKey, period.type, refreshKey, tabDataRefresh]);

  const handleCreate = async () => {
    if (!summary?.ordinaryPending.length) {
      message.warning('该期间没有待结转的普票增值税');
      return;
    }

    const plConflict = await ProfitLossClosing.getProfitLossClosingConflictMessage({
      type: period.type as 'month' | 'quarter',
      year: period.year,
      month: period.month,
      quarter: period.quarter
    });

    const ok = await confirmDanger(modal, {
      title: '生成普票减免结转凭证',
      content: (
        <div>
          <Alert
            type="error"
            showIcon
            message="此操作将生成正式会计凭证并标记来源销售凭证为已结转，请仔细核对后再执行。"
            style={{ marginBottom: 12 }}
          />
          {plConflict ? (
            <Alert type="warning" showIcon message={plConflict} style={{ marginBottom: 12 }} />
          ) : null}
          <p>
            期间：{periodLabel}，共 <strong>{summary.ordinaryPending.length}</strong> 条税额分录
            {summary.ordinaryPendingVoucherCount
              ? `（${summary.ordinaryPendingVoucherCount} 张凭证）`
              : ''}
          </p>
          <p>
            结转税额：<strong>¥{summary.pendingTaxTotal.toFixed(2)}</strong>
          </p>
          <p style={{ marginBottom: 0, color: '#64748b', fontSize: 12 }}>
            分录：借 2221 应交税费 → 贷 5301 营业外收入。专票不参与结转。如需撤销，请使用「反结转」。
          </p>
        </div>
      ),
      okText: '确认生成并审核'
    });
    if (!ok) return;

    setSubmitting(true);
    try {
      const result = await TaxExemption.createCarryForward(period, { approve: true });
      message.success(
        `已生成 ${result.voucher.voucherNo}，结转 ¥${result.totalTax.toFixed(2)}`
      );
      refresh();
      loadSummary();
    } catch (err) {
      message.error(err.message || '生成失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReverse = async (carryForwardId) => {
    const cf =
      summary?.relatedCarryForwardVouchers?.find((v) => v.id === carryForwardId) ||
      summary?.carryForwardVoucher;
    if (!cf) {
      message.warning('该期间没有减免结转凭证');
      return;
    }

    const cfPeriodLabel = formatStoredTaxExemptionPeriod(cf) || periodLabel;

    const ok = await confirmDanger(modal, {
      title: '反结转',
      content: (
        <div>
          <Alert
            type="error"
            showIcon
            message="此操作将删除减免结转凭证，并恢复相关销售凭证为待结转状态，请确认后再执行。"
            style={{ marginBottom: 12 }}
          />
          <p>
            结转期间：{cfPeriodLabel}，结转凭证：{' '}
            <strong>{cf.voucherNo}</strong>
          </p>
          <p style={{ marginBottom: 0, color: '#64748b', fontSize: 12 }}>
            关联的销售凭证将恢复为待结转；若结转凭证已结项也会一并删除。
          </p>
        </div>
      ),
      okText: '确认反结转'
    });
    if (!ok) return;

    setReversing(carryForwardId);
    try {
      const result = await TaxExemption.reverseCarryForward(period, carryForwardId);
      message.success(
        `已反结转，删除 ${result.voucher.voucherNo}，恢复 ${result.restoredCount} 笔销售凭证`
      );
      refresh();
      loadSummary();
    } catch (err) {
      message.error(err.message || '反结转失败');
    } finally {
      setReversing('');
    }
  };

  const relatedCarryForwardVouchers = summary?.relatedCarryForwardVouchers || [];
  const hasExactCarryForward = Boolean(summary?.exactCarryForwardVoucher);

  const pendingColumns = pendingTaxDetailColumns;

  const specialColumns: ColumnsType<any> = [
    { title: '凭证号', dataIndex: 'voucherNo', width: 100 },
    { title: '日期', dataIndex: 'date', width: 110 },
    {
      title: '发票类型',
      width: 72,
      render: () => <Tag>{INVOICE_TYPE_LABEL.special}</Tag>
    },
    ...amountColumns,
    summaryColumn,
    {
      title: '说明',
      render: () => <Text type="secondary">不参与减免结转</Text>
    }
  ];

  return (
    <div className="tax-exemption-panel">
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="普票销售凭证填写增值税额后，在此汇总结转（贷 5301 营业外收入）。默认按月，与损益结转一致；若改为按季汇总，请在季度内逐月完成损益结转前先处理当月普票，或等季度末一并操作。"
      />

      <Space wrap style={{ marginBottom: 16 }} align="start">
        <ReportPeriodFilter
          value={period}
          onChange={setPeriod}
          onRefresh={loadSummary}
          loading={loading}
          typeOptions={[
            { value: 'month', label: '按月' },
            { value: 'quarter', label: '按季' }
          ]}
        />
        <Button
          type="primary"
          onClick={handleCreate}
          loading={submitting}
          disabled={
            !summary?.ordinaryPending.length || hasExactCarryForward
          }
        >
          生成减免结转凭证
        </Button>
        {relatedCarryForwardVouchers.map((cf) => (
          <Space key={cf.id} size={8}>
            <Button onClick={() => navigate(`/vouchers/${cf.id}/edit`)}>
              查看结转凭证 {cf.voucherNo}
              {formatStoredTaxExemptionPeriod(cf)
                ? `（${formatStoredTaxExemptionPeriod(cf)}）`
                : ''}
            </Button>
            {/* <Button
              danger
              loading={reversing === cf.id}
              onClick={() => handleReverse(cf.id)}
            >
              反结转
            </Button> */}
          </Space>
        ))}
      </Space>

      <div className="tax-exemption-panel__stats">
        <Text>
          待结转普票：<strong>{summary?.ordinaryPending.length || 0}</strong> 条，税额{' '}
          <span className="tax-exemption-panel__tax-total">
            ¥{(summary?.pendingTaxTotal || 0).toFixed(2)}
          </span>
        </Text>
        <Text type="secondary">
          已结转 {summary?.ordinaryDoneVoucherCount || 0} 张凭证 · 专票{' '}
          {summary?.specialInvoices.length || 0} 笔（不结转）
          {!summary?.ordinaryPending.length &&
            summary?.exactCarryForwardVoucher &&
            onGoProfitLossClosing ? (
            <>
              {' '}
              ·{' '}
              <Button
                type="link"
                size="small"
                onClick={onGoProfitLossClosing}
                style={{ padding: 0, height: 'auto' }}
              >
                下一步：损益结转
              </Button>
            </>
          ) : null}
        </Text>
      </div>

      {(summary?.restoredOrphanCount || 0) > 0 && (
        <Alert
          type="info"
          showIcon
          style={{ margin: '12px 0' }}
          message={`检测到 ${summary.restoredOrphanCount} 笔销售凭证的结转凭证已不存在，已恢复为待结转，可重新生成结转凭证`}
        />
      )}

      {(summary?.ordinaryDone.length || 0) > 0 && relatedCarryForwardVouchers.length === 0 && (
        <Alert
          type="info"
          showIcon
          style={{ margin: '12px 0' }}
          message={`该${period.type === 'quarter' ? '季度' : '月份'}范围内已有 ${summary.ordinaryDoneVoucherCount} 张普票凭证在其他期间结转，当前仅汇总未结转部分`}
        />
      )}

      {(summary?.ordinaryWithoutTax.length || 0) > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ margin: '12px 0' }}
          message={`有 ${summary.ordinaryWithoutTax.length} 笔普票销售凭证未填增值税额，无法参与结转`}
        />
      )}

      {summary?.ordinaryPending.length > 0 && (
        <>
          <Text strong style={{ display: 'block', margin: '12px 0 8px' }}>
            待结转普票明细
          </Text>
          <div className="app-table pending-tax-detail-table">
            <AppTable
              size="small"
              bordered
              rowKey="id"
              tableLayout="fixed"
              columns={pendingColumns}
              dataSource={summary.ordinaryPending}
              pagination={false}
              loading={loading}
            />
          </div>
        </>
      )}

      {summary?.specialInvoices.length > 0 && (
        <>
          <Text strong style={{ display: 'block', margin: '16px 0 8px' }}>
            专票销售（不参与结转）
          </Text>
          <div className="app-table">
            <AppTable
              size="small"
              bordered
              rowKey="id"
              columns={specialColumns}
              dataSource={summary.specialInvoices}
              pagination={false}
              loading={loading}
            />
          </div>
        </>
      )}

      {!loading &&
        !summary?.ordinaryPending.length &&
        !summary?.specialInvoices.length &&
        !summary?.carryForwardVoucher && (
          <Text type="secondary">该期间暂无已审核的销售开票凭证</Text>
        )}
    </div>
  );
}
