import { useRef } from 'react';
import { useTableHeaderGutter } from '../hooks/useTableHeaderGutter';
import { formatReportAmount } from '../utils/reportAmount';

function labelClass(type, label) {
  if (type === 'detail') {
    return label.startsWith('其中：')
      ? 'income-statement-view__label--detail'
      : 'income-statement-view__label--detail-sub';
  }
  if (/^[一二三四]、/.test(label)) {
    return 'income-statement-view__label--section';
  }
  return '';
}

function isTotalRow(type, label) {
  return type === 'calc' || /合计|总计/.test(label || '');
}

export default function IncomeStatementView({ rows = [] }) {
  const viewRef = useRef<HTMLDivElement>(null);
  useTableHeaderGutter(viewRef, true, [rows.length]);

  return (
    <div className="income-statement-view" ref={viewRef}>
      <div className="income-statement-view__scroll">
        <div className="income-statement-view__head">
          <table className="income-statement-view__table">
            <thead>
              <tr>
                <th className="income-statement-view__th income-statement-view__th--label">项目</th>
                <th className="income-statement-view__th income-statement-view__th--index">行次</th>
                <th className="income-statement-view__th income-statement-view__th--amount">本期金额</th>
                <th className="income-statement-view__th income-statement-view__th--amount">
                  本年累计金额
                </th>
                <th className="income-statement-view__th income-statement-view__th--fill" />
              </tr>
            </thead>
          </table>
        </div>
        <div className="income-statement-view__body">
          <table className="income-statement-view__table">
            <tbody>
              {rows.map((row) => {
                const totalRow = isTotalRow(row.type, row.label);
                return (
                  <tr key={row.key} className="income-statement-view__row">
                    <td
                      className={[
                        'income-statement-view__label',
                        labelClass(row.type, row.label),
                        totalRow ? 'income-statement-view__label--total' : ''
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {row.label}
                    </td>
                    <td
                      className={[
                        'income-statement-view__index',
                        totalRow ? 'income-statement-view__index--total' : ''
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {row.row ?? ''}
                    </td>
                    <td
                      className={[
                        'income-statement-view__amount',
                        totalRow ? 'income-statement-view__amount--total' : '',
                        row.periodDraft ? 'report-page__draft-amount' : ''
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {formatReportAmount(row.periodAmount)}
                    </td>
                    <td
                      className={[
                        'income-statement-view__amount',
                        totalRow ? 'income-statement-view__amount--total' : '',
                        row.ytdDraft ? 'report-page__draft-amount' : ''
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {formatReportAmount(row.ytdAmount)}
                    </td>
                    <td className="income-statement-view__fill" />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
