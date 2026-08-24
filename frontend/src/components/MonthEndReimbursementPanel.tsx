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
import { CheckCircleFilled } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { Reimbursement } from '../services/reimbursement';
import { useApp } from '../context/AppContext';
import { useTabDataRefresh } from '../context/PageTabsContext';
import { confirmDanger } from '../utils/confirmAction';
import ReportPeriodFilter from './ReportPeriodFilter';
import WorkbenchPanelIntro from './WorkbenchPanelIntro';
import VoucherDetailModal from './VoucherDetailModal';
import {
  defaultReportPeriod,
  formatTaxExemptionPeriod,
  taxExemptionPeriodKey
} from '../utils/reportPeriod';

const { Text } = Typography;

export default function MonthEndReimbursementPanel({ readOnly = false }: { readOnly?: boolean }) {
  const { message, modal } = App.useApp();
  const { refreshKey, refresh } = useApp();
  const tabDataRefresh = useTabDataRefresh();
  const navigate = useNavigate();
  const [period, setPeriod] = useState({ ...defaultReportPeriod(), type: 'month' });
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submittingPerson, setSubmittingPerson] = useState('');
  const [viewId, setViewId] = useState<string | null>(null);

  const periodLabel = formatTaxExemptionPeriod(period);
  const periodKey = taxExemptionPeriodKey(period);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const data = await Reimbursement.getPeriodSummary(period);
      setSummary(data);
    } catch (err) {
      message.error(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [periodKey, refreshKey, tabDataRefresh]);

  const handleCreate = async (person) => {
    const group = summary?.personGroups.find((g) => g.person === person);
    if (!group) return;

    const ok = await confirmDanger(modal, {
      title: `生成 ${person} 还垫付凭证？`,
      content: (
        <div>
          <Alert
            type="error"
            showIcon
            message="此操作将生成正式会计凭证，请核对垫付明细与金额后再执行。"
            style={{ marginBottom: 12 }}
          />
          <p>
            期间：{periodLabel}，垫付人：<strong>{person}</strong>
          </p>
          <p>
            归还总额：<strong>¥{group.total.toFixed(2)}</strong>（{group.advances.length} 笔垫付）
          </p>
          <p style={{ marginBottom: 0, color: '#64748b', fontSize: 12 }}>
            分录：借 2241 其他应付款（按采购/福利/其他分行）→ 贷 1002 银行存款。
          </p>
        </div>
      ),
      okText: '确认生成并审核'
    });
    if (!ok) return;

    setSubmittingPerson(person);
    try {
      const result = await Reimbursement.createReimbursementVoucher(period, person, {
        approve: true
      });
      message.success(
        `已为 ${person} 生成 ${result.voucher.voucherNo}，归还 ¥${result.total.toFixed(2)}`
      );
      refresh();
      loadSummary();
    } catch (err) {
      message.error(err.message || '生成失败');
    } finally {
      setSubmittingPerson('');
    }
  };

  const groupColumns: ColumnsType<any> = [
    { title: '垫付人', dataIndex: 'person', width: 100 },
    {
      title: '采购',
      dataIndex: ['categories', '采购'],
      width: 96,
      align: 'right',
      render: (v) => (v ? `¥${v.toFixed(2)}` : '—')
    },
    {
      title: '福利',
      dataIndex: ['categories', '福利'],
      width: 96,
      align: 'right',
      render: (v) => (v ? `¥${v.toFixed(2)}` : '—')
    },
    {
      title: '其他',
      dataIndex: ['categories', '其他'],
      width: 96,
      align: 'right',
      render: (v) => (v ? `¥${v.toFixed(2)}` : '—')
    },
    {
      title: '合计',
      dataIndex: 'total',
      width: 108,
      align: 'right',
      render: (v) => <strong>¥{(v || 0).toFixed(2)}</strong>
    },
    {
      title: '状态',
      key: 'status',
      width: 96,
      render: (_, record) =>
        record.reimbursementVoucher ? (
          <Tag color="green">已归还</Tag>
        ) : (
          <Tag color="orange">待归还</Tag>
        )
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_, record) =>
        record.reimbursementVoucher ? (
          <Button
            type="link"
            size="small"
            onClick={() => setViewId(record.reimbursementVoucher.id)}
          >
            查看 {record.reimbursementVoucher.voucherNo}
          </Button>
        ) : readOnly ? (
          <Text type="secondary">待管理员处理</Text>
        ) : (
          <Button
            type="link"
            size="small"
            loading={submittingPerson === record.person}
            onClick={() => handleCreate(record.person)}
          >
            生成还垫付凭证
          </Button>
        )
    }
  ];

  const detailColumns: ColumnsType<any> = [
    { title: '凭证号', dataIndex: 'voucherNo', width: 100 },
    { title: '日期', dataIndex: 'date', width: 110 },
    { title: '垫付人', dataIndex: 'person', width: 88 },
    {
      title: '类型',
      dataIndex: 'category',
      width: 72,
      render: (v) => <Tag>{v}</Tag>
    },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 100,
      align: 'right',
      render: (v) => `¥${(v || 0).toFixed(2)}`
    },
    { title: '摘要', dataIndex: 'summary', ellipsis: true }
  ];

  const quarterDeclared = Boolean(summary?.quarterDeclared);

  return (
    <div className="month-end-reimbursement-panel">
      <WorkbenchPanelIntro
        message={
          readOnly
            ? '查看本月垫付汇总与归还进度（只读，生成凭证请联系管理员）。'
            : '摘要末尾写（xx垫付），月底按人汇总生成还垫付凭证。'
        }
      />

      <Space wrap style={{ marginBottom: 16 }} align="start">
        <ReportPeriodFilter
          value={period}
          onChange={(next) => setPeriod({ ...next, type: 'month' })}
          onRefresh={loadSummary}
          loading={loading}
          typeOptions={[{ value: 'month', label: '按月' }]}
        />
        <Button onClick={() => navigate('/ledger')}>打开明细账</Button>
      </Space>

      {quarterDeclared && !loading ? (
        <div className="reimbursement-declared-state">
          <CheckCircleFilled className="reimbursement-declared-state__icon" aria-hidden />
          <Text strong className="reimbursement-declared-state__title">
            {summary.quarterLabel} 已申报
          </Text>
          <Text type="secondary" className="reimbursement-declared-state__desc">
            还垫付已在凭证中处理，此处不再展示垫付数据。
          </Text>
          <Space wrap className="reimbursement-declared-state__actions">
            <Button type="primary" ghost onClick={() => navigate('/vouchers')}>
              查看凭证
            </Button>
            <Button onClick={() => navigate('/ledger')}>打开明细账</Button>
          </Space>
        </div>
      ) : null}

      {!quarterDeclared ? (
        <>
          <div className="tax-exemption-panel__stats">
            <Text>
              待归还：<strong>{summary?.pendingPeople || 0}</strong> 人，合计{' '}
              <strong>¥{(summary?.pendingTotal || 0).toFixed(2)}</strong>
            </Text>
            <Text type="secondary">
              已归还 {summary?.personGroups.filter((g) => g.reimbursementVoucher).length || 0} 人 ·
              垫付明细 {summary?.advances.length || 0} 笔
            </Text>
          </div>

          {summary?.personGroups.length > 0 && (
            <>
              <Text strong style={{ display: 'block', margin: '12px 0 8px' }}>
                按垫付人汇总
              </Text>
              <div className="app-table">
                <AppTable
                  size="small"
                  bordered
                  rowKey="person"
                  columns={groupColumns}
                  dataSource={summary.personGroups}
                  pagination={false}
                  loading={loading}
                />
              </div>
            </>
          )}

          {summary?.advances.length > 0 && (
            <>
              <Text strong style={{ display: 'block', margin: '16px 0 8px' }}>
                垫付明细
              </Text>
              <div className="app-table">
                <AppTable
                  size="small"
                  bordered
                  rowKey="id"
                  columns={detailColumns}
                  dataSource={summary.advances}
                  pagination={false}
                  loading={loading}
                />
              </div>
            </>
          )}

          {!loading && !summary?.advances.length && (
            <Text type="secondary">
              {periodLabel} 暂无垫付记录。记账时摘要末尾写（xx垫付），如（thm垫付），并贷 2241。
            </Text>
          )}
        </>
      ) : null}

      <VoucherDetailModal
        voucherId={viewId}
        open={!!viewId}
        onClose={() => setViewId(null)}
        onDeleted={loadSummary}
        onLocked={loadSummary}
        onVoucherChange={setViewId}
      />
    </div>
  );
}
