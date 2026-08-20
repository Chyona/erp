import { useEffect, useMemo, useState } from 'react';
import type { ColumnsType } from 'antd/es/table';
import { Alert, App, Button, Space, Table, Typography } from 'antd';
import {
  CheckCircleFilled,
  CloseCircleFilled,
  ExclamationCircleFilled
} from '@ant-design/icons';
import { MonthEndClosing } from '../services/monthEndClosing';
import VoucherDetailModal from './VoucherDetailModal';
import { useApp } from '../context/AppContext';
import { confirmDanger } from '../utils/confirmAction';
import ReportPeriodFilter from './ReportPeriodFilter';
import { defaultProfitLossClosingPeriod, taxExemptionPeriodKey } from '../utils/reportPeriod';

const { Text } = Typography;

const CLOSING_TYPE_OPTIONS = [{ value: 'quarter', label: '按季' }];

function renderMoney(v: number | null | undefined) {
  if (v == null || Math.abs(v) < 0.005) return '—';
  return `¥${v.toFixed(2)}`;
}

const PENDING_TAX_DETAIL_COLUMNS: ColumnsType<any> = [
  { title: '凭证号', dataIndex: 'voucherNo', width: 100, align: 'center' },
  { title: '日期', dataIndex: 'date', width: 110 },
  {
    title: '税额',
    dataIndex: 'taxAmount',
    width: 110,
    align: 'right',
    render: renderMoney
  },
  { title: '摘要', dataIndex: 'entrySummary', ellipsis: true },
  { title: '备注', dataIndex: 'remark', ellipsis: true }
];

const previewColumns: ColumnsType<any> = [
  { title: '科目编码', dataIndex: 'code', width: 96, align: 'center' },
  { title: '科目名称', dataIndex: 'name', width: 140, ellipsis: true },
  { title: '类别', dataIndex: 'categoryLabel', width: 88, align: 'center' },
  {
    title: '期末余额',
    dataIndex: 'balance',
    width: 120,
    align: 'right',
    render: renderMoney
  },
  {
    title: '结转借方',
    dataIndex: 'closingDebit',
    width: 110,
    align: 'right',
    render: renderMoney
  },
  {
    title: '结转贷方',
    dataIndex: 'closingCredit',
    width: 110,
    align: 'right',
    render: renderMoney
  }
];

