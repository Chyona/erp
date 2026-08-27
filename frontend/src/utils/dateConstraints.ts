import dayjs, { type Dayjs } from './dayjsSetup';

export function todayDayjs(): Dayjs {
  return dayjs().startOf('day');
}

export function isFutureDate(date: Dayjs): boolean {
  return date.startOf('day').isAfter(todayDayjs(), 'day');
}

/** Ant Design DatePicker / Calendar disabledDate */
export function disableFutureDate(date: Dayjs): boolean {
  return isFutureDate(date);
}

export function clampDayjsToToday(date: Dayjs | null | undefined): Dayjs | null | undefined {
  if (!date) return date;
  return isFutureDate(date) ? todayDayjs() : date;
}

export function clampDateRangeToToday(
  range: [Dayjs, Dayjs] | null | undefined
): [Dayjs, Dayjs] | null | undefined {
  if (!range) return range;
  const today = todayDayjs();
  let [start, end] = range;
  if (isFutureDate(start)) start = today;
  if (isFutureDate(end)) end = today;
  if (end.isBefore(start, 'day')) {
    return [start, start];
  }
  return [start, end];
}

export function currentMonthStart(): Dayjs {
  return dayjs().startOf('month');
}

export function isFutureMonth(date: Dayjs): boolean {
  return date.startOf('month').isAfter(currentMonthStart(), 'month');
}

/** Ant Design month picker disabledDate */
export function disableFutureMonth(date: Dayjs): boolean {
  return isFutureMonth(date);
}

export function clampMonthToToday(date: Dayjs): Dayjs {
  return isFutureMonth(date) ? currentMonthStart() : date.startOf('month');
}

export function clampMonthRangeToToday(
  range: [Dayjs, Dayjs] | null | undefined
): [Dayjs, Dayjs] | null | undefined {
  if (!range) return range;
  const currentMonth = currentMonthStart();
  let [start, end] = range.map((value) => value.startOf('month')) as [Dayjs, Dayjs];
  if (isFutureMonth(start)) start = currentMonth;
  if (isFutureMonth(end)) end = currentMonth;
  if (end.isBefore(start, 'month')) {
    return [start, start];
  }
  return [start, end];
}
