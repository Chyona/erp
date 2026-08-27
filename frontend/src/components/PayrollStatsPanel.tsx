import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ColumnsType } from 'antd/es/table';
import { Select, Table } from 'antd';
import ScrollTable from './ScrollTable';
import ReportPeriodFilter from './ReportPeriodFilter';
import { Salary, type PayrollPeriodView, type SalaryPayrollRowCalculated } from '../services/salary';
import { useTabDataRefresh } from '../context/PageTabsContext';
import { useApp } from '../context/AppContext';
import { defaultReportPeriod, taxExemptionPeriodKey } from '../utils/reportPeriod';

type StatMetric =
  | 'preTaxSalary'
  | 'pension'
  | 'medical'
  | 'unemployment'
  | 'housingFund'
  | 'withheldTax'
  | 'netSalary';

const METRIC_OPTIONS: { value: StatMetric; label: string }[] = [
  { value: 'preTaxSalary', label: '应发工资' },
  { value: 'pension', label: '基本养老保险费' },
  { value: 'medical', label: '基本医疗保险费' },
  { value: 'unemployment', label: '失业保险费' },
  { value: 'housingFund', label: '住房公积金' },
  { value: 'withheldTax', label: '本月应缴个税' },
  { value: 'netSalary', label: '实发工资' }
];

const CHART_COLORS = [
  '#5B8FF9',
  '#5AD8A6',
  '#5D7092',
  '#F6BD16',
  '#E86452',
  '#6DC8EC',
  '#945FB9',
  '#FF9845',
  '#1E9493',
  '#FF99C3'
];

function formatPayrollStatsPeriod(period: { year: number; month?: number }) {
  return `${period.year}年${String(period.month ?? 1).padStart(2, '0')}月`;
}

function getMetricValue(row: SalaryPayrollRowCalculated, metric: StatMetric) {
  return row[metric] ?? 0;
}

function buildDonutGradient(
  rows: SalaryPayrollRowCalculated[],
  metric: StatMetric
): string | null {
  const segments = rows
    .map((row, index) => ({
      value: getMetricValue(row, metric),
      color: CHART_COLORS[index % CHART_COLORS.length]
    }))
    .filter((item) => item.value > 0);

  const total = segments.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) return null;

  let angle = 0;
  const parts = segments.map((seg) => {
    const sweep = (seg.value / total) * 360;
    const start = angle;
    angle += sweep;
    return `${seg.color} ${start}deg ${angle}deg`;
  });
  return `conic-gradient(${parts.join(', ')})`;
}

function PayrollDonutChart({
  rows,
  metric
}: {
  rows: SalaryPayrollRowCalculated[];
  metric: StatMetric;
}) {
  const gradient = useMemo(() => buildDonutGradient(rows, metric), [rows, metric]);
  const total = useMemo(
    () => rows.reduce((sum, row) => sum + getMetricValue(row, metric), 0),
    [rows, metric]
  );
  const metricLabel = METRIC_OPTIONS.find((item) => item.value === metric)?.label ?? '';

  return (
    <div className="payroll-stats-panel__chart">
      <div
        className={`payroll-stats-chart__ring${gradient ? '' : ' payroll-stats-chart__ring--empty'}`}
        style={gradient ? { background: gradient } : undefined}
      >
        <div className="payroll-stats-chart__hole">
          {total > 0 ? (
            <>
              <div className="payroll-stats-chart__total">{Salary.formatMoney(total)}</div>
              <div className="payroll-stats-chart__label">{metricLabel}</div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function PayrollStatsPanel() {
  const { refreshKey } = useApp();
  const tabDataRefresh = useTabDataRefresh();
  const [period, setPeriod] = useState({ ...defaultReportPeriod(), type: 'month' as const });
  const [metric, setMetric] = useState<StatMetric>('preTaxSalary');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PayrollPeriodView | null>(null);

  const periodKey = taxExemptionPeriodKey(period);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const next = await Salary.getPeriod(periodKey);
      setData(next);
    } finally {
      setLoading(false);
    }
  }, [periodKey]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey, tabDataRefresh]);

  const tableRows = useMemo(
    () => (data?.salaryRowsCalculated ?? []).filter((row) => row.name.trim()),
    [data]
  );

  const totals = data?.salaryTotals;

  const columns: ColumnsType<SalaryPayrollRowCalculated> = [
    {
      title: '名称',
      dataIndex: 'name',
      ellipsis: true
    },
    {
      title: '基本养老保险费',
      dataIndex: 'pension',
      align: 'right',
      render: (v) => Salary.formatMoneyDisplay(v)
    },
    {
      title: '基本医疗保险费',
      dataIndex: 'medical',
      align: 'right',
      render: (v) => Salary.formatMoneyDisplay(v)
    },
    {
      title: '失业保险费',
      dataIndex: 'unemployment',
      align: 'right',
      render: (v) => Salary.formatMoneyDisplay(v)
    },
    {
      title: '住房公积金',
      dataIndex: 'housingFund',
      align: 'right',
      render: (v) => Salary.formatMoneyDisplay(v)
    },
    {
      title: '应发工资',
      dataIndex: 'preTaxSalary',
      align: 'right',
      render: (v) => Salary.formatMoneyDisplay(v)
    },
    {
      title: '本月应缴个税',
      dataIndex: 'withheldTax',
      align: 'right',
      render: (v) => Salary.formatMoneyDisplay(v)
    },
    {
      title: '实发工资',
      dataIndex: 'netSalary',
      align: 'right',
      render: (v) => Salary.formatMoneyDisplay(v)
    }
  ];

  return (
    <div className="payroll-stats-panel">
      <div className="payroll-stats-panel__toolbar">
        <ReportPeriodFilter
          value={period}
          onChange={setPeriod}
          onRefresh={() => void loadData()}
          loading={loading}
          typeOptions={[{ value: 'month', label: '月报' }]}
          formatPeriod={formatPayrollStatsPeriod}
          beforeRefresh={
            <Select
              value={metric}
              options={METRIC_OPTIONS}
              onChange={setMetric}
              className="payroll-stats-panel__metric"
            />
          }
        />
      </div>

      <PayrollDonutChart rows={tableRows} metric={metric} />

      <div className="payroll-stats-panel__table">
        <ScrollTable
          fillPage
          autoHeight
          size="small"
          bordered
          loading={loading}
          rowKey="id"
          columns={columns}
          dataSource={tableRows}
          pagination={false}
          locale={{ emptyText: '暂无数据' }}
          summary={() =>
            tableRows.length > 0 && totals ? (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0}>合计</Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    {Salary.formatMoneyDisplay(totals.pension)}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="right">
                    {Salary.formatMoneyDisplay(totals.medical)}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right">
                    {Salary.formatMoneyDisplay(totals.unemployment)}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right">
                    {Salary.formatMoneyDisplay(totals.housingFund)}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5} align="right">
                    {Salary.formatMoneyDisplay(totals.preTaxSalary)}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={6} align="right">
                    {Salary.formatMoneyDisplay(totals.withheldTax)}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={7} align="right">
                    {Salary.formatMoneyDisplay(totals.netSalary)}
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            ) : null
          }
        />
      </div>
    </div>
  );
}
