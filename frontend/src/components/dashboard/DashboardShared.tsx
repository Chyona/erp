import type { ReactNode } from 'react';
import { DatePicker, Empty, Spin } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import type { DashboardTrendPoint } from '../../services/dashboard';
import { disableFutureMonth } from '../../utils/dateConstraints';

export function DashboardCard({
  title,
  extra,
  footer,
  children,
  className = ''
}: {
  title: ReactNode;
  extra?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`dashboard-card ${className}`.trim()}>
      <header className="dashboard-card__header">
        <div className="dashboard-card__title">{title}</div>
        {extra ? <div className="dashboard-card__extra">{extra}</div> : null}
      </header>
      <div className="dashboard-card__body">{children}</div>
      {footer ? <footer className="dashboard-card__footer">{footer}</footer> : null}
    </section>
  );
}

export function DashboardPeriodPicker({
  period,
  onChange
}: {
  period: { year: number; month: number };
  onChange: (period: { year: number; month: number }) => void;
}) {
  const value = dayjs(`${period.year}-${String(period.month).padStart(2, '0')}-01`);
  return (
    <DatePicker
      picker="month"
      allowClear={false}
      size="small"
      bordered={false}
      className="dashboard-period-picker"
      value={value}
      disabledDate={disableFutureMonth}
      format={`${period.year}年${String(period.month).padStart(2, '0')}期`}
      onChange={(next: Dayjs | null) => {
        if (!next) return;
        onChange({ year: next.year(), month: next.month() + 1 });
      }}
    />
  );
}

export function ChangeTag({ value }: { value: number | null }) {
  if (value == null) return <span className="dashboard-change dashboard-change--empty">--%</span>;
  const up = value >= 0;
  return (
    <span className={`dashboard-change dashboard-change--${up ? 'up' : 'down'}`}>
      {up ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
      {Math.abs(value).toFixed(2)}%
    </span>
  );
}

export function MetricPair({
  label,
  value,
  prevChange,
  yoyChange
}: {
  label: string;
  value: string;
  prevChange?: number | null;
  yoyChange?: number | null;
}) {
  return (
    <div className="dashboard-metric-pair">
      <div className="dashboard-metric-pair__label">{label}</div>
      <div className="dashboard-metric-pair__value">{value}</div>
      <div className="dashboard-metric-pair__changes">
        <span>
          较上期 <ChangeTag value={prevChange ?? null} />
        </span>
        {yoyChange !== undefined ? (
          <span>
            较同期 <ChangeTag value={yoyChange ?? null} />
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function MiniBarChart({
  points,
  colors = ['#5B8FF9', '#91caff']
}: {
  points: DashboardTrendPoint[];
  colors?: [string, string];
}) {
  const max = Math.max(...points.flatMap((point) => [point.value, point.value2 || 0]), 1);
  return (
    <div className="dashboard-mini-chart dashboard-mini-chart--bar">
      <div className="dashboard-mini-chart__plot">
        {points.map((point) => (
          <div key={point.label} className="dashboard-mini-chart__group">
            <div className="dashboard-mini-chart__bars">
              <div
                className="dashboard-mini-chart__bar"
                style={{ height: `${(point.value / max) * 100}%`, background: colors[0] }}
              />
              {point.value2 != null ? (
                <div
                  className="dashboard-mini-chart__bar dashboard-mini-chart__bar--secondary"
                  style={{ height: `${(point.value2 / max) * 100}%`, background: colors[1] }}
                />
              ) : null}
            </div>
            <span className="dashboard-mini-chart__label">{point.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MiniLineChart({
  points,
  color = '#5B8FF9'
}: {
  points: DashboardTrendPoint[];
  color?: string;
}) {
  if (!points.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无趋势" />;
  const values = points.map((point) => point.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = max - min || 1;
  const width = 100 / Math.max(points.length - 1, 1);
  const coords = points.map((point, index) => {
    const x = index * width;
    const y = 100 - ((point.value - min) / range) * 100;
    return `${x},${y}`;
  });

  return (
    <div className="dashboard-mini-chart dashboard-mini-chart--line">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="dashboard-mini-chart__svg">
        <polyline points={coords.join(' ')} fill="none" stroke={color} strokeWidth="1.5" />
      </svg>
      <div className="dashboard-mini-chart__axis">
        {points.map((point) => (
          <span key={point.label}>{point.label}</span>
        ))}
      </div>
    </div>
  );
}

export function DonutChart({
  items,
  total,
  colors
}: {
  items: { label: string; amount: number; color: string }[];
  total: string | number;
  colors?: string[];
}) {
  const palette = colors || ['#5B8FF9', '#5AD8A6', '#F6BD16', '#E86452'];
  const sum = items.reduce((acc, item) => acc + Math.abs(item.amount), 0);
  if (sum <= 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />;

  let offset = 0;
  const segments = items.map((item, index) => {
    const pct = (Math.abs(item.amount) / sum) * 100;
    const segment = {
      ...item,
      pct,
      color: item.color || palette[index % palette.length],
      offset
    };
    offset += pct;
    return segment;
  });

  const gradient = segments
    .map((segment) => `${segment.color} ${segment.offset}% ${segment.offset + segment.pct}%`)
    .join(', ');

  return (
    <div className="dashboard-donut">
      <div className="dashboard-donut__ring" style={{ background: `conic-gradient(${gradient})` }}>
        <div className="dashboard-donut__center">
          <div>{total}</div>
          <span>总额</span>
        </div>
      </div>
      <div className="dashboard-donut__legend">
        {segments.map((segment) => (
          <div key={segment.label} className="dashboard-donut__legend-item">
            <span className="dashboard-donut__dot" style={{ background: segment.color }} />
            <span>{segment.label}</span>
            <strong>{segment.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardLoading({ loading, children }: { loading: boolean; children: ReactNode }) {
  return (
    <Spin spinning={loading} wrapperClassName="dashboard-loading">
      {children}
    </Spin>
  );
}

export function ProgressCompare({
  income,
  expense
}: {
  income: number;
  expense: number;
}) {
  const total = income + expense || 1;
  const incomePct = Math.max((income / total) * 100, 0);
  return (
    <div className="dashboard-progress-compare">
      <div className="dashboard-progress-compare__bar">
        <span style={{ width: `${incomePct}%` }} />
      </div>
      <div className="dashboard-progress-compare__labels">
        <span>收入 {income.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</span>
        <span>支出 {expense.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</span>
      </div>
    </div>
  );
}
