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
