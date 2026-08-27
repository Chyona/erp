import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Segmented } from 'antd';
import {
  BarChartOutlined,
  BookOutlined,
  CalculatorOutlined,
  EditOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  PlusOutlined,
  ProfileOutlined,
  WalletOutlined
} from '@ant-design/icons';
import DashboardIndicatorSettingsModal from '../components/dashboard/DashboardIndicatorSettingsModal';
import {
  DashboardCard,
  DashboardLoading,
  DashboardPeriodPicker,
  DonutChart,
  MetricPair,
  MiniBarChart,
  MiniLineChart,
  ProgressCompare,
  ChangeTag
} from '../components/dashboard/DashboardShared';
import {
  getDashboardData,
  defaultDashboardPeriod,
  formatDashboardMoney,
  type DashboardData,
  type DashboardPeriod
} from '../services/dashboard';
import {
  getDashboardIndicatorConfigs,
  type DashboardIndicatorDefinition
} from '../services/dashboardIndicators';
import { useAsyncLoading } from '../hooks/useAsyncLoading';
import { useApp } from '../context/AppContext';
import { useTabDataRefresh } from '../context/PageTabsContext';
import { usePageTabs } from '../context/PageTabsContext';
import { useAuth } from '../context/AuthContext';
import { useVoucherPageNavigation } from '../hooks/useVoucherPageNavigation';

const QUICK_ACTIONS = [
  { key: 'new', label: '新增凭证', sub: '立即录入', path: '/vouchers/new', primary: true, permission: 'voucher.create' as const },
  { key: 'search', label: '查凭证', icon: FileSearchOutlined, path: '/vouchers' },
  { key: 'ledger', label: '明细账', icon: BookOutlined, path: '/ledger' },
  { key: 'trial', label: '科目余额表', icon: ProfileOutlined, path: '/reports' },
  { key: 'reports', label: '报表中心', icon: BarChartOutlined, path: '/reports' },
  { key: 'general', label: '总账', icon: CalculatorOutlined, path: '/general-ledger' }
];

