import { formatReportAmount } from '../utils/reportAmount.js';

function SideCells({ side, record }) {
  const type = record[`${side}Type`];
  const label = record[`${side}Label`];
  const row = record[`${side}Row`];
  const ending = record[`${side}Ending`];
  const opening = record[`${side}Opening`];

  if (!type) {
    return (
      <>
        <td className="balance-sheet-view__label" />
        <td className="balance-sheet-view__index" />
        <td className="balance-sheet-view__amount" />
        <td className="balance-sheet-view__amount balance-sheet-view__amount--year" />
      </>
    );
  }

  if (type === 'spacer') {
    return (
      <>
        <td className="balance-sheet-view__label" />
        <td className="balance-sheet-view__index" />
        <td className="balance-sheet-view__amount" />
        <td className="balance-sheet-view__amount balance-sheet-view__amount--year" />
      </>
    );
  }

  if (type === 'section') {
    return (
      <>
        <td className="balance-sheet-view__label balance-sheet-view__label--section">{label}</td>
        <td className="balance-sheet-view__index" />
        <td className="balance-sheet-view__amount" />
        <td className="balance-sheet-view__amount balance-sheet-view__amount--year" />
      </>
    );
  }

  const isTotalRow = type === 'subtotal' || type === 'total';

  const labelClass = [
    'balance-sheet-view__label',
    type === 'detail' ? 'balance-sheet-view__label--detail' : '',
    isTotalRow ? 'balance-sheet-view__label--total' : ''
  ]
    .filter(Boolean)
    .join(' ');

  const indexClass = [
    'balance-sheet-view__index',
    isTotalRow ? 'balance-sheet-view__index--total' : ''
  ]
    .filter(Boolean)
    .join(' ');

  const amountClass = (extra = '') =>
    ['balance-sheet-view__amount', extra, isTotalRow ? 'balance-sheet-view__amount--total' : '']
      .filter(Boolean)
      .join(' ');

  return (
    <>
      <td className={labelClass}>{label}</td>
      <td className={indexClass}>{row ?? ''}</td>
      <td className={amountClass()}>{formatReportAmount(ending)}</td>
      <td className={amountClass('balance-sheet-view__amount--year')}>
        {formatReportAmount(opening)}
      </td>
    </>
  );
}

export default function BalanceSheetView({ rows = [] }) {
  return (
    <div className="balance-sheet-view">
      <table className="balance-sheet-view__table">
        <thead>
          <tr>
            <th className="balance-sheet-view__th balance-sheet-view__th--label">资产</th>
            <th className="balance-sheet-view__th balance-sheet-view__th--index">行次</th>
            <th className="balance-sheet-view__th balance-sheet-view__th--amount">期末余额</th>
            <th className="balance-sheet-view__th balance-sheet-view__th--amount balance-sheet-view__th--split">
              年初余额
            </th>
            <th className="balance-sheet-view__th balance-sheet-view__th--label">
              负债和所有者权益（或股东权益）
            </th>
            <th className="balance-sheet-view__th balance-sheet-view__th--index">行次</th>
            <th className="balance-sheet-view__th balance-sheet-view__th--amount">期末余额</th>
            <th className="balance-sheet-view__th balance-sheet-view__th--amount">年初余额</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((record) => (
            <tr key={record.key} className="balance-sheet-view__row">
              <SideCells side="asset" record={record} />
              <SideCells side="liability" record={record} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
