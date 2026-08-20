import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, Calendar, Popover, Select } from 'antd';
import { FilterOutlined, DoubleLeftOutlined, DoubleRightOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import type { VoucherPeriod, VoucherTimeFilterState, VoucherTimeMode } from '../utils/voucherTimeFilter';
import {
  applyDateShortcut,
  applyPeriodShortcut,
  currentPeriod,
  datesToPeriods,
  formatPeriodRange,
  getTimeFilterDisplay,
  normalizePeriodRange,
  periodsToDateRange,
  resolveTimeFilterQuery
} from '../utils/voucherTimeFilter';

const MODE_OPTIONS = [
  { value: 'date' as VoucherTimeMode, label: '凭证日期' },
  { value: 'period' as VoucherTimeMode, label: '凭证期间' }
];

const DATE_SHORTCUTS = [
  { key: 'today' as const, label: '今日' },
  { key: 'currentPeriod' as const, label: '本期' },
  { key: 'lastPeriod' as const, label: '上期' },
  { key: 'thisMonth' as const, label: '本月' },
  { key: 'lastMonth' as const, label: '上月' },
  { key: 'thisYear' as const, label: '今年' }
];

const PERIOD_SHORTCUTS = [
  { key: 'currentPeriod' as const, label: '本期' },
  { key: 'lastPeriod' as const, label: '上期' },
  { key: 'thisMonth' as const, label: '本月' },
  { key: 'lastMonth' as const, label: '上月' },
  { key: 'thisYear' as const, label: '今年' },
  { key: 'lastYear' as const, label: '去年' }
];

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

type VoucherTimeFilterProps = {
  value: VoucherTimeFilterState;
  onChange: (next: VoucherTimeFilterState) => void;
  onQuery: (startDate: string, endDate: string) => void;
  filterOpen?: boolean;
  onFilterOpenChange?: (open: boolean) => void;
  filterContent?: ReactNode;
  activeFilterCount?: number;
};

function PeriodPanel({
  title,
  panelYear,
  selected,
  onYearChange,
  onSelect
}: {
  title: string;
  panelYear: number;
  selected: VoucherPeriod | null;
  onYearChange: (year: number) => void;
  onSelect: (period: VoucherPeriod) => void;
}) {
  return (
    <div className="voucher-time-filter__period-panel">
      <div className="voucher-time-filter__panel-title">{title}</div>
      <div className="voucher-time-filter__year-nav">
        <Button type="text" size="small" icon={<DoubleLeftOutlined />} onClick={() => onYearChange(panelYear - 1)} />
        <span>{panelYear}年</span>
        <Button type="text" size="small" icon={<DoubleRightOutlined />} onClick={() => onYearChange(panelYear + 1)} />
      </div>
      <div className="voucher-time-filter__period-grid">
        {MONTHS.map((month) => {
          const active = selected?.year === panelYear && selected?.month === month;
          return (
            <button
              key={month}
              type="button"
              className={`voucher-time-filter__period-item${active ? ' voucher-time-filter__period-item--active' : ''}`}
              onClick={() => onSelect({ year: panelYear, month })}
            >
              {month}期
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function VoucherTimeFilter({
  value,
  onChange,
  onQuery,
  filterOpen = false,
  onFilterOpenChange,
  filterContent,
  activeFilterCount = 0
}: VoucherTimeFilterProps) {
  const [timeOpen, setTimeOpen] = useState(false);
  const [draftMode, setDraftMode] = useState<VoucherTimeMode>(value.mode);
  const [draftStartDate, setDraftStartDate] = useState<Dayjs | null>(null);
  const [draftEndDate, setDraftEndDate] = useState<Dayjs | null>(null);
  const [draftStartPeriod, setDraftStartPeriod] = useState<VoucherPeriod | null>(null);
  const [draftEndPeriod, setDraftEndPeriod] = useState<VoucherPeriod | null>(null);
  const [startPanelYear, setStartPanelYear] = useState(dayjs().year());
  const [endPanelYear, setEndPanelYear] = useState(dayjs().year());

  const displayText = useMemo(() => getTimeFilterDisplay(value) || '不限', [value]);

  const openTimePicker = () => {
    syncDraftFromValue();
    setTimeOpen(true);
  };

  const syncDraftFromValue = () => {
    setDraftMode(value.mode);
    if (value.mode === 'date') {
      setDraftStartDate(value.startDate ? dayjs(value.startDate) : null);
      setDraftEndDate(value.endDate ? dayjs(value.endDate) : null);
      const period = value.startPeriod && value.endPeriod
        ? { startPeriod: value.startPeriod, endPeriod: value.endPeriod }
        : value.startDate && value.endDate
          ? datesToPeriods(value.startDate, value.endDate)
          : null;
      if (period) {
        setDraftStartPeriod(period.startPeriod);
        setDraftEndPeriod(period.endPeriod);
        setStartPanelYear(period.startPeriod.year);
        setEndPanelYear(period.endPeriod.year);
      } else {
        const current = currentPeriod();
        setDraftStartPeriod(null);
        setDraftEndPeriod(null);
        setStartPanelYear(current.year);
        setEndPanelYear(current.year);
      }
    } else {
      setDraftStartPeriod(value.startPeriod);
      setDraftEndPeriod(value.endPeriod);
      setStartPanelYear(value.startPeriod?.year ?? dayjs().year());
      setEndPanelYear(value.endPeriod?.year ?? dayjs().year());
      if (value.startDate && value.endDate) {
        setDraftStartDate(dayjs(value.startDate));
        setDraftEndDate(dayjs(value.endDate));
      } else {
        setDraftStartDate(null);
        setDraftEndDate(null);
      }
    }
  };

  useEffect(() => {
    if (timeOpen) syncDraftFromValue();
  }, [timeOpen, value]);

  const handleModeChange = (mode: VoucherTimeMode) => {
    setDraftMode(mode);
    if (mode === 'period') {
      if (draftStartDate && draftEndDate) {
        const periods = datesToPeriods(
          draftStartDate.format('YYYY-MM-DD'),
          draftEndDate.format('YYYY-MM-DD')
        );
        setDraftStartPeriod(periods.startPeriod);
        setDraftEndPeriod(periods.endPeriod);
        setStartPanelYear(periods.startPeriod.year);
        setEndPanelYear(periods.endPeriod.year);
      } else if (!draftStartPeriod || !draftEndPeriod) {
        const current = currentPeriod();
        setDraftStartPeriod(current);
        setDraftEndPeriod(current);
        setStartPanelYear(current.year);
        setEndPanelYear(current.year);
      }
    } else if (draftStartPeriod && draftEndPeriod) {
      const range = periodsToDateRange(draftStartPeriod, draftEndPeriod);
      setDraftStartDate(dayjs(range.startDate));
      setDraftEndDate(dayjs(range.endDate));
    }
  };

  const pickDate = (side: 'start' | 'end', date: Dayjs) => {
    if (side === 'start') {
      setDraftStartDate(date.startOf('day'));
      if (draftEndDate && date.isAfter(draftEndDate, 'day')) {
        setDraftEndDate(date.endOf('day'));
      }
      return;
    }
    setDraftEndDate(date.endOf('day'));
    if (draftStartDate && date.isBefore(draftStartDate, 'day')) {
      setDraftStartDate(date.startOf('day'));
    }
  };

  const handleQuery = () => {
    if (draftMode === 'date') {
      if (!draftStartDate || !draftEndDate) {
        onChange({ ...value, mode: 'date', startDate: '', endDate: '', startPeriod: null, endPeriod: null });
        onQuery('', '');
        setTimeOpen(false);
        return;
      }
      const startDate = draftStartDate.format('YYYY-MM-DD');
      const endDate = draftEndDate.format('YYYY-MM-DD');
      const periods = datesToPeriods(startDate, endDate);
      const next: VoucherTimeFilterState = {
        mode: 'date',
        startDate,
        endDate,
        startPeriod: periods.startPeriod,
        endPeriod: periods.endPeriod
      };
      onChange(next);
      onQuery(startDate, endDate);
    } else {
      if (!draftStartPeriod || !draftEndPeriod) {
        onChange({ ...value, mode: 'period', startDate: '', endDate: '', startPeriod: null, endPeriod: null });
        onQuery('', '');
        setTimeOpen(false);
        return;
      }
      const range = periodsToDateRange(draftStartPeriod, draftEndPeriod);
      const next: VoucherTimeFilterState = {
        mode: 'period',
        startDate: range.startDate,
        endDate: range.endDate,
        startPeriod: range.startPeriod,
        endPeriod: range.endPeriod
      };
      onChange(next);
      onQuery(range.startDate, range.endDate);
    }
    setTimeOpen(false);
  };

  const timePopoverContent =
    draftMode === 'date' ? (
      <div className="voucher-time-filter-popover">
        <div className="voucher-time-filter-popover__panels">
          <div className="voucher-time-filter__date-panel">
            <div className="voucher-time-filter__panel-title">开始时间</div>
            <Calendar
              fullscreen={false}
              value={draftStartDate ?? undefined}
              onSelect={(date) => pickDate('start', date)}
            />
          </div>
          <div className="voucher-time-filter__date-panel">
            <div className="voucher-time-filter__panel-title">结束时间</div>
            <Calendar
              fullscreen={false}
              value={draftEndDate ?? undefined}
              onSelect={(date) => pickDate('end', date)}
            />
          </div>
        </div>
        <div className="voucher-time-filter-popover__shortcuts">
          {DATE_SHORTCUTS.map((item) => (
            <button
              key={item.key}
              type="button"
              className="voucher-time-filter-popover__shortcut"
              onClick={() => {
                const { start, end } = applyDateShortcut(item.key);
                setDraftStartDate(start);
                setDraftEndDate(end);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="voucher-time-filter-popover__footer">
          <Button type="primary" onClick={handleQuery}>
            查询
          </Button>
        </div>
      </div>
    ) : (
      <div className="voucher-time-filter-popover">
        <div className="voucher-time-filter-popover__panels">
          <PeriodPanel
            title="开始期间"
            panelYear={startPanelYear}
            selected={draftStartPeriod}
            onYearChange={setStartPanelYear}
            onSelect={setDraftStartPeriod}
          />
          <PeriodPanel
            title="结束期间"
            panelYear={endPanelYear}
            selected={draftEndPeriod}
            onYearChange={setEndPanelYear}
            onSelect={setDraftEndPeriod}
          />
        </div>
        <div className="voucher-time-filter-popover__shortcuts">
          {PERIOD_SHORTCUTS.map((item) => (
            <button
              key={item.key}
              type="button"
              className="voucher-time-filter-popover__shortcut"
              onClick={() => {
                const [start, end] = applyPeriodShortcut(item.key);
                setDraftStartPeriod(start);
                setDraftEndPeriod(end);
                setStartPanelYear(start.year);
                setEndPanelYear(end.year);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="voucher-time-filter-popover__preview">
          {draftStartPeriod && draftEndPeriod
            ? formatPeriodRange(...normalizePeriodRange(draftStartPeriod, draftEndPeriod))
            : '请选择期间'}
        </div>
        <div className="voucher-time-filter-popover__footer">
          <Button type="primary" onClick={handleQuery}>
            查询
          </Button>
        </div>
      </div>
    );

  return (
    <div className="voucher-time-filter-group">
      <Select
        value={value.mode}
        options={MODE_OPTIONS}
        variant="borderless"
        className="voucher-time-filter-group__mode"
        popupMatchSelectWidth={false}
        onChange={(mode) => {
          const next = { ...value, mode };
          if (mode === 'period' && value.startDate && value.endDate) {
            const periods = datesToPeriods(value.startDate, value.endDate);
            next.startPeriod = periods.startPeriod;
            next.endPeriod = periods.endPeriod;
          } else if (mode === 'date' && value.startPeriod && value.endPeriod) {
            const range = periodsToDateRange(value.startPeriod, value.endPeriod);
            next.startDate = range.startDate;
            next.endDate = range.endDate;
          }
          onChange(next);
          const query = resolveTimeFilterQuery(next);
          onQuery(query.startDate, query.endDate);
        }}
      />
      <span className="voucher-time-filter-group__divider" aria-hidden />
      <Popover
        trigger="click"
        placement="bottomLeft"
        open={timeOpen}
        onOpenChange={(nextOpen) => {
          if (nextOpen) syncDraftFromValue();
          setTimeOpen(nextOpen);
        }}
        overlayClassName="voucher-time-filter-popover-wrap"
        content={timePopoverContent}
      >
        <button type="button" className="voucher-time-filter-group__value" onClick={openTimePicker}>
          {displayText}
        </button>
      </Popover>
      <span className="voucher-time-filter-group__divider" aria-hidden />
      <Popover
        trigger="click"
        placement="bottomLeft"
        open={filterOpen}
        onOpenChange={onFilterOpenChange}
        overlayClassName="voucher-filter-popover"
        content={filterContent}
      >
        <button
          type="button"
          className={`voucher-time-filter-group__trigger${activeFilterCount ? ' voucher-time-filter-group__trigger--active' : ''}`}
        >
          <FilterOutlined className="voucher-time-filter-group__trigger-icon" />
          过滤{activeFilterCount ? ` (${activeFilterCount})` : ''}
        </button>
      </Popover>
    </div>
  );
}