export default function DashboardPage() {
  const { refreshKey } = useApp();
  const tabDataRefresh = useTabDataRefresh();
  const { openPageTab } = usePageTabs();
  const { can } = useAuth();
  const { openNewVoucher } = useVoucherPageNavigation();
  const [period, setPeriod] = useState<DashboardPeriod>(() => defaultDashboardPeriod());
  const [data, setData] = useState<DashboardData | null>(null);
  const [arApMode, setArApMode] = useState<'receivable' | 'payable'>('receivable');
  const [selectedIndicator, setSelectedIndicator] = useState('cash');
  const [indicatorSettingsOpen, setIndicatorSettingsOpen] = useState(false);
  const [indicatorConfigs, setIndicatorConfigs] = useState<DashboardIndicatorDefinition[]>([]);
  const { loading, run } = useAsyncLoading(true);

  const loadIndicatorConfigs = useCallback(async () => {
    const configs = await getDashboardIndicatorConfigs();
    setIndicatorConfigs(configs);
    return configs;
  }, []);

  const loadData = useCallback(async () => {
    await run(async () => {
      const next = await getDashboardData(period);
      setData(next);
      if (next.accountIndicators.length) {
        setSelectedIndicator((current) =>
          next.accountIndicators.some((item) => item.id === current)
            ? current
            : next.accountIndicators[0].id
        );
      }
    });
  }, [period, run]);

  useEffect(() => {
    void loadIndicatorConfigs();
  }, [loadIndicatorConfigs, refreshKey, tabDataRefresh]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey, tabDataRefresh]);

  const quickActions = useMemo(
    () =>
      QUICK_ACTIONS.filter((item) => !item.permission || can(item.permission)),
    [can]
  );

  const selectedTrend = data?.accountTrends[selectedIndicator] ?? [];
  const selectedBreakdown = data?.accountBreakdowns[selectedIndicator] ?? [];
  const selectedIndicatorMeta = data?.accountIndicators.find((item) => item.id === selectedIndicator);

  return (
    <div className="dashboard-page">
      <DashboardLoading loading={loading && !data}>
        <section className="dashboard-section dashboard-section--quick">
          <div className="dashboard-section__head">
            <h2>常用功能</h2>
          </div>
          <div className="dashboard-quick-actions">
            {quickActions.map((action) => {
              const Icon = action.icon;
              if (action.primary) {
                return (
                  <button
                    key={action.key}
                    type="button"
                    className="dashboard-quick-action dashboard-quick-action--primary"
                    onClick={() => openNewVoucher(action.path)}
                  >
                    <PlusOutlined />
                    <span>{action.label}</span>
                    <small>{action.sub}</small>
                  </button>
                );
              }
              return (
                <button
                  key={action.key}
                  type="button"
                  className="dashboard-quick-action"
                  onClick={() => openPageTab(action.path)}
                >
                  {Icon ? <Icon /> : <FileTextOutlined />}
                  <span>{action.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {data ? (
          <>
            <section className="dashboard-section">
              <div className="dashboard-section__head">
                <h2>财务指标</h2>
              </div>
              <div className="dashboard-grid dashboard-grid--4">
                <DashboardCard
                  title="资金余额"
                  extra={
                    <DashboardPeriodPicker period={period} onChange={(next) => setPeriod({ type: 'month', ...next })} />
                  }
                >
                  <div className="dashboard-kpi dashboard-kpi--large">
                    {formatDashboardMoney(data.funds.total)}
                  </div>
                  <div className="dashboard-list dashboard-list--compact">
                    <div><span>银行存款</span><strong>{formatDashboardMoney(data.funds.bank)}</strong></div>
                    <div><span>库存现金</span><strong>{formatDashboardMoney(data.funds.cash)}</strong></div>
                  </div>
                  <div className="dashboard-subblock">
                    <div className="dashboard-subblock__title">资金净收入</div>
                    <ProgressCompare income={data.funds.income} expense={data.funds.expense} />
                  </div>
                </DashboardCard>

                <DashboardCard
                  title={
                    <Segmented
                      size="small"
                      value={arApMode}
                      options={[
                        { label: '应收', value: 'receivable' },
                        { label: '应付', value: 'payable' }
                      ]}
                      onChange={(value) => setArApMode(value as 'receivable' | 'payable')}
                    />
                  }
                  extra={<DashboardPeriodPicker period={period} onChange={(next) => setPeriod({ type: 'month', ...next })} />}
                >
                  <div className="dashboard-kpi dashboard-kpi--large">
                    {formatDashboardMoney(
                      arApMode === 'receivable'
                        ? data.receivablePayable.receivable
                        : data.receivablePayable.payable
                    )}
                  </div>
                  <div className="dashboard-list">
                    {(arApMode === 'receivable'
                      ? data.receivablePayable.receivableItems
                      : data.receivablePayable.payableItems
                    ).length ? (
                      (arApMode === 'receivable'
                        ? data.receivablePayable.receivableItems
                        : data.receivablePayable.payableItems
                      ).map((item) => (
                        <div key={item.name}>
                          <span>{item.name}</span>
                          <strong>{formatDashboardMoney(item.amount)}</strong>
                        </div>
                      ))
                    ) : (
                      <div className="dashboard-empty-inline">暂无明细科目</div>
                    )}
                  </div>
                </DashboardCard>

                <DashboardCard
                  title="预计可用资金"
                  extra={<DashboardPeriodPicker period={period} onChange={(next) => setPeriod({ type: 'month', ...next })} />}
                >
                  <div className="dashboard-kpi dashboard-kpi--large">
                    {formatDashboardMoney(data.availableFunds.total)}
                  </div>
                  <div className="dashboard-formula">
                    <div>
                      <span>现有资金</span>
                      <strong>{formatDashboardMoney(data.availableFunds.existing)}</strong>
                    </div>
                    <span>+</span>
                    <div>
                      <span>短期应收</span>
                      <strong>{formatDashboardMoney(data.availableFunds.shortTermReceivable)}</strong>
                    </div>
                    <span>-</span>
                    <div>
                      <span>短期应付</span>
                      <strong>{formatDashboardMoney(data.availableFunds.shortTermPayable)}</strong>
                    </div>
                  </div>
                  <div className="dashboard-ratio-row">
                    <div>
                      <span>现金比率</span>
                      <strong>{data.availableFunds.cashRatio.toFixed(2)}%</strong>
                    </div>
                    <div>
                      <span>速动比率</span>
                      <strong>{data.availableFunds.quickRatio.toFixed(2)}%</strong>
                    </div>
                  </div>
                </DashboardCard>

                <DashboardCard
                  title="净利润"
                  extra={<DashboardPeriodPicker period={period} onChange={(next) => setPeriod({ type: 'month', ...next })} />}
                >
                  <div className="dashboard-profit-head">
                    <div>
                      <div className="dashboard-kpi dashboard-kpi--large">
                        {formatDashboardMoney(data.netProfit.amount)}
                      </div>
                      <div className="dashboard-inline-change">
                        较上期 <ChangeTag value={data.netProfit.prevChange} />
                      </div>
                    </div>
                    <div className="dashboard-profit-side">
                      <span>净利润率</span>
                      <strong>{data.netProfit.margin.toFixed(2)}%</strong>
                    </div>
                  </div>
                  <div className="dashboard-subblock">
                    <div className="dashboard-subblock__title">近期变动趋势</div>
                    <MiniLineChart points={data.netProfit.trend} />
                  </div>
                </DashboardCard>
              </div>
            </section>

            <section className="dashboard-section">
              <div className="dashboard-grid dashboard-grid--4">
                <DashboardCard
                  title="收入成本"
                  extra={<DashboardPeriodPicker period={period} onChange={(next) => setPeriod({ type: 'month', ...next })} />}
                >
                  <MetricPair
                    label="收入"
                    value={formatDashboardMoney(data.incomeCost.income)}
                    prevChange={data.incomeCost.incomePrevChange}
                  />
                  <MetricPair
                    label="成本"
                    value={formatDashboardMoney(data.incomeCost.cost)}
                    prevChange={data.incomeCost.costPrevChange}
                  />
                  <div className="dashboard-inline-meta">毛利率：{data.incomeCost.grossMargin.toFixed(2)}%</div>
                  <div className="dashboard-subblock">
                    <div className="dashboard-subblock__title">近期变动趋势</div>
                    <MiniBarChart points={data.incomeCost.trend} />
                  </div>
                </DashboardCard>

                <DashboardCard
                  title="费用"
                  extra={<DashboardPeriodPicker period={period} onChange={(next) => setPeriod({ type: 'month', ...next })} />}
                  footer={
                    <Button type="link" onClick={() => openPageTab('/ledger')}>
                      费用明细
                    </Button>
                  }
                >
                  <MetricPair
                    label="费用合计"
                    value={formatDashboardMoney(data.expense.total)}
                    prevChange={data.expense.prevChange}
                  />
                  <DonutChart
                    items={data.expense.breakdown}
                    total={formatDashboardMoney(data.expense.total)}
                  />
                  <div className="dashboard-ratio-row">
                    <div>
                      <span>费用占收入比</span>
                      <strong>{data.expense.incomeRatio.toFixed(2)}%</strong>
                    </div>
                    <div>
                      <span>费用占成本比</span>
                      <strong>{data.expense.costRatio.toFixed(2)}%</strong>
                    </div>
                  </div>
                </DashboardCard>

                {/* <DashboardCard
                  title="发票"
                  extra={<DashboardPeriodPicker period={period} onChange={(next) => setPeriod({ type: 'month', ...next })} />}
                  footer={
                    <Button type="link" disabled>
                      录入发票
                    </Button>
                  }
                >
                  <div className="dashboard-invoice-empty">
                    <WalletOutlined />
                    <p>本期销项 / 进项发票</p>
                    <span>暂无数据</span>
                  </div>
                </DashboardCard> */}

                <DashboardCard
                  title="增值税及附加"
                  extra={<DashboardPeriodPicker period={period} onChange={(next) => setPeriod({ type: 'month', ...next })} />}
                  footer={
                    <Button type="link" onClick={() => openPageTab('/closing/period-end')}>
                      税负测算
                    </Button>
                  }
                >
                  <div className="dashboard-list dashboard-list--compact">
                    <div><span>预计应交税费</span><strong>{formatDashboardMoney(data.vat.estimatedTax)}</strong></div>
                    <div><span>预计增值税税负率</span><strong>{data.vat.burdenRate.toFixed(2)}%</strong></div>
                  </div>
                  <div className="dashboard-subblock">
                    <div className="dashboard-subblock__title">近期变动趋势</div>
                    <MiniLineChart points={data.vat.trend} color="#69b1ff" />
                  </div>
                </DashboardCard>
              </div>
            </section>

            <section className="dashboard-section">
              <div className="dashboard-section__head">
                <h2>其他科目指标</h2>
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  aria-label="管理财务指标"
                  onClick={() => setIndicatorSettingsOpen(true)}
                />
              </div>
              <div className="dashboard-indicator-tabs-wrap">
                <div className="dashboard-indicator-tabs">
                  {data.accountIndicators.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`dashboard-indicator-tab${selectedIndicator === item.id ? ' dashboard-indicator-tab--active' : ''}`}
                      onClick={() => setSelectedIndicator(item.id)}
                    >
                      <span>{item.label}</span>
                      <strong>{formatDashboardMoney(item.amount)}</strong>
                    </button>
                  ))}
                </div>
              </div>
              <div className="dashboard-grid dashboard-grid--analysis">
                <DashboardCard
                  title={`${selectedIndicatorMeta?.label ?? ''}变化趋势`}
                  className="dashboard-card--wide"
                >
                  <MiniLineChart points={selectedTrend} />
                </DashboardCard>
                <DashboardCard title={`${period.month}月${selectedIndicatorMeta?.label ?? ''}分析`}>
                  <div className="dashboard-analysis">
                    <div className="dashboard-list">
                      {selectedBreakdown.length ? (
                        selectedBreakdown.slice(0, 8).map((item) => (
                          <div key={item.name}>
                            <span>{item.name}</span>
                            <strong>{formatDashboardMoney(item.amount)}</strong>
                          </div>
                        ))
                      ) : (
                        <div className="dashboard-empty-inline">暂无下级科目明细</div>
                      )}
                    </div>
                    <DonutChart
                      items={selectedBreakdown.slice(0, 6).map((item, index) => ({
                        label: item.name,
                        amount: item.amount,
                        color: ['#5B8FF9', '#5AD8A6', '#F6BD16', '#E86452', '#9270CA', '#FF9D4D'][index % 6]
                      }))}
                      total={formatDashboardMoney(selectedIndicatorMeta?.amount ?? 0)}
                    />
                  </div>
                </DashboardCard>
              </div>
            </section>
          </>
        ) : null}
      </DashboardLoading>

      <DashboardIndicatorSettingsModal
        open={indicatorSettingsOpen}
        indicators={indicatorConfigs}
        onCancel={() => setIndicatorSettingsOpen(false)}
        onSaved={(items) => {
          setIndicatorConfigs(items);
          setIndicatorSettingsOpen(false);
          void loadData();
        }}
      />
    </div>
  );
}
