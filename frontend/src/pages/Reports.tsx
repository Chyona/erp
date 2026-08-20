import { useEffect, useMemo, useState } from 'react';
import type { ColumnsType } from 'antd/es/table';
import {
  Button,
  Space,
  Tabs,
  Table,
  Typography,
  App,
  Alert,
  Tooltip
} from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { Reports as ReportsService } from '../services/reports';
import { ExportUtil } from '../services/export';
import ScrollTable from '../components/ScrollTable';
import BalanceSheetView from '../components/BalanceSheetView';
import IncomeStatementView from '../components/IncomeStatementView';
import ReportPeriodFilter from '../components/ReportPeriodFilter';
import {
  defaultReportsPeriod,
  formatReportPeriod,
  reportPeriodToDateRange
} from '../utils/reportPeriod';
import { mergeBalanceSheetRows } from '../utils/balanceSheetRows';

const { Title, Text } = Typography;

function isNegativeAmount(v: unknown) {
  return v != null && Number(v) < -0.005;
}

function trialBalanceAmountCell(v: unknown) {
  if (v == null || Math.abs(Number(v)) < 0.005) return '';
  return Number(v).toFixed(2);
}

function amountCell(v: unknown) {
  return trialBalanceAmountCell(v);
}

function trialAmountColumn(
  title: string,
  dataIndex: string,
  width: number,
  highlightNegative = false
) {
  return {
    title,
    dataIndex,
    align: 'right' as const,
    width,
    render: trialBalanceAmountCell,
    onCell: highlightNegative
      ? (record: Record<string, unknown>) =>
          isNegativeAmount(record[dataIndex])
            ? { className: 'trial-balance-report__cell--negative' }
            : {}
      : undefined
  };
}

const TRIAL_BALANCE_SCROLL_X = 1280;

const trialColumns: ColumnsType<any> = [
  { title: '科目编码', dataIndex: 'code', width: 96, align: 'center', fixed: 'left' },
  { title: '科目名称', dataIndex: 'name', width: 160, ellipsis: true, fixed: 'left' },
  { title: '科目大类', dataIndex: 'categoryLabel', width: 108, align: 'center' },
  {
    title: '期初余额',
    children: [
      trialAmountColumn('借方', 'openingDebit', 110, true),
      trialAmountColumn('贷方', 'openingCredit', 110, true)
    ]
  },
  {
    title: '本期发生额',
    children: [
      trialAmountColumn('借方', 'periodDebit', 110),
      trialAmountColumn('贷方', 'periodCredit', 110)
    ]
  },
  {
    title: '本年累计发生额',
    children: [
      trialAmountColumn('借方', 'ytdDebit', 120),
      trialAmountColumn('贷方', 'ytdCredit', 120)
    ]
  },
  {
    title: '期末余额',
    children: [
      trialAmountColumn('借方', 'endingDebit', 110, true),
      trialAmountColumn('贷方', 'endingCredit', 110, true)
    ]
  }
];

function trialSummaryCell(index: number, value: unknown) {
  return (
    <Table.Summary.Cell
      index={index}
      align="right"
      className={isNegativeAmount(value) ? 'trial-balance-report__cell--negative' : undefined}
    >
      <strong>{trialBalanceAmountCell(value)}</strong>
    </Table.Summary.Cell>
  );
}

