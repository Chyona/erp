import { useRef } from 'react';
import { useTableHeaderGutter } from '../hooks/useTableHeaderGutter';
import CopyableReportAmount from './CopyableReportAmount';
import ReportLabelText from './ReportLabelText';

function isTotalRow(type, label) {
  return type === 'calc' || /合计|总计/.test(label || '');
}

function IncomeStatementColGroup() {
  return (
    <colgroup>
      <col className="income-statement-view__col income-statement-view__col--label" />
      <col className="income-statement-view__col income-statement-view__col--index" />
      <col className="income-statement-view__col income-statement-view__col--amount" />
      <col className="income-statement-view__col income-statement-view__col--amount" />
      <col className="income-statement-view__col income-statement-view__col--fill" />
    </colgroup>
  );
}

export default function IncomeStatementView({ rows = [] }) {
  const viewRef = useRef<HTMLDivElement>(null);
  useTableHeaderGutter(viewRef, true, [rows.length]);

  return (
    <div className="income-statement-view" ref={viewRef}>
      <div className="income-statement-view__scroll">
        <div className="income-statement-view__head">
          <table className="income-statement-view__table">
            <IncomeStatementColGroup />
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
            <IncomeStatementColGroup />
            <tbody>
              {rows.map((row) => {
                const totalRow = isTotalRow(row.type, row.label);
                return (
                  <tr key={row.key} className="income-statement-view__row">
                    <td
                      className={[
                        'income-statement-view__label',
                        totalRow ? 'income-statement-view__label--total' : ''
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <ReportLabelText
                        type={row.type}
                        label={row.label}
                        total={totalRow}
                        showSectionStyle
                        variant="income-statement"
                      />
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
                      <CopyableReportAmount value={row.periodAmount} />
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
                      <CopyableReportAmount value={row.ytdAmount} />
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
