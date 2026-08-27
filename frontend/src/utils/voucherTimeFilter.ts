import dayjs, { type Dayjs } from 'dayjs';
import {
  clampDayjsToToday,
  isFutureDate,
  todayDayjs
} from './dateConstraints';

export { isFutureDate, todayDayjs } from './dateConstraints';

export type VoucherTimeMode = 'date' | 'period';

export interface VoucherPeriod {
  year: number;
  month: number;
}

export interface VoucherTimeFilterState {
  mode: VoucherTimeMode;
  startDate: string;
  endDate: string;
  startPeriod: VoucherPeriod | null;
  endPeriod: VoucherPeriod | null;
}

export const EMPTY_TIME_FILTER: VoucherTimeFilterState = {
  mode: 'period',
  startDate: '',
  endDate: '',
  startPeriod: null,
  endPeriod: null
};

const TIME_FILTER_STORAGE_KEY = 'erp_voucher_time_filter';

function isValidPeriod(value: unknown): value is VoucherPeriod {
  if (!value || typeof value !== 'object') return false;
  const period = value as VoucherPeriod;
  return (
    Number.isFinite(period.year) &&
    Number.isFinite(period.month) &&
    period.month >= 1 &&
    period.month <= 12
  );
}

function normalizeStoredTimeFilter(raw: Partial<VoucherTimeFilterState>): VoucherTimeFilterState | null {
  if (raw.mode !== 'date' && raw.mode !== 'period') return null;

  const startDate = typeof raw.startDate === 'string' ? raw.startDate : '';
  const endDate = typeof raw.endDate === 'string' ? raw.endDate : '';
  const startPeriod = isValidPeriod(raw.startPeriod) ? raw.startPeriod : null;
  const endPeriod = isValidPeriod(raw.endPeriod) ? raw.endPeriod : null;

  if (raw.mode === 'period') {
    if (startPeriod && endPeriod) {
      const range = periodsToDateRange(startPeriod, endPeriod);
      return {
        mode: 'period',
        startDate: range.startDate,
        endDate: range.endDate,
        startPeriod: range.startPeriod,
        endPeriod: range.endPeriod
      };
    }
    if (startDate && endDate) {
      const periods = datesToPeriods(startDate, endDate);
      return {
        mode: 'period',
        startDate,
        endDate,
        startPeriod: periods.startPeriod,
        endPeriod: periods.endPeriod
      };
    }
    return null;
  }

  if (!startDate || !endDate) return null;
  const periods = datesToPeriods(startDate, endDate);
  return {
    mode: 'date',
    startDate,
    endDate,
    startPeriod: periods.startPeriod,
    endPeriod: periods.endPeriod
  };
}

export function clampPeriodToNow(period: VoucherPeriod): VoucherPeriod {
  return isFuturePeriod(period) ? currentPeriod() : period;
}

export function clampTimeFilterStateToNow(state: VoucherTimeFilterState): VoucherTimeFilterState {
  if (state.mode === 'date') {
    if (!state.startDate || !state.endDate) return state;
    const startDate = clampDateToToday(dayjs(state.startDate)).format('YYYY-MM-DD');
    const endDate = clampDateToToday(dayjs(state.endDate)).format('YYYY-MM-DD');
    if (startDate === state.startDate && endDate === state.endDate) return state;
    const periods = datesToPeriods(startDate, endDate);
    return { ...state, startDate, endDate, startPeriod: periods.startPeriod, endPeriod: periods.endPeriod };
  }
  if (state.startPeriod && state.endPeriod) {
    let start = clampPeriodToNow(state.startPeriod);
    let end = clampPeriodToNow(state.endPeriod);
    [start, end] = normalizePeriodRange(start, end);
    const range = periodsToDateRange(start, end);
    if (
      comparePeriod(start, state.startPeriod) === 0 &&
      comparePeriod(end, state.endPeriod) === 0 &&
      state.startDate === range.startDate &&
      state.endDate === range.endDate
    ) {
      return state;
    }
    return {
      mode: 'period',
      startDate: range.startDate,
      endDate: range.endDate,
      startPeriod: range.startPeriod,
      endPeriod: range.endPeriod
    };
  }
  return state;
}

/** 从 localStorage 读取上次凭证管理的时间筛选；无效时回退默认（当前月）。 */
export function loadStoredTimeFilter(): VoucherTimeFilterState {
  try {
    const raw = localStorage.getItem(TIME_FILTER_STORAGE_KEY);
    if (!raw) return defaultTimeFilter();
    const parsed = JSON.parse(raw) as Partial<VoucherTimeFilterState>;
    const normalized = normalizeStoredTimeFilter(parsed) ?? defaultTimeFilter();
    return clampTimeFilterStateToNow(normalized);
  } catch {
    return defaultTimeFilter();
  }
}

