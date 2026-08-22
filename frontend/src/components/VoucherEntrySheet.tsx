import { DatePicker, Input, Select, Space, Tooltip } from 'antd';
import { clampDayjsToToday, disableFutureDate } from '../utils/dateConstraints';
import {
  CopyOutlined,
  MinusCircleOutlined,
  PlusCircleOutlined
} from '@ant-design/icons';
import AmountGrid, { AmountGridHeader } from './AmountGrid';
import VoucherAttachmentColumn from './VoucherAttachmentColumn';
import VoucherAttachmentControls from './VoucherAttachmentControls';
import { amountToChineseUppercase, formatAccountingPeriod } from '../utils/amountGrid';
import { Accounts } from '../services/accounts';

const MIN_ROWS = 4;

function VoucherEntrySheet({
  voucherType,
  voucherNumber,
  voucherDate,
  onDateChange,
  entries,
  accounts,
  totals,
  attachments = [],
  attachmentsCount,
  signatory,
  onUpdateEntry,
  onInsertEntryAfter,
  onCopyEntry,
  onRemoveEntry,
  onUpload,
  onRemoveAttachment,
  onRemoveAttachments,
  attachmentPanelOpen,
  onAttachmentPanelClose,
  onAttachmentPanelToggle,
  canModifyAttachments = true,
  readOnly = false,
  redLetter = false,
  reviewedBy = '',
  businessTypeField,
  accountingPeriodLabel,
  dateReadOnly = false,
  footerActions
}) {
  const rowCount = Math.max(entries.length, MIN_ROWS);
  const period = accountingPeriodLabel || formatAccountingPeriod(voucherDate);
  const totalAmount = Math.max(totals.debit, totals.credit);

  return (
    <div className={`voucher-sheet${readOnly ? ' voucher-sheet--readonly' : ''}${redLetter ? ' voucher-sheet--red-letter' : ''}`}>
      {readOnly && (
        <div className="voucher-sheet__stamp" aria-hidden="true">
          已审核
        </div>
      )}
      <div className="voucher-sheet__main">
        <div className="voucher-sheet__meta voucher-sheet__meta-row voucher-sheet__meta--above-table">
          <div className="voucher-sheet__meta-left">
            <Space size={16} wrap align="center">
              <Space size={4}>
                <span className="voucher-sheet__meta-label">凭证字</span>
                <Input value={voucherType} readOnly className="voucher-sheet__type-input" />
                <Input
                  value={voucherNumber}
                  readOnly
                  className="voucher-sheet__no-input"
                  suffix="号"
                />
              </Space>
              <Space size={4}>
                <span className="voucher-sheet__meta-label">日期</span>
                <DatePicker
                  value={voucherDate}
                  onChange={(date) => onDateChange(clampDayjsToToday(date) ?? date)}
                  allowClear={false}
                  disabled={readOnly || dateReadOnly}
                  disabledDate={disableFutureDate}
                  className="voucher-sheet__date"
                />
              </Space>
              {businessTypeField}
            </Space>
          </div>
          <div className="voucher-sheet__meta-center">
            <div className="voucher-sheet__title">记 账 凭 证</div>
            {period && <div className="voucher-sheet__period">{period}</div>}
          </div>
          <div className="voucher-sheet__meta-right voucher-sheet__meta-right--compact">
            <VoucherAttachmentControls
              attachmentsCount={attachmentsCount}
              onToggle={onAttachmentPanelToggle}
              onUpload={onUpload}
              canModify={canModifyAttachments}
              className="voucher-sheet__attach-row--compact"
            />
          </div>
        </div>

        <div className="voucher-sheet__table-layout">
          <div className="voucher-sheet__table-wrap">
            <table className="voucher-sheet__table">
              <thead>
                <tr>
                  <th rowSpan={2} className="voucher-sheet__th-index">
                    #
                  </th>
                  <th rowSpan={2} className="voucher-sheet__th-summary">
                    摘要
                  </th>
                  <th rowSpan={2} className="voucher-sheet__th-account">
                    科目
                  </th>
                  <th colSpan={11} className="voucher-sheet__th-amount-group">
                    借方金额
                  </th>
                  <th colSpan={11} className="voucher-sheet__th-amount-group">
                    贷方金额
                  </th>
                </tr>
                <tr>
                  <th colSpan={11} className="voucher-sheet__th-units">
                    <AmountGridHeader />
                  </th>
                  <th colSpan={11} className="voucher-sheet__th-units">
                    <AmountGridHeader />
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: rowCount }, (_, index) => {
                  const entry = entries[index];
                  const isPad = !entry;
                  return (
                    <tr key={entry?.key || `pad-${index}`} className={isPad ? 'voucher-sheet__row--pad' : ''}>
                      <td className="voucher-sheet__td-index">
                        <span className="voucher-sheet__row-no">{index + 1}</span>
                        {!readOnly && (
                          <div className="voucher-sheet__row-actions">
                            <Tooltip title="增行">
                              <button
                                type="button"
                                className="voucher-sheet__row-action"
                                onClick={() => onInsertEntryAfter?.(index)}
                              >
                                <PlusCircleOutlined />
                              </button>
                            </Tooltip>
                            {!isPad && (
                              <>
                                <Tooltip title="复制">
                                  <button
                                    type="button"
                                    className="voucher-sheet__row-action"
                                    onClick={() => onCopyEntry?.(index)}
                                  >
                                    <CopyOutlined />
                                  </button>
                                </Tooltip>
                                <Tooltip title="删除">
                                  <button
                                    type="button"
                                    className="voucher-sheet__row-action voucher-sheet__row-action--danger"
                                    onClick={() => onRemoveEntry?.(index)}
                                    disabled={entries.length <= 1}
                                  >
                                    <MinusCircleOutlined />
                                  </button>
                                </Tooltip>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="voucher-sheet__td-summary">
                        {!isPad &&
                          (readOnly ? (
                            <span className="voucher-sheet__readonly-text">{entry.summary || ''}</span>
                          ) : (
                            <Input
                              variant="borderless"
                              value={entry.summary}
                              placeholder="摘要"
                              onChange={(e) => onUpdateEntry(index, 'summary', e.target.value)}
                            />
                          ))}
                      </td>
                      <td className="voucher-sheet__td-account">
                        {!isPad &&
                          (readOnly ? (
                            <span className="voucher-sheet__readonly-text">
                              {[entry.accountCode, entry.accountName].filter(Boolean).join(' ') || ''}
                            </span>
                          ) : (
                            <Select
                              variant="borderless"
                              showSearch
                              placeholder="选择科目"
                              style={{ width: '100%' }}
                              value={entry.accountId || undefined}
                              optionFilterProp="label"
                              onChange={(v) => onUpdateEntry(index, 'accountId', v)}
                              options={accounts.map((a) => ({
                                value: a.id,
                                label: Accounts.formatAccountOption(a)
                              }))}
                            />
                          ))}
                      </td>
                      <td colSpan={11} className="voucher-sheet__td-amount">
                        {!isPad && (
                          <AmountGrid
                            value={entry.debit}
                            onChange={(v) => onUpdateEntry(index, 'debit', v)}
                            readOnly={readOnly}
                            redLetter={redLetter}
                          />
                        )}
                      </td>
                      <td colSpan={11} className="voucher-sheet__td-amount">
                        {!isPad && (
                          <AmountGrid
                            value={entry.credit}
                            onChange={(v) => onUpdateEntry(index, 'credit', v)}
                            readOnly={readOnly}
                            redLetter={redLetter}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="voucher-sheet__total-row">
                  <td colSpan={3} className="voucher-sheet__total-label">
                    <span className="voucher-sheet__total-text">合计</span>
                    <span
                      className={`voucher-sheet__total-cn${redLetter ? ' voucher-sheet__total-cn--red' : ''}`}
                    >
                      {amountToChineseUppercase(totalAmount, redLetter)}
                    </span>
                  </td>
                  <td colSpan={11} className="voucher-sheet__td-amount">
                    <AmountGrid value={totals.debit} readOnly redLetter={redLetter} />
                  </td>
                  <td colSpan={11} className="voucher-sheet__td-amount">
                    <AmountGrid value={totals.credit} readOnly redLetter={redLetter} />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <VoucherAttachmentColumn
            attachments={attachments}
            open={attachmentPanelOpen}
            onClose={onAttachmentPanelClose}
            onRemove={onRemoveAttachment}
            onRemoveMany={onRemoveAttachments}
            onUpload={onUpload}
            canModify={canModifyAttachments}
          />
        </div>
      </div>

      <div className="voucher-sheet__footer">
        <div className="voucher-sheet__footer-left">
          <Space size={32} wrap>
            <Space size={4}>
              <span className="voucher-sheet__meta-label">制单人</span>
              <span className="voucher-sheet__footer-value">{signatory || '—'}</span>
            </Space>
            <Space size={4}>
              <span className="voucher-sheet__meta-label">审核人</span>
              <span className="voucher-sheet__footer-value">{reviewedBy || '—'}</span>
            </Space>
          </Space>
        </div>
        {footerActions && (
          <div className="voucher-sheet__footer-actions">{footerActions}</div>
        )}
      </div>
    </div>
  );
}

export default VoucherEntrySheet;
