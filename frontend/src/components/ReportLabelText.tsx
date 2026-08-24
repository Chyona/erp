type ReportLabelTextProps = {
  type?: string;
  label?: string;
  total?: boolean;
  showSectionStyle?: boolean;
  variant?: 'income-statement' | 'balance-sheet';
};

function isIncomeStatementPrimaryItem(label: string) {
  return /^[一二三四]、/.test(label) || /^[加减]：/.test(label);
}

export function reportLabelIndentClass(
  type?: string,
  label?: string,
  variant: 'income-statement' | 'balance-sheet' = 'balance-sheet'
) {
  if (type === 'detail' && label) {
    return label.startsWith('其中：')
      ? 'report-label-text--indent-2'
      : 'report-label-text--indent-3';
  }

  if (variant === 'income-statement' && type === 'item' && label && !isIncomeStatementPrimaryItem(label)) {
    return 'report-label-text--indent-1';
  }

  if (variant === 'balance-sheet' && (type === 'item' || type === 'calc') && label) {
    return 'report-label-text--indent-1';
  }

  return '';
}

export default function ReportLabelText({
  type,
  label = '',
  total = false,
  showSectionStyle = false,
  variant = 'balance-sheet'
}: ReportLabelTextProps) {
  const emphasisClass = total
    ? 'report-label-text--total'
    : type === 'section' || (showSectionStyle && /^[一二三四]、/.test(label))
      ? 'report-label-text--section'
      : '';

  return (
    <span
      className={[
        'report-label-text',
        reportLabelIndentClass(type, label, variant),
        emphasisClass
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {label}
    </span>
  );
}