export function saveStoredTimeFilter(state: VoucherTimeFilterState): void {
  try {
    localStorage.setItem(TIME_FILTER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 存储失败时不影响查询
  }
}

/** 默认按期间筛选，且选中最近一期（当前月） */
export function defaultTimeFilter(): VoucherTimeFilterState {
  const period = currentPeriod();
  const range = periodsToDateRange(period, period);
  return {
    mode: 'period',
    startDate: range.startDate,
    endDate: range.endDate,
    startPeriod: range.startPeriod,
    endPeriod: range.endPeriod
  };
}

export function currentPeriod(): VoucherPeriod {
  const now = dayjs();
  return { year: now.year(), month: now.month() + 1 };
}

export function isFuturePeriod(period: VoucherPeriod): boolean {
  return comparePeriod(period, currentPeriod()) > 0;
}

export function clampDateToToday(date: Dayjs): Dayjs {
  return clampDayjsToToday(date) as Dayjs;
}

export function periodToDayjs(period: VoucherPeriod): Dayjs {
  return dayjs(`${period.year}-${String(period.month).padStart(2, '0')}-01`);
}

export function comparePeriod(a: VoucherPeriod, b: VoucherPeriod): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

export function normalizePeriodRange(
  start: VoucherPeriod,
  end: VoucherPeriod
): [VoucherPeriod, VoucherPeriod] {
  return comparePeriod(start, end) <= 0 ? [start, end] : [end, start];
}

export function periodsToDateRange(start: VoucherPeriod, end: VoucherPeriod) {
  const [lo, hi] = normalizePeriodRange(start, end);
  return {
    startDate: periodToDayjs(lo).startOf('month').format('YYYY-MM-DD'),
    endDate: periodToDayjs(hi).endOf('month').format('YYYY-MM-DD'),
    startPeriod: lo,
    endPeriod: hi
  };
}

export function datesToPeriods(startDate: string, endDate: string) {
  const start = dayjs(startDate);
  const end = dayjs(endDate);
  return {
    startPeriod: { year: start.year(), month: start.month() + 1 },
    endPeriod: { year: end.year(), month: end.month() + 1 }
  };
}

export function formatPeriod(period: VoucherPeriod): string {
  return `${period.year}年${String(period.month).padStart(2, '0')}期`;
}

export function formatPeriodRange(start: VoucherPeriod | null, end: VoucherPeriod | null): string {
  if (!start || !end) return '';
  const [lo, hi] = normalizePeriodRange(start, end);
  return `${formatPeriod(lo)} ~ ${formatPeriod(hi)}`;
}

export function formatDateRange(startDate: string, endDate: string): string {
  if (!startDate || !endDate) return '';
  return `${startDate} ~ ${endDate}`;
}

export function getTimeFilterDisplay(state: VoucherTimeFilterState): string {
  if (state.mode === 'period') {
    if (state.startPeriod && state.endPeriod) {
      return formatPeriodRange(state.startPeriod, state.endPeriod);
    }
    if (state.startDate && state.endDate) {
      const { startPeriod, endPeriod } = datesToPeriods(state.startDate, state.endDate);
      return formatPeriodRange(startPeriod, endPeriod);
    }
    return '不限';
  }
  return formatDateRange(state.startDate, state.endDate) || '不限';
}

export function resolveTimeFilterQuery(state: VoucherTimeFilterState): {
  startDate: string;
  endDate: string;
} {
  if (state.mode === 'period' && state.startPeriod && state.endPeriod) {
    return periodsToDateRange(state.startPeriod, state.endPeriod);
  }
  return { startDate: state.startDate, endDate: state.endDate };
}

export type DateShortcutKey = 'today' | 'currentPeriod' | 'lastPeriod' | 'thisMonth' | 'lastMonth' | 'thisYear';
export type PeriodShortcutKey = 'currentPeriod' | 'lastPeriod' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'lastYear';

export function applyDateShortcut(key: DateShortcutKey): { start: Dayjs; end: Dayjs } {
  const now = dayjs();
  switch (key) {
    case 'today':
      return { start: now.startOf('day'), end: now.endOf('day') };
    case 'currentPeriod':
    case 'thisMonth':
      return { start: now.startOf('month'), end: now.endOf('month') };
    case 'lastPeriod':
    case 'lastMonth': {
      const prev = now.subtract(1, 'month');
      return { start: prev.startOf('month'), end: prev.endOf('month') };
    }
    case 'thisYear':
      return { start: now.startOf('year'), end: now.endOf('day') };
    default:
      return { start: now.startOf('month'), end: now.endOf('month') };
  }
}

export function applyPeriodShortcut(key: PeriodShortcutKey): [VoucherPeriod, VoucherPeriod] {
  const now = dayjs();
  const year = now.year();
  const month = now.month() + 1;

  switch (key) {
    case 'currentPeriod':
    case 'thisMonth':
      return [{ year, month }, { year, month }];
    case 'lastPeriod':
    case 'lastMonth': {
      const prev = now.subtract(1, 'month');
      return [{ year: prev.year(), month: prev.month() + 1 }, { year: prev.year(), month: prev.month() + 1 }];
    }
    case 'thisYear':
      return [{ year, month: 1 }, { year, month }];
    case 'lastYear':
      return [{ year: year - 1, month: 1 }, { year: year - 1, month: 12 }];
    default:
      return [{ year, month }, { year, month }];
  }
}
