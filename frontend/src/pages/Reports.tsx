import { useEffect, useMemo, useState } from 'react';
import type { ColumnsType } from 'antd/es/table';
import {
  Button,
  Space,
  Tabs,
  Table,
  Typography,
  App,
  Alert
} from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { Reports as ReportsService } from '../services/reports';
import { ExportUtil } from '../services/export';
import ScrollTable from '../components/ScrollTable';
import BalanceSheetView from '../components/BalanceSheetView';
import IncomeStatementView from '../components/IncomeStatementView';
import ReportPeriodFilter from '../components/ReportPeriodFilter';
import {
  defaultReportPeriod,
  reportPeriodToDateRange
} from '../utils/reportPeriod';
import { mergeBalanceSheetRows } from '../utils/balanceSheetRows';

const { Title, Text } = Typography;

function amountCell(v) {
  if (v == null || Math.abs(Number(v)) < 0.005) return '';
  return Number(v).toFixed(2);
}

const TRIAL_BALANCE_SCROLL_X = 1280;

const trialColumns: ColumnsType<any> = [
  { title: '科目编码', dataIndex: 'code', width: 96, align: 'center', fixed: 'left' },
  { title: '科目名称', dataIndex: 'name', width: 160, ellipsis: true, fixed: 'left' },
  { title: '科目大类', dataIndex: 'categoryLabel', width: 108, align: 'center' },
  {
    title: '期初余额',
    children: [
      {
        title: '借方',
        dataIndex: 'openingDebit',
        align: 'right',
        width: 110,
        render: amountCell
      },
      {
        title: '贷方',
        dataIndex: 'openingCredit',
        align: 'right',
        width: 110,
        render: amountCell
      }
    ]
  },
  {
    title: '本期发生额',
    children: [
      {
        title: '借方',
        dataIndex: 'periodDebit',
        align: 'right',
        width: 110,
        render: amountCell
      },
      {
        title: '贷方',
        dataIndex: 'periodCredit',
        align: 'right',
        width: 110,
        render: amountCell
      }
    ]
  },
  {
    title: '本年累计发生额',
    children: [
      {
        title: '借方',
        dataIndex: 'ytdDebit',
        align: 'right',
        width: 120,
        render: amountCell
      },
      {
        title: '贷方',
        dataIndex: 'ytdCredit',
        align: 'right',
        width: 120,
        render: amountCell
      }
    ]
  },
  {
    title: '期末余额',
    children: [
      {
        title: '借方',
        dataIndex: 'endingDebit',
        align: 'right',
        width: 110,
        render: amountCell
      },
      {
        title: '贷方',
        dataIndex: 'endingCredit',
        align: 'right',
        width: 110,
        render: amountCell
      }
    ]
  }
];

function TrialBalanceTab({ dateRange, refreshToken }) {
  const { message } = App.useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleQuery = async () => {
    setLoading(true);
    try {
      const start = dateRange[0].format('YYYY-MM-DD');
      const end = dateRange[1].format('YYYY-MM-DD');
      const result = await ReportsService.getTrialBalance(start, end);
      setData(result);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleQuery();
  }, [dateRange, refreshToken]);

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
                  <Table.Summary.Cell index={3} align="right">
                    <strong>{amountCell(data.totals.openingDebit)}</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right">
                    <strong>{amountCell(data.totals.openingCredit)}</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5} align="right">
                    <strong>{amountCell(data.totals.periodDebit)}</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={6} align="right">
                    <strong>{amountCell(data.totals.periodCredit)}</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={7} align="right">
                    <strong>{amountCell(data.totals.ytdDebit)}</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={8} align="right">
                    <strong>{amountCell(data.totals.ytdCredit)}</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={9} align="right">
                    <strong>{amountCell(data.totals.endingDebit)}</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={10} align="right">
                    <strong>{amountCell(data.totals.endingCredit)}</strong>
                  </Table.Summary.Cell>
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
  const [period, setPeriod] = useState(defaultReportPeriod);
  const [refreshToken, setRefreshToken] = useState(0);
  const dateRange = useMemo(() => reportPeriodToDateRange(period), [period]);

  const items = [
    {
      key: 'trial',
      label: '科目余额表',
      children: <TrialBalanceTab dateRange={dateRange} refreshToken={refreshToken} />
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
        <ReportPeriodFilter
          value={period}
          onChange={setPeriod}
          onRefresh={() => setRefreshToken((token) => token + 1)}
        />
      </div>
      <Tabs className="report-tabs" destroyInactiveTabPane items={items} />
    </div>
  );
}
