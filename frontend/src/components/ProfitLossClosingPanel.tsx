import { useEffect, useMemo, useState } from 'react';
import type { ColumnsType } from 'antd/es/table';
import { Alert, App, Button, Space, Typography } from 'antd';
import AppTable from './AppTable';
import {
  CheckCircleFilled,
  CloseCircleFilled,
  ExclamationCircleFilled
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { ProfitLossClosing } from '../services/profitLossClosing';
import { useApp } from '../context/AppContext';
import { useTabDataRefresh } from '../context/PageTabsContext';
import { confirmDanger } from '../utils/confirmAction';
import ReportPeriodFilter from './ReportPeriodFilter';
import {
  defaultProfitLossClosingPeriod,
  formatStoredProfitLossClosingPeriod,
  taxExemptionPeriodKey
} from '../utils/reportPeriod';

const { Text } = Typography;

const MONTH_TYPE_OPTIONS = [{ value: 'month', label: '按月' }];

function renderMoney(v: number | null | undefined) {
  if (v == null || Math.abs(v) < 0.005) return '—';
  return `¥${v.toFixed(2)}`;
}

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

export default function ProfitLossClosingPanel({
  onGoTaxExemption
}: {
  onGoTaxExemption?: () => void;
}) {
  const { message, modal } = App.useApp();
  const { refreshKey, refresh } = useApp();
  const tabDataRefresh = useTabDataRefresh();
  const navigate = useNavigate();
  const [period, setPeriod] = useState(defaultProfitLossClosingPeriod);
  const [summary, setSummary] = useState<Awaited<
    ReturnType<typeof ProfitLossClosing.getPeriodSummary>
  > | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reversing, setReversing] = useState(false);

  const periodKey = taxExemptionPeriodKey(period);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const data = await ProfitLossClosing.getPeriodSummary(period);
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
  }, [periodKey, refreshKey, tabDataRefresh]);

  const previewData = useMemo(() => {
    if (!summary?.accountLines) return [];
    return summary.accountLines.map((line) => ({
      key: line.account.id,
      code: line.account.code,
      name: line.account.name,
      categoryLabel: line.categoryLabel,
      balance: line.balance,
      closingDebit: line.closingDebit,
      closingCredit: line.closingCredit
    }));
  }, [summary]);

  const handleCreate = async () => {
    if (!summary?.canClose) {
      message.warning(summary?.blockReason || '当前期间无法结转');
      return;
    }

    const ok = await confirmDanger(modal, {
      title: '生成结转损益凭证',
      content: (
        <div>
          <Alert
            type="error"
            showIcon
            message="此操作将生成正式会计凭证，结转损益类科目期末余额至本年利润，请仔细核对后再执行。"
            style={{ marginBottom: 12 }}
          />
          <p>
            期间：{summary.periodLabel}，共 <strong>{summary.accountLines.length}</strong> 个科目
          </p>
          <p>
            结转净利润（轧差）：<strong>¥{summary.netProfit.toFixed(2)}</strong>
          </p>
          <p style={{ marginBottom: 0, color: '#64748b', fontSize: 12 }}>
            收入类科目借方结转，成本费用类科目贷方结转，差额记入 3103 本年利润。如需撤销，请使用「反结转」。
          </p>
        </div>
      ),
      okText: '确认生成并审核'
    });
    if (!ok) return;

    setSubmitting(true);
    try {
      const result = await ProfitLossClosing.createClosing(period, { approve: true });
      message.success(
        `已生成 ${result.voucher.voucherNo}，结转 ${result.accountCount} 个科目，净利 ¥${result.netProfit.toFixed(2)}`
      );
      refresh();
      loadSummary();
    } catch (err) {
      message.error((err as Error).message || '生成失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReverse = async () => {
    const cf = summary?.closingVoucher;
    if (!cf) {
      message.warning('该期间没有损益结转凭证');
      return;
    }

    const cfPeriodLabel = formatStoredProfitLossClosingPeriod(cf) || summary?.periodLabel;
    const ok = await confirmDanger(modal, {
      title: '反结转',
      content: (
        <div>
          <Alert
            type="warning"
            showIcon
            message="此操作将删除损益结转凭证，损益类科目将恢复为未结转状态。"
            style={{ marginBottom: 12 }}
          />
          <p style={{ marginBottom: 0 }}>
            结转期间：{cfPeriodLabel}，结转凭证：{cf.voucherNo}
          </p>
        </div>
      ),
      okText: '确认反结转'
    });
    if (!ok) return;

    setReversing(true);
    try {
      const result = await ProfitLossClosing.reverseClosing(period, cf.id);
      message.success(`已反结转，删除 ${result.voucher.voucherNo}`);
      refresh();
      loadSummary();
    } catch (err) {
      message.error((err as Error).message || '反结转失败');
    } finally {
      setReversing(false);
    }
  };

  const closingVoucher = summary?.closingVoucher;
  const hasClosingVoucher = Boolean(closingVoucher);

  return (
    <div className="tax-exemption-panel">
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="请按顺序操作：① 审核凭证 → ② 普票结转（影响 5301 营业外收入）→ ③ 损益结转。未完成普票结转时无法生成损益结转凭证。"
      />

      <div className="closing-prerequisites" style={{ marginBottom: 16 }}>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>
          结转前置检查
        </Text>
        <ul className="closing-prerequisites__list">
          <li className="closing-prerequisites__item">
            {(summary?.draftCount || 0) === 0 ? (
              <CheckCircleFilled className="closing-prerequisites__icon closing-prerequisites__icon--ok" />
            ) : (
              <ExclamationCircleFilled className="closing-prerequisites__icon closing-prerequisites__icon--warn" />
            )}
            <span>
              凭证已审核
              {(summary?.draftCount || 0) > 0
                ? `（还有 ${summary.draftCount} 张草稿）`
                : '（无草稿）'}
            </span>
          </li>
          <li className="closing-prerequisites__item">
            {summary?.taxExemption?.isReady !== false ? (
              <CheckCircleFilled className="closing-prerequisites__icon closing-prerequisites__icon--ok" />
            ) : (
              <CloseCircleFilled className="closing-prerequisites__icon closing-prerequisites__icon--error" />
            )}
            <span>
              普票减免结转
              {summary?.taxExemption?.isReady === false ? (
                <>
                  {' '}
                  （待结转 {summary.taxExemption.pendingCount} 笔，税额 ¥
                  {summary.taxExemption.pendingTaxTotal.toFixed(2)}）
                  {onGoTaxExemption ? (
                    <Button type="link" size="small" onClick={onGoTaxExemption} style={{ padding: 0, height: 'auto' }}>
                      去普票结转
                    </Button>
                  ) : null}
                </>
              ) : summary?.taxExemption?.carryForwardVoucherNo ? (
                `（已完成 ${summary.taxExemption.carryForwardVoucherNo}）`
              ) : summary?.taxExemption?.carryForwardDoneCount ? (
                `（${summary.taxExemption.carryForwardDoneCount} 笔已结转）`
              ) : (
                '（无待结转普票）'
              )}
            </span>
          </li>
          <li className="closing-prerequisites__item">
            {closingVoucher ? (
              <CheckCircleFilled className="closing-prerequisites__icon closing-prerequisites__icon--ok" />
            ) : (
              <ExclamationCircleFilled className="closing-prerequisites__icon closing-prerequisites__icon--warn" />
            )}
            <span>
              损益结转{closingVoucher ? `（已完成 ${closingVoucher.voucherNo}）` : '（待执行）'}
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
          typeOptions={MONTH_TYPE_OPTIONS}
        />
        <Button
          type="primary"
          onClick={handleCreate}
          loading={submitting}
          disabled={!summary?.canClose || hasClosingVoucher}
        >
          生成结转损益凭证
        </Button>
        {closingVoucher ? (
          <Space size={8}>
            <Button onClick={() => navigate(`/vouchers/${closingVoucher.id}/edit`)}>
              查看结转凭证 {closingVoucher.voucherNo}
              {formatStoredProfitLossClosingPeriod(closingVoucher)
                ? `（${formatStoredProfitLossClosingPeriod(closingVoucher)}）`
                : ''}
            </Button>
            {/* <Button danger loading={reversing} onClick={handleReverse}>
              反结转
            </Button> */}
          </Space>
        ) : null}
      </Space>

      <div className="tax-exemption-panel__stats">
        <Text>
          待结转科目：<strong>{summary?.accountLines.length || 0}</strong> 个，结转净利润{' '}
          <span className="tax-exemption-panel__tax-total">
            ¥{(summary?.netProfit || 0).toFixed(2)}
          </span>
        </Text>
        <Text type="secondary">
          {closingVoucher ? `已结转 ${closingVoucher.voucherNo}` : '未结转'}
        </Text>
      </div>

      {(summary?.taxExemption?.warnings || []).map((warning) => (
        <Alert
          key={warning}
          type="warning"
          showIcon
          style={{ margin: '12px 0' }}
          message={warning}
        />
      ))}

      {summary?.staleAfterTaxExemption ? (
        <Alert
          type="error"
          showIcon
          style={{ margin: '12px 0' }}
          message={summary.staleAfterTaxExemption}
        />
      ) : null}

      {summary && !summary.canClose && !closingVoucher ? (
        <Alert
          type="warning"
          showIcon
          style={{ margin: '12px 0' }}
          message={summary.blockReason}
        />
      ) : null}

      {previewData.length > 0 && (
        <>
          <Text strong style={{ display: 'block', margin: '12px 0 8px' }}>
            待结转科目明细
          </Text>
          <div className="app-table">
            <AppTable
              size="small"
              bordered
              loading={loading}
              columns={previewColumns}
              dataSource={previewData}
              pagination={false}
              scroll={{ x: 720 }}
              locale={{ emptyText: '该期间损益类科目无余额' }}
            />
          </div>
        </>
      )}

      {!loading && !previewData.length && !closingVoucher && (
        <Text type="secondary">该期间损益类科目无余额，无需结转</Text>
      )}
    </div>
  );
}
