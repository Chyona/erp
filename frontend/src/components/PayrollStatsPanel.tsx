import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ColumnsType } from 'antd/es/table';
import { App, Button, DatePicker, InputNumber, Space, Table, Tabs } from 'antd';
import { LinkOutlined, ReloadOutlined } from '@ant-design/icons';
import { type Dayjs } from 'dayjs';
import ScrollTable from './ScrollTable';
import PayrollVoucherPickerModal from './PayrollVoucherPickerModal';
import PayrollVoucherLinkRow from './PayrollVoucherLinkRow';
import {
  Salary,
  calcEmployerCostSummary,
  type EmployerCostMonthlyRow,
  type EmployerCostRangeResult,
  type EmployerCostSummary,
  type LaborLedgerRowCalculated,
  type PayrollEmployerCosts,
  type PayrollPeriodView,
  type PayrollVoucherLinkType,
  type PayrollVoucherLinkView,
  type SalaryPayrollRowCalculated
} from '../services/salary';
import { useTabDataRefresh } from '../context/PageTabsContext';
import { useApp } from '../context/AppContext';
import { useVoucherPageNavigation } from '../hooks/useVoucherPageNavigation';
import { clampMonthRangeToToday, disableFutureMonth } from '../utils/dateConstraints';
import { defaultPayrollMonthRange, taxExemptionPeriodKey } from '../utils/reportPeriod';
import { TaxDeclaration } from '../services/taxDeclaration';

const COST_ITEMS: {
  key: keyof Pick<
    EmployerCostSummary,
    'salaryGross' | 'laborGross' | 'companySocialSecurity' | 'companyHousingFund'
  >;
  label: string;
  color: string;
  headcount?: 'salaryHeadcount' | 'laborHeadcount';
}[] = [
    { key: 'salaryGross', label: '职工应发', color: '#5B8FF9', headcount: 'salaryHeadcount' },
    { key: 'laborGross', label: '劳务应发', color: '#5AD8A6', headcount: 'laborHeadcount' },
    { key: 'companySocialSecurity', label: '公司社保', color: '#F6BD16' },
    { key: 'companyHousingFund', label: '公司公积金', color: '#E86452' }
  ];

type SalaryRowWithPeriod = SalaryPayrollRowCalculated & {
  periodKey: string;
  periodLabel: string;
};

type LaborRowWithPeriod = LaborLedgerRowCalculated & {
  periodKey: string;
  periodLabel: string;
};

function monthKey(value: Dayjs) {
  return taxExemptionPeriodKey({ type: 'month', year: value.year(), month: value.month() + 1 });
}

function formatRangeLabel(startKey: string, endKey: string) {
  if (startKey === endKey) return Salary.formatPeriodLabel(startKey);
  return `${Salary.formatPeriodLabel(startKey)} ~ ${Salary.formatPeriodLabel(endKey)}`;
}

