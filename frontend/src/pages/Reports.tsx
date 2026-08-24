import { useEffect, useMemo, useState } from 'react';
import type { ColumnsType } from 'antd/es/table';
import {
  Button,
  Dropdown,
  Tabs,
  Table,
  Typography,
  App,
  Alert,
  Tooltip
} from 'antd';
import { DownloadOutlined, DownOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Reports as ReportsService } from '../services/reports';
import { ExportUtil } from '../services/export';
import { Voucher } from '../services/voucher';
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
import { useAuth } from '../context/AuthContext';

const { Text } = Typography;

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
  {
    highlightNegative = false,
    draftFlagKey
  }: { highlightNegative?: boolean; draftFlagKey?: string } = {}
) {
  return {
    title,
    dataIndex,
    align: 'right' as const,
    width,
    render: trialBalanceAmountCell,
    onCell: (record: Record<string, unknown>) => {
      const classes: string[] = [];
      if (highlightNegative && isNegativeAmount(record[dataIndex])) {
        classes.push('trial-balance-report__cell--negative');
      }
      if (
        draftFlagKey &&
        (record.draftFlags as Record<string, boolean> | undefined)?.[draftFlagKey]
      ) {
        classes.push('report-page__draft-amount');
      }
      return classes.length ? { className: classes.join(' ') } : {};
    }
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
      trialAmountColumn('借方', 'openingDebit', 110, {
        highlightNegative: true,
        draftFlagKey: 'openingDebit'
      }),
      trialAmountColumn('贷方', 'openingCredit', 110, {
        highlightNegative: true,
        draftFlagKey: 'openingCredit'
      })
    ]
  },
  {
    title: '本期发生额',
    children: [
      trialAmountColumn('借方', 'periodDebit', 110, { draftFlagKey: 'periodDebit' }),
      trialAmountColumn('贷方', 'periodCredit', 110, { draftFlagKey: 'periodCredit' })
    ]
  },
  {
    title: '本年累计发生额',
    children: [
      trialAmountColumn('借方', 'ytdDebit', 120, { draftFlagKey: 'ytdDebit' }),
      trialAmountColumn('贷方', 'ytdCredit', 120, { draftFlagKey: 'ytdCredit' })
    ]
  },
  {
    title: '期末余额',
    children: [
      trialAmountColumn('借方', 'endingDebit', 110, {
        highlightNegative: true,
        draftFlagKey: 'endingDebit'
      }),
      trialAmountColumn('贷方', 'endingCredit', 110, {
        highlightNegative: true,
        draftFlagKey: 'endingCredit'
      })
    ]
  }
];

