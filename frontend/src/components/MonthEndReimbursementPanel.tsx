import { useEffect, useState } from 'react';
import type { ColumnsType } from 'antd/es/table';
import {
  Button,
  Table,
  Typography,
  Alert,
  Space,
  Tag,
  App
} from 'antd';
import { useNavigate } from 'react-router-dom';
import { Reimbursement } from '../services/reimbursement';
import { useApp } from '../context/AppContext';
import { confirmDanger } from '../utils/confirmAction';
import ReportPeriodFilter from './ReportPeriodFilter';
import {
  defaultReportPeriod,
  formatTaxExemptionPeriod,
  taxExemptionPeriodKey
} from '../utils/reportPeriod';

const { Text } = Typography;

export default function MonthEndReimbursementPanel() {
  const { message, modal } = App.useApp();
  const { refreshKey, refresh } = useApp();
  const navigate = useNavigate();
  const [period, setPeriod] = useState({ ...defaultReportPeriod(), type: 'month' });
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submittingPerson, setSubmittingPerson] = useState('');

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
  }, [periodKey, refreshKey]);

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
            分录：借 2241 其他应付款（按采购/餐饮等分行）→ 贷 1002 银行存款。
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
      title: '餐饮',
      dataIndex: ['categories', '餐饮'],
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
            onClick={() => navigate(`/vouchers/${record.reimbursementVoucher.id}/edit`)}
          >
            查看 {record.reimbursementVoucher.voucherNo}
          </Button>
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

  return (
    <div className="month-end-reimbursement-panel">
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="月底汇总个人垫付报销"
        description="发生时记借费用贷 2241（摘要含垫付人）；月底在此按人汇总，一键生成借 2241、贷银行存款的还垫付凭证。"
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
            <Table
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
            <Table
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
          {periodLabel} 暂无个人垫付记录。请先在凭证摘要中标注「（××垫付）」并记贷 2241。
        </Text>
      )}
    </div>
  );
}
