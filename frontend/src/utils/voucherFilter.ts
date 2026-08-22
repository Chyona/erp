/** 解析逗号分隔或范围表达式，如 1, 3, 5-7 */
export function parseNumberRanges(text: string): number[] | null {
  const raw = String(text || '').trim();
  if (!raw) return null;

  const result = new Set<number>();
  for (const part of raw.split(/[,，]/)) {
    const segment = part.trim();
    if (!segment) continue;

    if (segment.includes('-')) {
      const [startText, endText] = segment.split('-');
      const start = parseInt(startText.replace(/\D/g, ''), 10);
      const end = parseInt(endText.replace(/\D/g, ''), 10);
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
      const lo = Math.min(start, end);
      const hi = Math.max(start, end);
      for (let n = lo; n <= hi; n++) result.add(n);
    } else {
      const num = parseInt(segment.replace(/\D/g, ''), 10);
      if (Number.isFinite(num)) result.add(num);
    }
  }

  return result.size ? [...result] : null;
}

/** 解析科目编码范围，如 1001, 1009, 2121-2131 */
export function parseCodeRanges(text: string): string[] | null {
  const raw = String(text || '').trim();
  if (!raw) return null;

  const result = new Set<string>();
  for (const part of raw.split(/[,，]/)) {
    const segment = part.trim();
    if (!segment) continue;

    if (segment.includes('-')) {
      const [startText, endText] = segment.split('-');
      const start = parseInt(startText.replace(/\D/g, ''), 10);
      const end = parseInt(endText.replace(/\D/g, ''), 10);
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
      const lo = Math.min(start, end);
      const hi = Math.max(start, end);
      const width = Math.max(startText.replace(/\D/g, '').length, endText.replace(/\D/g, '').length);
      for (let n = lo; n <= hi; n++) {
        result.add(String(n).padStart(width, '0'));
      }
    } else {
      result.add(segment.replace(/\s/g, ''));
    }
  }

  return result.size ? [...result] : null;
}

export function parseVoucherNum(value: string | number | undefined) {
  return parseInt(String(value || '').replace(/\D/g, ''), 10) || 0;
}

export function matchSignatory(
  voucher: {
    preparedBy?: string;
    reviewedBy?: string;
    postedBy?: string;
    cashierBy?: string;
  },
  keyword: string
) {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return true;
  const fields = [voucher.preparedBy, voucher.reviewedBy, voucher.postedBy, voucher.cashierBy];
  return fields.some((value) => value && value.toLowerCase().includes(kw));
}

export function matchVoucherAmount(
  voucher: { totalDebit?: number; totalCredit?: number; entries?: { debit?: string | number; credit?: string | number }[] },
  min?: number | string,
  max?: number | string
) {
  const minVal = min === '' || min == null ? null : parseFloat(String(min));
  const maxVal = max === '' || max == null ? null : parseFloat(String(max));
  if (minVal == null && maxVal == null) return true;

  const amounts = [
    voucher.totalDebit || 0,
    voucher.totalCredit || 0,
    ...(voucher.entries || []).flatMap((e) => [parseFloat(String(e.debit)) || 0, parseFloat(String(e.credit)) || 0])
  ].filter((n) => n > 0);

  if (!amounts.length) return false;

  return amounts.some((amount) => {
    if (minVal != null && amount < minVal) return false;
    if (maxVal != null && amount > maxVal) return false;
    return true;
  });
}