function trialSummaryCell(
  index: number,
  value: unknown,
  draftFlagKey?: string,
  draftFlags?: Record<string, boolean>
) {
  const classes = [
    isNegativeAmount(value) ? 'trial-balance-report__cell--negative' : '',
    draftFlagKey && draftFlags?.[draftFlagKey] ? 'report-page__draft-amount' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Table.Summary.Cell index={index} align="right" className={classes || undefined}>
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

function TrialBalanceUnclosedTooltip({ period }) {
  const periodLabel = formatReportPeriod(period);
  const closingLabel = period.type === 'quarter' ? '季末结转' : '月末结转';

  return (
    <div className="report-trial-imbalance-tooltip__content">
      <div className="report-trial-imbalance-tooltip__title">
        {periodLabel} 尚未完成{closingLabel}
      </div>
      <p className="report-trial-imbalance-tooltip__reason">
        该期间尚未生成损益结转凭证。损益类、成本类科目期末可能仍有余额，本期经营成果尚未转入「本年利润」，报表数据不完整。
      </p>
      <div className="report-trial-imbalance-tooltip__action">
        <div className="report-trial-imbalance-tooltip__action-title">如何处理</div>
        <ol className="report-trial-imbalance-tooltip__steps">
          <li>
            前往工作台 <strong>「{closingLabel}」</strong>，完成 <strong>{periodLabel}</strong>{' '}
            损益结转
          </li>
          <li>
            若季内已做过单独月末结转，请先 <strong>反结转</strong> 后，再统一做{closingLabel}
          </li>
          <li>结转后损益科目期末余额应为零，利润体现在 3103 本年利润</li>
        </ol>
      </div>
    </div>
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
        按复式记账，科目余额表本期/本年累计借方合计应等于贷方合计。出现差额属于异常，并非未做结转所致。
      </p>
      <div className="report-trial-imbalance-tooltip__action">
        <div className="report-trial-imbalance-tooltip__action-title">如何处理</div>
        <ol className="report-trial-imbalance-tooltip__steps">
          <li>
            在<strong>凭证列表</strong>中检查是否有<strong>借贷不平衡</strong>的已审核凭证
          </li>
          <li>确认导入或手工录入的分录借方合计等于贷方合计</li>
          <li>排除草稿后重新刷新；若仍存在差额，请核对备份恢复是否完整</li>
        </ol>
      </div>
    </div>
  );
}

function resolveReportHeaderAlert(data, period) {
  if (!data) return null;

  const periodDebit = Number(data.totals?.periodDebit) || 0;
  const periodCredit = Number(data.totals?.periodCredit) || 0;
  const hasPeriodActivity = Math.abs(periodDebit) > 0.005 || Math.abs(periodCredit) > 0.005;

  if (!data.periodOccurrenceBalanced || !data.ytdOccurrenceBalanced) {
    return { kind: 'imbalance', data, period };
  }
  if (!data.periodProfitLossClosed && hasPeriodActivity) {
    return { kind: 'unclosed', data, period };
  }
  return null;
}

function TrialBalanceTab({ period, dateRange, refreshToken }) {
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

  return (
    <div className="report-tab-panel">
      <div className="trial-balance-report">
        <ScrollTable
          fillPage
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
          locale={{ emptyText: '请选择期间并查询' }}
          summary={() =>
            data?.rows?.length ? (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={3}>
                    <strong>合计</strong>
                  </Table.Summary.Cell>
                  {trialSummaryCell(3, data.totals.openingDebit, 'openingDebit', data.totalDraftFlags)}
                  {trialSummaryCell(4, data.totals.openingCredit, 'openingCredit', data.totalDraftFlags)}
                  {trialSummaryCell(5, data.totals.periodDebit, 'periodDebit', data.totalDraftFlags)}
                  {trialSummaryCell(6, data.totals.periodCredit, 'periodCredit', data.totalDraftFlags)}
                  {trialSummaryCell(7, data.totals.ytdDebit, 'ytdDebit', data.totalDraftFlags)}
                  {trialSummaryCell(8, data.totals.ytdCredit, 'ytdCredit', data.totalDraftFlags)}
                  {trialSummaryCell(9, data.totals.endingDebit, 'endingDebit', data.totalDraftFlags)}
                  {trialSummaryCell(10, data.totals.endingCredit, 'endingCredit', data.totalDraftFlags)}
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

  return (
    <div className="report-tab-panel">
      <div className={`income-statement-report${loading ? ' income-statement-report--loading' : ''}`}>
        <IncomeStatementView rows={data?.rows || []} />
      </div>
    </div>
  );
}

function BalanceSheetTab({ dateRange, refreshToken }) {
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

  const mergedRows = useMemo(
    () => mergeBalanceSheetRows(data?.assets?.rows, data?.liabilities?.rows),
    [data]
  );

  return (
    <div className="report-tab-panel">
      {data && !data.balancedApproved && (
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
  const { message } = App.useApp();
  const { can } = useAuth();
  const [period, setPeriod] = useState(defaultReportsPeriod);
  const [refreshToken, setRefreshToken] = useState(0);
  const [activeTab, setActiveTab] = useState('trial');
  const [reportHeaderAlert, setReportHeaderAlert] = useState(null);
  const [exporting, setExporting] = useState(false);
  const dateRange = useMemo(() => reportPeriodToDateRange(period), [period]);

  useEffect(() => {
    let cancelled = false;

    const loadReportAlert = async () => {
      const start = dateRange[0].format('YYYY-MM-DD');
      const end = dateRange[1].format('YYYY-MM-DD');
      try {
        const data = await ReportsService.getTrialBalance(start, end, period);
        if (!cancelled) {
          setReportHeaderAlert(resolveReportHeaderAlert(data, period));
        }
      } catch {
        if (!cancelled) setReportHeaderAlert(null);
      }
    };

    void loadReportAlert();
    return () => {
      cancelled = true;
    };
  }, [dateRange, period, refreshToken]);

  const handleExportAll = async (withAttachments = false) => {
    const start = dateRange[0].format('YYYY-MM-DD');
    const end = dateRange[1].format('YYYY-MM-DD');
    const periodLabel = formatReportPeriod(period);
    setExporting(true);
    const loadingKey = 'reports-export';
    message.loading({
      content: withAttachments ? '正在汇总表格与附件…' : '正在汇总并生成 Excel…',
      key: loadingKey,
      duration: 0
    });
    try {
      const allInPeriod = await Voucher.getAll({ startDate: start, endDate: end });
      const vouchers = allInPeriod.filter((v) => v.status !== Voucher.STATUS.DRAFT);
      const [trialBalance, incomeStatement, balanceSheet] = await Promise.all([
        ReportsService.getTrialBalance(start, end, period),
        ReportsService.getIncomeStatement(start, end),
        ReportsService.getBalanceSheet(start, end)
      ]);
      const result = await ExportUtil.exportFinancialReportsWorkbook({
        vouchers,
        trialBalance,
        incomeStatement,
        balanceSheet,
        periodLabel,
        year: period.year,
        withAttachments,
        onProgress: (done, total) => {
          if (!withAttachments || !total) return;
          message.loading({
            content: `正在下载附件 ${done}/${total}…`,
            key: loadingKey,
            duration: 0
          });
        }
      });
      if (withAttachments) {
        message.success({
          content:
            `已导出 ZIP：表格 ${result.voucherCount} 条凭证` +
            (result.attachmentCount ? `，附件 ${result.attachmentCount} 个` : '（无附件）') +
            (result.failed ? `，${result.failed} 个附件下载失败` : ''),
          key: loadingKey
        });
      } else {
        message.success({ content: '财务报表 Excel 导出成功', key: loadingKey });
      }
    } catch (err) {
      message.error({ content: (err as Error).message || '导出失败', key: loadingKey });
    } finally {
      setExporting(false);
    }
  };

  const exportMenuItems: MenuProps['items'] = [
    { key: 'excel', label: '仅导出表格（Excel）' },
    { key: 'zip', label: '导出表格及所属期间附件（ZIP）' }
  ];

  const handleExportMenuClick: MenuProps['onClick'] = ({ key }) => {
    void handleExportAll(key === 'zip');
  };

  const items = [
    {
      key: 'trial',
      label: '科目余额表',
      children: (
        <TrialBalanceTab
          period={period}
          dateRange={dateRange}
          refreshToken={refreshToken}
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
          <Text type="secondary">
            含未审核凭证预览；<span className="report-page__draft-amount">红色金额</span>
            表示含未审核贡献。导出表格与页面一致；凭证清单仍仅含已审核。
          </Text>
        </div>
        <div className="report-page-header__actions">
          {reportHeaderAlert ? (
            <Tooltip
              title={
                reportHeaderAlert.kind === 'imbalance' ? (
                  <TrialBalanceImbalanceTooltip {...reportHeaderAlert} />
                ) : (
                  <TrialBalanceUnclosedTooltip period={reportHeaderAlert.period} />
                )
              }
              placement="bottomRight"
              color="#fff"
              classNames={{ root: 'report-trial-imbalance-tooltip' }}
            >
              <span
                className="report-trial-imbalance-icon"
                role="img"
                aria-label={
                  reportHeaderAlert.kind === 'imbalance'
                    ? '发生额借贷不平衡'
                    : '尚未完成损益结转'
                }
              >
                <UnbalancedScaleIcon />
              </span>
            </Tooltip>
          ) : null}
          <ReportPeriodFilter
            value={period}
            onChange={setPeriod}
            onRefresh={() => setRefreshToken((token) => token + 1)}
            beforeRefresh={
              can('export') ? (
                <Dropdown
                  menu={{ items: exportMenuItems, onClick: handleExportMenuClick }}
                  placement="bottomRight"
                  disabled={exporting}
                >
                  <Button icon={<DownloadOutlined />} loading={exporting}>
                    导出 <DownOutlined />
                  </Button>
                </Dropdown>
              ) : null
            }
          />
        </div>
      </div>
      <Tabs
        className="report-tabs"
        destroyOnHidden
        activeKey={activeTab}
        onChange={setActiveTab}
        items={items}
      />
    </div>
  );
}
