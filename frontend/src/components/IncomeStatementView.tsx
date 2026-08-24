import { useRef } from 'react';
import { useTableHeaderGutter } from '../hooks/useTableHeaderGutter';
import CopyableReportAmount from './CopyableReportAmount';
import ReportLabelText from './ReportLabelText';
import { reportViewRowProps } from '../utils/tableRowGroup';

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
              {rows.map((row, index) => {
                const totalRow = isTotalRow(row.type, row.label);
                return (
                  <tr key={row.key} {...reportViewRowProps(index, row)}>
                    <td className="report-view__label-cell">
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
                        'report-view__index',
                        totalRow ? 'report-view__index--total' : ''
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {row.row ?? ''}
                    </td>
                    <td
                      className={[
                        'report-view__amount',
                        totalRow ? 'report-view__amount--total' : '',
                        row.periodDraft ? 'report-page__draft-amount' : ''
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <CopyableReportAmount value={row.periodAmount} />
                    </td>
                    <td
                      className={[
                        'report-view__amount',
                        totalRow ? 'report-view__amount--total' : '',
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