function CostBreakdown({
  summary,
  rangeLabel,
  hideHeadcount
}: {
  summary: EmployerCostSummary;
  rangeLabel?: string;
  hideHeadcount?: boolean;
}) {
  const segments = COST_ITEMS.map((item) => ({
    ...item,
    value: summary[item.key]
  })).filter((item) => item.value > 0);

  return (
    <div className="payroll-cost-breakdown">
      <div className="payroll-cost-breakdown__hero">
        <div className="payroll-cost-breakdown__label">人力成本合计</div>
        <div className="payroll-cost-breakdown__total">{Salary.formatMoneyDisplay(summary.totalCost)}</div>
        {rangeLabel ? (
          <div className="payroll-cost-breakdown__period">{rangeLabel}</div>
        ) : null}
        <div className="payroll-cost-breakdown__formula">
          职工应发 + 劳务应发 + 公司社保 + 公司公积金
        </div>
      </div>

      {summary.totalCost > 0 ? (
        <div className="payroll-cost-breakdown__bar" aria-hidden="true">
          {segments.map((item) => (
            <div
              key={item.key}
              className="payroll-cost-breakdown__bar-segment"
              style={{
                flexGrow: item.value,
                background: item.color
              }}
            />
          ))}
        </div>
      ) : null}

      <div className="payroll-cost-breakdown__list">
        {COST_ITEMS.map((item) => (
          <div key={item.key} className="payroll-cost-breakdown__item">
            <span className="payroll-cost-breakdown__dot" style={{ background: item.color }} />
            <span className="payroll-cost-breakdown__name">{item.label}</span>
            <span className="payroll-cost-breakdown__amount">{Salary.formatMoneyDisplay(summary[item.key])}</span>
            {!hideHeadcount && item.headcount != null ? (
              <span className="payroll-cost-breakdown__meta">{summary[item.headcount]} 人</span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthlyCostTable({ rows, loading }: { rows: EmployerCostMonthlyRow[]; loading: boolean }) {
  const columns: ColumnsType<EmployerCostMonthlyRow> = [
    { title: '月份', dataIndex: 'periodLabel', width: 120 },
    {
      title: '职工应发',
      dataIndex: 'salaryGross',
      align: 'right',
      render: (v) => Salary.formatMoneyDisplay(v)
    },
    {
      title: '劳务应发',
      dataIndex: 'laborGross',
      align: 'right',
      render: (v) => Salary.formatMoneyDisplay(v)
    },
    {
      title: '公司社保',
      dataIndex: 'companySocialSecurity',
      align: 'right',
      render: (v) => Salary.formatMoneyDisplay(v)
    },
    {
      title: '公司公积金',
      dataIndex: 'companyHousingFund',
      align: 'right',
      render: (v) => Salary.formatMoneyDisplay(v)
    },
    {
      title: '人力成本',
      dataIndex: 'totalCost',
      align: 'right',
      render: (v) => Salary.formatMoneyDisplay(v)
    },
    {
      title: '职工人数',
      dataIndex: 'salaryHeadcount',
      align: 'right',
      width: 88
    },
    {
      title: '劳务人数',
      dataIndex: 'laborHeadcount',
      align: 'right',
      width: 88
    }
  ];

  return (
    <div className="payroll-cost-monthly-panel">
      <ScrollTable
        size="small"
        bordered
        loading={loading}
        rowKey="periodKey"
        columns={columns}
        dataSource={rows}
        pagination={false}
        locale={{ emptyText: '所选范围内暂无工资表数据' }}
      />
    </div>
  );
}

function EmployerCostTable({
  draftCosts,
  socialSecurityLinks,
  housingFundLinks,
  saving,
  costsDirty,
  readOnly = false,
  onAmountChange,
  onLink,
  onRemoveLink,
  onOpenVoucher,
  onSave
}: {
  draftCosts: PayrollEmployerCosts;
  socialSecurityLinks: PayrollVoucherLinkView[];
  housingFundLinks: PayrollVoucherLinkView[];
  saving: boolean;
  costsDirty: boolean;
  readOnly?: boolean;
  onAmountChange: (field: keyof PayrollEmployerCosts, value: number) => void;
  onLink: (type: 'socialSecurity' | 'housingFund') => void;
  onRemoveLink: (linkId: string) => void;
  onOpenVoucher: (voucherId: string) => void;
  onSave: () => void;
}) {
  const rows: {
    key: keyof PayrollEmployerCosts;
    label: string;
    linkType: 'socialSecurity' | 'housingFund';
    links: PayrollVoucherLinkView[];
  }[] = [
      {
        key: 'socialSecurity',
        label: '社保费',
        linkType: 'socialSecurity',
        links: socialSecurityLinks
      },
      {
        key: 'housingFund',
        label: '公积金',
        linkType: 'housingFund',
        links: housingFundLinks
      }
    ];

  return (
    <div className={`payroll-cost-employer-panel${readOnly ? ' payroll-cost-employer-panel--readonly' : ''}`}>
      <div className="payroll-cost-employer-panel__header">
        <div className="payroll-cost-employer-panel__title">公司缴纳（单位部分）</div>
        {!readOnly ? (
          <Button type="primary" size="small" loading={saving} disabled={!costsDirty} onClick={onSave}>
            保存手动调整
          </Button>
        ) : null}
      </div>

      <div className="payroll-cost-employer-table">
        <div className="payroll-cost-employer-table__head">
          <span>项目</span>
          <span>金额</span>
          <span>关联凭证</span>
        </div>
        {rows.map((row) => (
          <div key={row.key} className="payroll-cost-employer-table__row">
            <span className="payroll-cost-employer-table__label">{row.label}</span>
            <InputNumber
              min={0}
              precision={2}
              controls={false}
              disabled={readOnly}
              className="payroll-cost-employer-table__amount"
              value={draftCosts[row.key] || undefined}
              onChange={(value) => onAmountChange(row.key, Number(value) || 0)}
            />
            <div className="payroll-cost-employer-table__vouchers">
              {row.links.map((link) => (
                <PayrollVoucherLinkRow
                  key={link.id}
                  link={link}
                  showTag={false}
                  readOnly={readOnly}
                  onOpen={onOpenVoucher}
                  onRemove={onRemoveLink}
                />
              ))}
              {!readOnly ? (
                <Button size="small" icon={<LinkOutlined />} onClick={() => onLink(row.linkType)}>
                  关联凭证
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="payroll-cost-employer-panel__hint">
        {readOnly
          ? '该月份所属季度已申报，公司缴纳数据不可修改。'
          : '关联社保/公积金扣款凭证后自动读取单位部分金额；可手动修改后保存。'}
      </div>
    </div>
  );
}

export default function PayrollStatsPanel() {
  const { message } = App.useApp();
  const { refreshKey, refresh } = useApp();
  const tabDataRefresh = useTabDataRefresh();
  const { openVoucherEdit } = useVoucherPageNavigation();
  const [range, setRange] = useState<[Dayjs, Dayjs]>(() => defaultPayrollMonthRange());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  const [linkModalType, setLinkModalType] = useState<'socialSecurity' | 'housingFund' | null>(null);
  const [data, setData] = useState<PayrollPeriodView | null>(null);
  const [rangeData, setRangeData] = useState<EmployerCostRangeResult | null>(null);
  const [draftCosts, setDraftCosts] = useState<PayrollEmployerCosts>({
    socialSecurity: 0,
    housingFund: 0
  });
  const [employerCostsReadOnly, setEmployerCostsReadOnly] = useState(false);

  const startKey = monthKey(range[0]);
  const endKey = monthKey(range[1]);
  const isSingleMonth = startKey === endKey;
  const periodKey = startKey;
  const periodLabel = Salary.formatPeriodLabel(periodKey);
  const rangeLabel = formatRangeLabel(startKey, endKey);

  const applyPeriodData = useCallback((next: PayrollPeriodView) => {
    setData(next);
    setRangeData(null);
    setDraftCosts({
      socialSecurity: next.employerCosts?.socialSecurity ?? 0,
      housingFund: next.employerCosts?.housingFund ?? 0
    });
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (isSingleMonth) {
        const declared = await TaxDeclaration.isPayrollPeriodDeclared(periodKey);
        setEmployerCostsReadOnly(declared);

        let next = await Salary.getPeriod(periodKey);
        const hasEmployerLinks = next.voucherLinks.some(
          (link) => link.linkType === 'socialSecurity' || link.linkType === 'housingFund'
        );
        if (!declared && hasEmployerLinks) {
          const suggested = await Salary.suggestEmployerCosts(periodKey);
          const savedEmpty =
            !(next.employerCosts?.socialSecurity ?? 0) && !(next.employerCosts?.housingFund ?? 0);
          if (savedEmpty && (suggested.socialSecurity > 0 || suggested.housingFund > 0)) {
            next = await Salary.syncEmployerCostsFromVouchers(periodKey);
          }
        }
        applyPeriodData(next);
      } else {
        setEmployerCostsReadOnly(false);
        const nextRange = await Salary.getEmployerCostRange(startKey, endKey);
        setRangeData(nextRange);
        setData(null);
        setDraftCosts({ socialSecurity: 0, housingFund: 0 });
      }
    } finally {
      setLoading(false);
    }
  }, [applyPeriodData, endKey, isSingleMonth, periodKey, startKey]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey, tabDataRefresh]);

  const summary = useMemo(() => {
    if (isSingleMonth && data) {
      return calcEmployerCostSummary({
        ...data,
        employerCosts: employerCostsReadOnly ? data.employerCosts : draftCosts
      });
    }
    return rangeData?.summary ?? null;
  }, [data, draftCosts, employerCostsReadOnly, isSingleMonth, rangeData]);

  const salaryRows = useMemo((): SalaryRowWithPeriod[] | SalaryPayrollRowCalculated[] => {
    if (isSingleMonth) {
      return (data?.salaryRowsCalculated ?? []).filter((row) => row.name.trim());
    }
    return (rangeData?.periods ?? []).flatMap((period) =>
      period.salaryRowsCalculated
        .filter((row) => row.name.trim())
        .map((row) => ({
          ...row,
          periodKey: period.periodKey,
          periodLabel: Salary.formatPeriodLabel(period.periodKey)
        }))
    );
  }, [data, isSingleMonth, rangeData]);

  const laborRows = useMemo((): LaborRowWithPeriod[] | LaborLedgerRowCalculated[] => {
    if (isSingleMonth) {
      return (data?.laborRowsCalculated ?? []).filter((row) => row.name.trim());
    }
    return (rangeData?.periods ?? []).flatMap((period) =>
      period.laborRowsCalculated
        .filter((row) => row.name.trim())
        .map((row) => ({
          ...row,
          periodKey: period.periodKey,
          periodLabel: Salary.formatPeriodLabel(period.periodKey)
        }))
    );
  }, [data, isSingleMonth, rangeData]);

  const socialSecurityLinks = useMemo(
    () => data?.voucherLinksView.filter((link) => link.linkType === 'socialSecurity') ?? [],
    [data]
  );

  const housingFundLinks = useMemo(
    () => data?.voucherLinksView.filter((link) => link.linkType === 'housingFund') ?? [],
    [data]
  );

  const costsDirty = useMemo(() => {
    if (!data) return false;
    return (
      draftCosts.socialSecurity !== (data.employerCosts?.socialSecurity ?? 0) ||
      draftCosts.housingFund !== (data.employerCosts?.housingFund ?? 0)
    );
  }, [data, draftCosts]);

  const handleSaveEmployerCosts = async () => {
    setSaving(true);
    try {
      const next = await Salary.saveEmployerCosts(periodKey, draftCosts);
      applyPeriodData(next);
      refresh();
      message.success('公司已缴五险一金已保存');
    } catch (err) {
      message.error((err as Error).message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleLinkConfirm = async (payload: {
    voucherId: string;
    linkType: PayrollVoucherLinkType;
    customLabel?: string;
  }) => {
    if (!linkModalType) return;
    setLinkSubmitting(true);
    try {
      const next = await Salary.addVoucherLinkAndSyncEmployerCosts(periodKey, {
        ...payload,
        linkType: linkModalType
      });
      applyPeriodData(next);
      refresh();
      message.success('已关联凭证并更新金额');
      setLinkModalType(null);
    } catch (err) {
      message.error((err as Error).message || '关联失败');
      throw err;
    } finally {
      setLinkSubmitting(false);
    }
  };

  const handleRemoveEmployerLink = async (linkId: string) => {
    try {
      const next = await Salary.removeVoucherLinkAndSyncEmployerCosts(periodKey, linkId);
      applyPeriodData(next);
      refresh();
      message.success('已解除关联并更新金额');
    } catch (err) {
      message.error((err as Error).message || '操作失败');
    }
  };

  const monthColumn = {
    title: '月份',
    dataIndex: 'periodLabel',
    width: 110,
    ellipsis: true
  };

  const salaryColumns: ColumnsType<SalaryPayrollRowCalculated> = [
    ...(!isSingleMonth ? [monthColumn] : []),
    { title: '姓名', dataIndex: 'name', ellipsis: true },
    {
      title: '应发工资',
      dataIndex: 'preTaxSalary',
      align: 'right',
      render: (v) => Salary.formatMoneyDisplay(v)
    },
    {
      title: '个人五险',
      dataIndex: 'socialSecurityTotal',
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

  const laborColumns: ColumnsType<LaborLedgerRowCalculated> = [
    ...(!isSingleMonth ? [monthColumn] : []),
    { title: '姓名', dataIndex: 'name', ellipsis: true },
    {
      title: '税前总额',
      dataIndex: 'grossAmount',
      align: 'right',
      render: (v) => Salary.formatMoneyDisplay(v)
    },
    {
      title: '代扣个税',
      dataIndex: 'withheldTax',
      align: 'right',
      render: (v) => Salary.formatMoneyDisplay(v)
    },
    {
      title: '实发劳务费',
      dataIndex: 'netAmount',
      align: 'right',
      render: (v) => Salary.formatMoneyDisplay(v)
    }
  ];

  const salarySummaryOffset = isSingleMonth ? 0 : 1;
  const laborSummaryOffset = isSingleMonth ? 0 : 1;

  return (
    <div className="payroll-stats-panel">
      <div className="payroll-stats-panel__toolbar">
        <Space wrap size={12}>
          <span>月份</span>
          <DatePicker.RangePicker
            picker="month"
            allowClear={false}
            value={range}
            disabledDate={disableFutureMonth}
            onChange={(values) => {
              if (values?.[0] && values[1]) {
                const clamped = clampMonthRangeToToday([values[0], values[1]]);
                if (clamped) setRange(clamped);
              }
            }}
          />
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void loadData()}>
            刷新
          </Button>
        </Space>
      </div>

      {summary ? (
        <div className={`payroll-cost-overview${isSingleMonth ? '' : ' payroll-cost-overview--range'}`}>
          <CostBreakdown
            summary={summary}
            rangeLabel={rangeLabel}
            hideHeadcount={!isSingleMonth}
          />
          {isSingleMonth ? (
            <EmployerCostTable
              draftCosts={draftCosts}
              socialSecurityLinks={socialSecurityLinks}
              housingFundLinks={housingFundLinks}
              saving={saving}
              costsDirty={costsDirty}
              readOnly={employerCostsReadOnly}
              onAmountChange={(field, value) =>
                setDraftCosts((prev) => ({ ...prev, [field]: value }))
              }
              onLink={setLinkModalType}
              onRemoveLink={(linkId) => void handleRemoveEmployerLink(linkId)}
              onOpenVoucher={openVoucherEdit}
              onSave={() => void handleSaveEmployerCosts()}
            />
          ) : (
            <MonthlyCostTable rows={rangeData?.monthly ?? []} loading={loading} />
          )}
        </div>
      ) : null}

      <Tabs
        className="payroll-stats-panel__tabs"
        items={[
          {
            key: 'salary',
            label: `职工明细${salaryRows.length ? ` (${salaryRows.length})` : ''}`,
            children: (
              <div className="payroll-stats-panel__table">
                <ScrollTable
                  fillPage
                  autoHeight
                  size="small"
                  bordered
                  loading={loading}
                  rowKey={(row) =>
                    isSingleMonth ? row.id : `${(row as SalaryRowWithPeriod).periodKey}-${row.id}`
                  }
                  columns={salaryColumns}
                  dataSource={salaryRows}
                  pagination={false}
                  locale={{ emptyText: '暂无职工数据' }}
                  summary={() => {
                    const totals = isSingleMonth
                      ? data?.salaryTotals
                      : rangeData?.periods.reduce(
                        (acc, period) => ({
                          preTaxSalary: acc.preTaxSalary + period.salaryTotals.preTaxSalary,
                          socialSecurityTotal:
                            acc.socialSecurityTotal + period.salaryTotals.socialSecurityTotal,
                          withheldTax: acc.withheldTax + period.salaryTotals.withheldTax,
                          netSalary: acc.netSalary + period.salaryTotals.netSalary
                        }),
                        {
                          preTaxSalary: 0,
                          socialSecurityTotal: 0,
                          withheldTax: 0,
                          netSalary: 0
                        }
                      );

                    return salaryRows.length > 0 && totals ? (
                      <Table.Summary fixed>
                        <Table.Summary.Row>
                          <Table.Summary.Cell index={0}>
                            {isSingleMonth ? '合计' : '范围合计'}
                          </Table.Summary.Cell>
                          {!isSingleMonth ? <Table.Summary.Cell index={1} /> : null}
                          <Table.Summary.Cell index={1 + salarySummaryOffset} align="right">
                            {Salary.formatMoneyDisplay(totals.preTaxSalary)}
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={2 + salarySummaryOffset} align="right">
                            {Salary.formatMoneyDisplay(totals.socialSecurityTotal)}
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={3 + salarySummaryOffset} align="right">
                            {Salary.formatMoneyDisplay(totals.withheldTax)}
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={4 + salarySummaryOffset} align="right">
                            {Salary.formatMoneyDisplay(totals.netSalary)}
                          </Table.Summary.Cell>
                        </Table.Summary.Row>
                      </Table.Summary>
                    ) : null;
                  }}
                />
              </div>
            )
          },
          {
            key: 'labor',
            label: `劳务明细${laborRows.length ? ` (${laborRows.length})` : ''}`,
            children: (
              <div className="payroll-stats-panel__table">
                <ScrollTable
                  fillPage
                  autoHeight
                  size="small"
                  bordered
                  loading={loading}
                  rowKey={(row) =>
                    isSingleMonth ? row.id : `${(row as LaborRowWithPeriod).periodKey}-${row.id}`
                  }
                  columns={laborColumns}
                  dataSource={laborRows}
                  pagination={false}
                  locale={{ emptyText: '暂无劳务数据' }}
                  summary={() => {
                    const totals = isSingleMonth
                      ? data?.laborTotals
                      : rangeData?.periods.reduce(
                        (acc, period) => ({
                          grossAmount: acc.grossAmount + period.laborTotals.grossAmount,
                          withheldTax: acc.withheldTax + period.laborTotals.withheldTax,
                          netAmount: acc.netAmount + period.laborTotals.netAmount
                        }),
                        { grossAmount: 0, withheldTax: 0, netAmount: 0 }
                      );

                    return laborRows.length > 0 && totals ? (
                      <Table.Summary fixed>
                        <Table.Summary.Row>
                          <Table.Summary.Cell index={0}>
                            {isSingleMonth ? '合计' : '范围合计'}
                          </Table.Summary.Cell>
                          {!isSingleMonth ? <Table.Summary.Cell index={1} /> : null}
                          <Table.Summary.Cell index={1 + laborSummaryOffset} align="right">
                            {Salary.formatMoneyDisplay(totals.grossAmount)}
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={2 + laborSummaryOffset} align="right">
                            {Salary.formatMoneyDisplay(totals.withheldTax)}
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={3 + laborSummaryOffset} align="right">
                            {Salary.formatMoneyDisplay(totals.netAmount)}
                          </Table.Summary.Cell>
                        </Table.Summary.Row>
                      </Table.Summary>
                    ) : null;
                  }}
                />
              </div>
            )
          }
        ]}
      />

      {isSingleMonth && !employerCostsReadOnly ? (
        <PayrollVoucherPickerModal
          open={Boolean(linkModalType)}
          periodLabel={periodLabel}
          existingVoucherIds={data?.voucherLinks.map((item) => item.voucherId) ?? []}
          confirmLoading={linkSubmitting}
          defaultLinkType={linkModalType ?? 'socialSecurity'}
          linkTypeLocked
          hint="关联后自动读取凭证中 5401 借方「单位部分」金额，多张凭证会累加。"
          onCancel={() => {
            if (!linkSubmitting) setLinkModalType(null);
          }}
          onConfirm={handleLinkConfirm}
        />
      ) : null}
    </div>
  );
}