export default function MonthEndClosingPanel() {
  const { message, modal } = App.useApp();
  const { refreshKey, refresh } = useApp();
  const [period, setPeriod] = useState(defaultProfitLossClosingPeriod);
  const [summary, setSummary] = useState<Awaited<
    ReturnType<typeof MonthEndClosing.getUnifiedSummary>
  > | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reversing, setReversing] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);

  const periodKey = taxExemptionPeriodKey(period);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const data = await MonthEndClosing.getUnifiedSummary(period);
      setSummary(data);
    } catch (err) {
      message.error((err as Error).message || '加载失败');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [periodKey, refreshKey]);

  const previewData = useMemo(() => {
    if (!summary?.profitLoss.accountLines) return [];
    return summary.profitLoss.accountLines.map((line) => ({
      key: line.account.id,
      code: line.account.code,
      name: line.account.name,
      categoryLabel: line.categoryLabel,
      balance: line.balance,
      closingDebit: line.closingDebit,
      closingCredit: line.closingCredit
    }));
  }, [summary]);

  const closingLabel = summary?.closingLabel || '季末结转';

  const handleCreate = async () => {
    if (!summary?.canClose) {
      message.warning(summary?.blockReason || '当前期间无法结转');
      return;
    }

    const ok = await confirmDanger(modal, {
      title: `生成${closingLabel}凭证`,
      content: (
        <div>
          <Alert
            type="error"
            showIcon
            message="将自动生成系统结转凭证（不可手动修改/删除，仅可反结转撤销）。"
            style={{ marginBottom: 12 }}
          />
          {summary.taxPendingCount > 0 ? (
            <p>
              普票减免结转：待处理 <strong>{summary.taxPendingCount}</strong> 条，税额{' '}
              <strong>¥{summary.taxPendingTotal.toFixed(2)}</strong>
            </p>
          ) : (
            <p>普票减免结转：无需处理</p>
          )}
          {summary.profitLossPendingCount > 0 ? (
            <p>
              损益结转：待结转 <strong>{summary.profitLossPendingCount}</strong> 个科目，净利润{' '}
              <strong>¥{summary.netProfit.toFixed(2)}</strong>
            </p>
          ) : (
            <p>损益结转：无需处理</p>
          )}
          <p style={{ marginBottom: 0, color: '#64748b', fontSize: 12 }}>
            执行顺序：先普票减免（贷 5301）→ 再损益结转（轧差至 3103 本年利润）。
          </p>
        </div>
      ),
      okText: '确认生成并审核'
    });
    if (!ok) return;

    setSubmitting(true);
    try {
      const result = await MonthEndClosing.createUnifiedClosing(period, { approve: true });
      const parts: string[] = [];
      if (result.taxVoucher) {
        parts.push(`普票 ${result.taxVoucher.voucherNo}（¥${result.taxTotal.toFixed(2)}）`);
      }
      if (result.profitLossVoucher) {
        parts.push(
          `损益 ${result.profitLossVoucher.voucherNo}（${result.accountCount} 科目，净利 ¥${result.netProfit.toFixed(2)}）`
        );
      }
      message.success(`${closingLabel}完成：${parts.join('；')}`);
      refresh();
      loadSummary();
    } catch (err) {
      message.error((err as Error).message || '生成失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReverse = async () => {
    if (!summary?.profitLossVoucher && !summary?.taxVoucher) {
      message.warning(`该期间没有${closingLabel}凭证`);
      return;
    }

    const ok = await confirmDanger(modal, {
      title: '反结转',
      content: (
        <div>
          <Alert
            type="warning"
            showIcon
            message="将按相反顺序撤销系统结转凭证：先损益结转，再普票减免结转。"
            style={{ marginBottom: 12 }}
          />
          <p style={{ marginBottom: 0 }}>
            期间：{summary.periodLabel}
            {summary.profitLossVoucher ? `，损益 ${summary.profitLossVoucher.voucherNo}` : ''}
            {summary.taxVoucher ? `，普票 ${summary.taxVoucher.voucherNo}` : ''}
          </p>
        </div>
      ),
      okText: '确认反结转'
    });
    if (!ok) return;

    setReversing(true);
    try {
      await MonthEndClosing.reverseUnifiedClosing(period);
      message.success('已反结转，系统结转凭证已撤销');
      refresh();
      loadSummary();
    } catch (err) {
      message.error((err as Error).message || '反结转失败');
    } finally {
      setReversing(false);
    }
  };

  const draftCount = summary?.profitLoss.draftCount || 0;
  const taxReady = (summary?.taxPendingCount || 0) === 0;
  const profitLossDone = Boolean(summary?.profitLossVoucher);
  const fullyClosed = summary?.fullyClosed;
  const generateDisabled =
    !summary?.canClose ||
    (profitLossDone && taxReady) ||
    fullyClosed;

  return (
    <div className="tax-exemption-panel">
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="一键完成当季普票减免结转与损益结转。系统自动生成的结转凭证不可手动修改或删除，仅可在此反结转撤销。"
      />

      <div className="closing-prerequisites" style={{ marginBottom: 16 }}>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>
          结转前置检查
        </Text>
        <ul className="closing-prerequisites__list">
          <li className="closing-prerequisites__item">
            {draftCount === 0 ? (
              <CheckCircleFilled className="closing-prerequisites__icon closing-prerequisites__icon--ok" />
            ) : (
              <ExclamationCircleFilled className="closing-prerequisites__icon closing-prerequisites__icon--warn" />
            )}
            <span>凭证已审核{draftCount === 0 ? '（无草稿）' : `（还有 ${draftCount} 张草稿）`}</span>
          </li>
          <li className="closing-prerequisites__item">
            {taxReady || fullyClosed ? (
              <CheckCircleFilled className="closing-prerequisites__icon closing-prerequisites__icon--ok" />
            ) : (
              <CloseCircleFilled className="closing-prerequisites__icon closing-prerequisites__icon--error" />
            )}
            <span>
              普票减免结转
              {(summary?.taxPendingCount || 0) > 0
                ? `（待结转 ${summary.taxPendingCount} 条，¥${summary.taxPendingTotal.toFixed(2)}，将随一键结转处理）`
                : summary?.taxVoucher
                  ? `（已完成 ${summary.taxVoucher.voucherNo}）`
                  : '（无待结转普票）'}
            </span>
          </li>
          <li className="closing-prerequisites__item">
            {profitLossDone ? (
              <CheckCircleFilled className="closing-prerequisites__icon closing-prerequisites__icon--ok" />
            ) : (summary?.profitLossPendingCount || 0) > 0 ? (
              <ExclamationCircleFilled className="closing-prerequisites__icon closing-prerequisites__icon--warn" />
            ) : (
              <CheckCircleFilled className="closing-prerequisites__icon closing-prerequisites__icon--ok" />
            )}
            <span>
              损益结转
              {profitLossDone
                ? `（已完成 ${summary.profitLossVoucher.voucherNo}）`
                : (summary?.profitLossPendingCount || 0) > 0
                  ? `（待结转 ${summary.profitLossPendingCount} 个科目）`
                  : '（无需处理）'}
            </span>
          </li>
        </ul>
      </div>

      <Space wrap style={{ marginBottom: 16 }} align="start">
        <ReportPeriodFilter
          value={period}
          onChange={setPeriod}
          onRefresh={loadSummary}
          loading={loading}
          typeOptions={CLOSING_TYPE_OPTIONS}
        />
        <Button
          type="primary"
          onClick={handleCreate}
          loading={submitting}
          disabled={generateDisabled}
        >
          生成{closingLabel}凭证
        </Button>
        {(summary?.profitLossVoucher || summary?.taxVoucher) && (
          <Button danger loading={reversing} onClick={handleReverse}>
            反结转
          </Button>
        )}
        {summary?.taxVoucher ? (
          <Button onClick={() => setViewId(summary.taxVoucher!.id)}>
            查看普票凭证 {summary.taxVoucher.voucherNo}
          </Button>
        ) : null}
        {summary?.profitLossVoucher ? (
          <Button onClick={() => setViewId(summary.profitLossVoucher!.id)}>
            查看损益凭证 {summary.profitLossVoucher.voucherNo}
          </Button>
        ) : null}
      </Space>

      <div className="tax-exemption-panel__stats">
        <Text>
          待结转普票：<strong>{fullyClosed ? 0 : summary?.taxPendingCount || 0}</strong> 条
          {!fullyClosed && (summary?.taxPendingCount || 0) > 0 ? (
            <>
              ，税额{' '}
              <span className="tax-exemption-panel__tax-total">
                ¥{(summary?.taxPendingTotal || 0).toFixed(2)}
              </span>
            </>
          ) : null}
          {' · '}
          待结转科目：<strong>{fullyClosed ? 0 : summary?.profitLossPendingCount || 0}</strong> 个
          {!fullyClosed && (summary?.profitLossPendingCount || 0) > 0 ? (
            <>
              ，净利润{' '}
              <span className="tax-exemption-panel__tax-total">
                ¥{(summary?.netProfit || 0).toFixed(2)}
              </span>
            </>
          ) : null}
        </Text>
        <Text type="secondary">{fullyClosed ? `已完成${closingLabel}` : `未完成${closingLabel}`}</Text>
      </div>

      {(summary?.taxExemptionWarnings || []).map((warning) => (
        <Alert key={warning} type="warning" showIcon style={{ margin: '12px 0' }} message={warning} />
      ))}

      {summary?.staleAfterProfitLoss ? (
        <Alert type="error" showIcon style={{ margin: '12px 0' }} message={summary.blockReason} />
      ) : null}

      {summary && fullyClosed ? (
        <Alert type="success" showIcon style={{ margin: '12px 0' }} message={summary.blockReason} />
      ) : null}

      {summary && !summary.canClose && !fullyClosed && !summary.staleAfterProfitLoss ? (
        <Alert type="warning" showIcon style={{ margin: '12px 0' }} message={summary.blockReason} />
      ) : null}

      {(summary?.taxPendingCount || 0) > 0 && !fullyClosed ? (
        <>
          <Text strong style={{ display: 'block', margin: '12px 0 8px' }}>
            待结转普票明细
          </Text>
          <div className="app-table pending-tax-detail-table" style={{ marginBottom: 16 }}>
            <Table
              size="small"
              bordered
              loading={loading}
              rowKey="id"
              tableLayout="fixed"
              columns={PENDING_TAX_DETAIL_COLUMNS}
              dataSource={summary?.tax.ordinaryPending || []}
              pagination={false}
            />
          </div>
        </>
      ) : null}

      {previewData.length > 0 && !fullyClosed ? (
        <>
          <Text strong style={{ display: 'block', margin: '12px 0 8px' }}>
            待结转科目明细
          </Text>
          {summary?.profitLoss?.includesProjectedTaxExemption ? (
            <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
              已预估本次普票减免将计入 5301 营业外收入的金额；仅列示截至当月末仍有余额的损益/成本类科目。
            </Text>
          ) : (
            <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
              仅列示截至当月末仍有余额的损益/成本类科目（已结平至零的科目不会出现）。
            </Text>
          )}
          <div className="app-table">
            <Table
              size="small"
              bordered
              loading={loading}
              columns={previewColumns}
              dataSource={previewData}
              pagination={false}
              scroll={{ x: 720 }}
            />
          </div>
        </>
      ) : null}

      {!loading && fullyClosed && (
        <Text type="secondary" style={{ display: 'block', marginTop: 12 }}>
          该期间{closingLabel}已完成，如需调整请使用「反结转」。
        </Text>
      )}

      <VoucherDetailModal
        voucherId={viewId}
        open={!!viewId}
        onClose={() => setViewId(null)}
        onLocked={loadSummary}
        onDeleted={loadSummary}
      />
    </div>
  );
}