function UnbalancedScaleIcon() {
  return (
    <svg
      className="report-trial-imbalance-icon__svg"
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 4v16" />
      <path d="M8 20h8" />
      <path d="M4 10l16-3" />
      <path d="M5 10v3.5" />
      <path d="M2.5 13.5h5l-1.2 2.5H3.7Z" fill="currentColor" stroke="none" />
      <path d="M19 7v2.5" />
      <path d="M16.5 9.5h5l-1.2 2.5h-2.6Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TrialBalanceImbalanceTooltip({ data, period }) {
  const periodLabel = formatReportPeriod(period);
  const details = [];

  if (!data.periodOccurrenceBalanced) {
    details.push(
      <li key="period">
        本期发生额：借方 {trialBalanceAmountCell(data.totals.periodDebit) || '0.00'}，贷方{' '}
        {trialBalanceAmountCell(data.totals.periodCredit) || '0.00'}，差额{' '}
        <strong>{Math.abs(data.periodOccurrenceDiff).toFixed(2)}</strong>
      </li>
    );
  }
  if (!data.ytdOccurrenceBalanced) {
    details.push(
      <li key="ytd">
        本年累计：借方 {trialBalanceAmountCell(data.totals.ytdDebit) || '0.00'}，贷方{' '}
        {trialBalanceAmountCell(data.totals.ytdCredit) || '0.00'}，差额{' '}
        <strong>{Math.abs(data.ytdOccurrenceDiff).toFixed(2)}</strong>
      </li>
    );
  }

  return (
    <div className="report-trial-imbalance-tooltip__content">
      <div className="report-trial-imbalance-tooltip__title">
        {periodLabel} 发生额借贷不平衡
      </div>
      {details.length ? (
        <ul className="report-trial-imbalance-tooltip__details">{details}</ul>
      ) : null}
      <p className="report-trial-imbalance-tooltip__reason">
        常见于季内部分月份已单独月末结转，或该季度尚未完成季末结转。
      </p>
      <div className="report-trial-imbalance-tooltip__action">
        <div className="report-trial-imbalance-tooltip__action-title">如何处理</div>
        <ol className="report-trial-imbalance-tooltip__steps">
          <li>
            前往工作台 <strong>「季末结转」</strong>，完成 <strong>{periodLabel}</strong>{' '}
            损益结转
          </li>
          <li>
            若季内已做过单独月末结转，请先 <strong>反结转</strong> 后，再统一做季末结转
          </li>
          <li>完成后刷新本表，发生额合计应借贷平衡</li>
        </ol>
      </div>
    </div>
  );
}

function TrialBalanceTab({ period, dateRange, refreshToken, onOccurrenceImbalanceChange }) {
  const { message } = App.useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleQuery = async () => {
    setLoading(true);
    try {
      const start = dateRange[0].format('YYYY-MM-DD');
      const end = dateRange[1].format('YYYY-MM-DD');
      const result = await ReportsService.getTrialBalance(start, end, period);
      setData(result);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleQuery();
  }, [dateRange, refreshToken]);

  useEffect(() => {
    const imbalance =
      period.type === 'quarter' &&
      data &&
      (!data.periodOccurrenceBalanced || !data.ytdOccurrenceBalanced)
        ? { data, period }
        : null;
    onOccurrenceImbalanceChange?.(imbalance);
    return () => onOccurrenceImbalanceChange?.(null);
  }, [data, period, onOccurrenceImbalanceChange]);

  const handleExport = () => {
    if (!data?.rows?.length) {
      message.error('请先查询科目余额表');
      return;
    }
    const csv = ExportUtil.trialBalanceToCSV(data);
    ExportUtil.downloadBlob(
      csv,
      `科目余额表_${data.startDate}_${data.endDate}.csv`,
      'text/csv;charset=utf-8'
    );
    message.success('导出成功');
  };

  return (
    <div className="report-tab-panel">
      <Space wrap className="report-tab-panel__toolbar">
        <Button icon={<DownloadOutlined />} onClick={handleExport}>
          导出 CSV
        </Button>
      </Space>
      <div className="trial-balance-report">
        <ScrollTable
          autoHeight
          rowKey="key"
          columns={trialColumns}
          dataSource={data?.rows || []}
          loading={loading}
          pagination={false}
          bordered
          size="small"
          tableLayout="fixed"
          scroll={{ x: TRIAL_BALANCE_SCROLL_X }}
          locale={{ emptyText: '请选择期间并查询（仅统计已审核/已锁定凭证）' }}
          summary={() =>
            data?.rows?.length ? (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={3}>
                    <strong>合计</strong>
                  </Table.Summary.Cell>
                  {trialSummaryCell(3, data.totals.openingDebit)}
                  {trialSummaryCell(4, data.totals.openingCredit)}
                  {trialSummaryCell(5, data.totals.periodDebit)}
                  {trialSummaryCell(6, data.totals.periodCredit)}
                  {trialSummaryCell(7, data.totals.ytdDebit)}
                  {trialSummaryCell(8, data.totals.ytdCredit)}
                  {trialSummaryCell(9, data.totals.endingDebit)}
                  {trialSummaryCell(10, data.totals.endingCredit)}
                </Table.Summary.Row>
              </Table.Summary>
            ) : null
          }
          footer={
            data?.rows?.length ? (
              <div className="table-scroll-footer">共 {data.rows.length} 条</div>
            ) : null
          }
        />
      </div>
    </div>
  );
}

function IncomeStatementTab({ dateRange, refreshToken }) {
  const { message } = App.useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleQuery = async () => {
    setLoading(true);
    try {
      const start = dateRange[0].format('YYYY-MM-DD');
      const end = dateRange[1].format('YYYY-MM-DD');
      const result = await ReportsService.getIncomeStatement(start, end);
      setData(result);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleQuery();
  }, [dateRange, refreshToken]);

  const handleExport = () => {
    if (!data) {
      message.error('请先查询利润表');
      return;
    }
    const csv = ExportUtil.incomeStatementToCSV(data);
    ExportUtil.downloadBlob(
      csv,
      `利润表_${data.startDate}_${data.endDate}.csv`,
      'text/csv;charset=utf-8'
    );
    message.success('导出成功');
  };

  return (
    <div className="report-tab-panel">
      <Space wrap className="report-tab-panel__toolbar">
        <Button icon={<DownloadOutlined />} onClick={handleExport}>
          导出 CSV
        </Button>
      </Space>
      <div className={`income-statement-report${loading ? ' income-statement-report--loading' : ''}`}>
        <IncomeStatementView rows={data?.rows || []} />
      </div>
    </div>
  );
}

function BalanceSheetTab({ dateRange, refreshToken }) {
  const { message } = App.useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleQuery = async () => {
    setLoading(true);
    try {
      const start = dateRange[0].format('YYYY-MM-DD');
      const end = dateRange[1].format('YYYY-MM-DD');
      const result = await ReportsService.getBalanceSheet(start, end);
      setData(result);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleQuery();
  }, [dateRange, refreshToken]);

  const handleExport = () => {
    if (!data) {
      message.error('请先查询资产负债表');
      return;
    }
    const csv = ExportUtil.balanceSheetToCSV(data);
    ExportUtil.downloadBlob(
      csv,
      `资产负债表_${data.startDate}_${data.endDate}.csv`,
      'text/csv;charset=utf-8'
    );
    message.success('导出成功');
  };

  const mergedRows = useMemo(
    () => mergeBalanceSheetRows(data?.assets?.rows, data?.liabilities?.rows),
    [data]
  );

  return (
    <div className="report-tab-panel">
      <Space wrap className="report-tab-panel__toolbar">
        <Button icon={<DownloadOutlined />} onClick={handleExport}>
          导出 CSV
        </Button>
      </Space>
      {data && !data.balanced && (
        <Alert
          type="warning"
          showIcon
          className="report-tab-panel__alert"
          message={`期末资产总计 ${amountCell(data.totalAssetsEnding) || '0.00'} 与负债和所有者权益总计 ${amountCell(data.totalLiabilitiesEquityEnding) || '0.00'} 存在差额，请核对凭证或补做结转分录。`}
        />
      )}
      {data ? (
        <div className={`balance-sheet-report${loading ? ' balance-sheet-report--loading' : ''}`}>
          <BalanceSheetView rows={mergedRows} />
        </div>
      ) : (
        <Text type="secondary">
          请选择期间并查询（期末为报告期截止日余额，年初为当年 1 月 1 日期初余额；未结转损益计入未分配利润）
        </Text>
      )}
    </div>
  );
}

export default function Reports() {
  const [period, setPeriod] = useState(defaultReportsPeriod);
  const [refreshToken, setRefreshToken] = useState(0);
  const [activeTab, setActiveTab] = useState('trial');
  const [trialImbalance, setTrialImbalance] = useState(null);
  const dateRange = useMemo(() => reportPeriodToDateRange(period), [period]);

  const items = [
    {
      key: 'trial',
      label: '科目余额表',
      children: (
        <TrialBalanceTab
          period={period}
          dateRange={dateRange}
          refreshToken={refreshToken}
          onOccurrenceImbalanceChange={setTrialImbalance}
        />
      )
    },
    {
      key: 'income',
      label: '利润表',
      children: <IncomeStatementTab dateRange={dateRange} refreshToken={refreshToken} />
    },
    {
      key: 'balance',
      label: '资产负债表',
      children: <BalanceSheetTab dateRange={dateRange} refreshToken={refreshToken} />
    }
  ];

  return (
    <div className="page-table-layout">
      <div className="report-page-header">
        <div className="report-page-header__main">
          <Title level={2} style={{ margin: 0 }}>
            财务报表
          </Title>
          <Text type="secondary">基于已审核、已锁定凭证汇总；草稿凭证不参与统计</Text>
        </div>
        <div className="report-page-header__actions">
          {activeTab === 'trial' && trialImbalance ? (
            <Tooltip
              title={<TrialBalanceImbalanceTooltip {...trialImbalance} />}
              placement="bottomRight"
              color="#fff"
              overlayClassName="report-trial-imbalance-tooltip"
            >
              <span
                className="report-trial-imbalance-icon"
                role="img"
                aria-label="发生额借贷不平衡"
              >
                <UnbalancedScaleIcon />
              </span>
            </Tooltip>
          ) : null}
          <ReportPeriodFilter
            value={period}
            onChange={setPeriod}
            onRefresh={() => setRefreshToken((token) => token + 1)}
          />
        </div>
      </div>
      <Tabs
        className="report-tabs"
        destroyInactiveTabPane
        activeKey={activeTab}
        onChange={setActiveTab}
        items={items}
      />
    </div>
  );
}
