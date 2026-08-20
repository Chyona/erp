export function formatReportAmount(value) {
  if (value == null || Math.abs(Number(value)) < 0.005) return '';
  const number = Number(value);
  const formatted = Math.abs(number).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return number < 0 ? `-${formatted}` : formatted;
}
