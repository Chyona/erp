import { useRef } from 'react';
import { useTableHeaderGutter } from '../hooks/useTableHeaderGutter';
import { formatReportAmount } from '../utils/reportAmount';

function BalanceSheetColGroup() {
  return (
    <colgroup>
      <col className="balance-sheet-view__col balance-sheet-view__col--label" />
      <col className="balance-sheet-view__col balance-sheet-view__col--index" />
      <col className="balance-sheet-view__col balance-sheet-view__col--amount" />
      <col className="balance-sheet-view__col balance-sheet-view__col--amount" />
      <col className="balance-sheet-view__col balance-sheet-view__col--label balance-sheet-view__col--split" />
      <col className="balance-sheet-view__col balance-sheet-view__col--index" />
      <col className="balance-sheet-view__col balance-sheet-view__col--amount" />
      <col className="balance-sheet-view__col balance-sheet-view__col--amount" />
      <col className="balance-sheet-view__col balance-sheet-view__col--fill" />
    </colgroup>
  );
}
function SideCells({ side, record }) {
  const type = record[`${side}Type`];
  const label = record[`${side}Label`];
  const row = record[`${side}Row`];
  const ending = record[`${side}Ending`];
  const opening = record[`${side}Opening`];

  const labelSplitClass =
    side === 'liability' ? 'balance-sheet-view__label--split' : '';

  if (!type) {
    return (
      <>
        <td className={`balance-sheet-view__label ${labelSplitClass}`.trim()} />
        <td className="balance-sheet-view__index" />
        <td className="balance-sheet-view__amount" />
        <td className="balance-sheet-view__amount balance-sheet-view__amount--year" />
      </>
    );
  }

  if (type === 'spacer') {
    return (
      <>
        <td className={`balance-sheet-view__label ${labelSplitClass}`.trim()} />
        <td className="balance-sheet-view__index" />
        <td className="balance-sheet-view__amount" />
        <td className="balance-sheet-view__amount balance-sheet-view__amount--year" />
      </>
    );
  }

  if (type === 'section') {
    return (
      <>
        <td
          className={`balance-sheet-view__label balance-sheet-view__label--section ${labelSplitClass}`
            .trim()}
        >
          {label}
        </td>
        <td className="balance-sheet-view__index" />
        <td className="balance-sheet-view__amount" />
        <td className="balance-sheet-view__amount balance-sheet-view__amount--year" />
      </>
    );
  }

  const isTotalRow = type === 'subtotal' || type === 'total';

  const labelClass = [
    'balance-sheet-view__label',
    labelSplitClass,
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

  const amountClass = (extra = '', draft = false) =>
    [
      'balance-sheet-view__amount',
      extra,
      isTotalRow ? 'balance-sheet-view__amount--total' : '',
      draft ? 'report-page__draft-amount' : ''
    ]
      .filter(Boolean)
      .join(' ');

  return (
    <>
      <td className={labelClass}>{label}</td>
      <td className={indexClass}>{row ?? ''}</td>
      <td className={amountClass('', record[`${side}EndingDraft`])}>
        {formatReportAmount(ending)}
      </td>
      <td className={amountClass('balance-sheet-view__amount--year', record[`${side}OpeningDraft`])}>
        {formatReportAmount(opening)}
      </td>
    </>
  );
}

export default function BalanceSheetView({ rows = [] }) {
  const viewRef = useRef<HTMLDivElement>(null);
  useTableHeaderGutter(viewRef, true, [rows.length]);

  return (
    <div className="balance-sheet-view" ref={viewRef}>
      <div className="balance-sheet-view__scroll">
        <div className="balance-sheet-view__head">
          <table className="balance-sheet-view__table">
            <BalanceSheetColGroup />
            <thead>
              <tr>
                <th className="balance-sheet-view__th balance-sheet-view__th--label">资产</th>
                <th className="balance-sheet-view__th balance-sheet-view__th--index">行次</th>
                <th className="balance-sheet-view__th balance-sheet-view__th--amount">期末余额</th>
                <th className="balance-sheet-view__th balance-sheet-view__th--amount">年初余额</th>
                <th className="balance-sheet-view__th balance-sheet-view__th--label balance-sheet-view__th--split">
                  负债和所有者权益（或股东权益）
                </th>
                <th className="balance-sheet-view__th balance-sheet-view__th--index">行次</th>
                <th className="balance-sheet-view__th balance-sheet-view__th--amount">期末余额</th>
                <th className="balance-sheet-view__th balance-sheet-view__th--amount">年初余额</th>
                <th className="balance-sheet-view__th balance-sheet-view__th--fill" />
              </tr>
            </thead>
          </table>
        </div>
        <div className="balance-sheet-view__body">
          <table className="balance-sheet-view__table">
            <BalanceSheetColGroup />
            <tbody>
              {rows.map((record) => (
                <tr key={record.key} className="balance-sheet-view__row">
                  <SideCells side="asset" record={record} />
                  <SideCells side="liability" record={record} />
                  <td className="balance-sheet-view__fill" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
