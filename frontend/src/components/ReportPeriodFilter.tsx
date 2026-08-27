import { useEffect, useMemo, useState } from 'react';
import { Button, Input, Popover, Select, Space } from 'antd';
import {
  CalendarOutlined,
  DoubleLeftOutlined,
  DoubleRightOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import {
  currentReportMonthPeriod,
  clampReportPeriodToNow,
  formatReportPeriod,
  isFutureReportMonth,
  isFutureReportQuarter
} from '../utils/reportPeriod';

const REPORT_TYPE_OPTIONS = [
  { value: 'month', label: '月报' },
  { value: 'quarter', label: '季报' }
];

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);
const QUARTERS = [1, 2, 3, 4];

function PeriodPickerPanel({ period, panelYear, onPanelYearChange, onSelect, onClose }) {
  const maxYear = currentReportMonthPeriod().year;
  const changeYear = (delta) => onPanelYearChange(panelYear + delta);

  return (
    <div className="report-period-picker">
      <div className="report-period-picker__header">
        <Button
          type="text"
          size="small"
          icon={<DoubleLeftOutlined />}
          onClick={() => changeYear(-1)}
        />
        <span className="report-period-picker__year">{panelYear}年</span>
        <Button
          type="text"
          size="small"
          icon={<DoubleRightOutlined />}
          disabled={panelYear >= maxYear}
          onClick={() => changeYear(1)}
        />
      </div>

      {period.type === 'month' ? (
        <div className="report-period-picker__grid report-period-picker__grid--month">
          {MONTHS.map((month) => {
            const selected = panelYear === period.year && month === period.month;
            const disabled = isFutureReportMonth(panelYear, month);
            return (
              <button
                key={month}
                type="button"
                disabled={disabled}
                className={`report-period-picker__item${selected ? ' report-period-picker__item--active' : ''}${disabled ? ' report-period-picker__item--disabled' : ''}`}
                onClick={() => {
                  if (disabled) return;
                  onSelect({ ...period, year: panelYear, month });
                  onClose();
                }}
              >
                {month}期
              </button>
            );
          })}
        </div>
      ) : (
        <div className="report-period-picker__grid report-period-picker__grid--quarter">
          {QUARTERS.map((quarter) => {
            const selected = panelYear === period.year && quarter === period.quarter;
            const disabled = isFutureReportQuarter(panelYear, quarter);
            return (
              <button
                key={quarter}
                type="button"
                disabled={disabled}
                className={`report-period-picker__item${selected ? ' report-period-picker__item--active' : ''}${disabled ? ' report-period-picker__item--disabled' : ''}`}
                onClick={() => {
                  if (disabled) return;
                  onSelect({ ...period, year: panelYear, quarter });
                  onClose();
                }}
              >
                Q{quarter}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ReportPeriodFilter({
  value,
  onChange,
  onRefresh,
  loading = false,
  typeOptions = REPORT_TYPE_OPTIONS,
  beforeRefresh = null,
  formatPeriod = formatReportPeriod
}) {
  const [open, setOpen] = useState(false);
  const [panelYear, setPanelYear] = useState(value.year);

  const displayText = useMemo(() => formatPeriod(value), [formatPeriod, value]);

  useEffect(() => {
    const clamped = clampReportPeriodToNow(value);
    if (
      clamped.year !== value.year ||
      clamped.month !== value.month ||
      clamped.quarter !== value.quarter
    ) {
      onChange(clamped);
    }
  }, [value.year, value.month, value.quarter, value.type]);

  const handleSelect = (next) => {
    onChange(clampReportPeriodToNow(next));
  };

  const handleTypeChange = (type) => {
    onChange(clampReportPeriodToNow({ ...value, type }));
  };

  const handleOpenChange = (nextOpen) => {
    if (nextOpen) {
      setPanelYear(value.year);
    }
    setOpen(nextOpen);
  };

  return (
    <Space wrap className="report-period-filter" size={12}>
      {typeOptions.length > 1 ? (
        <Select
          value={value.type}
          options={typeOptions}
          onChange={handleTypeChange}
          className="report-period-filter__type"
        />
      ) : null}
      <Popover
        trigger="click"
        open={open}
        onOpenChange={handleOpenChange}
        placement="bottomLeft"
        classNames={{ root: 'report-period-picker-popover' }}
        content={
          <PeriodPickerPanel
            period={value}
            panelYear={panelYear}
            onPanelYearChange={setPanelYear}
            onSelect={handleSelect}
            onClose={() => setOpen(false)}
          />
        }
      >
        <Input
          readOnly
          value={displayText}
          className="report-period-filter__input"
          suffix={<CalendarOutlined className="report-period-filter__calendar" />}
        />
      </Popover>
      {beforeRefresh}
      <Button icon={<ReloadOutlined />} loading={loading} onClick={onRefresh}>
        刷新
      </Button>
    </Space>
  );
}
