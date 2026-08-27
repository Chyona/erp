import { useState } from 'react';
import { DatePicker, Input, Select, Space, Tooltip } from 'antd';
import { clampDayjsToToday, disableFutureDate } from '../utils/dateConstraints';
import {
  CopyOutlined,
  MinusCircleOutlined,
  PlusCircleOutlined
} from '@ant-design/icons';
import AmountGrid, { AmountGridHeader } from './AmountGrid';
import EllipsisText from './EllipsisText';
import VoucherAttachmentColumn from './VoucherAttachmentColumn';
import VoucherAttachmentControls from './VoucherAttachmentControls';
import VoucherPhraseAutoComplete from './VoucherPhraseAutoComplete';
import { amountToChineseUppercase, formatAccountingPeriod } from '../utils/amountGrid';
import { Accounts } from '../services/accounts';

const MIN_ROWS = 4;

function VoucherTableColgroup() {
  return (
    <colgroup>
      <col className="voucher-sheet__col-index" />
      <col className="voucher-sheet__col-summary" />
      <col className="voucher-sheet__col-account" />
      <col span={11} className="voucher-sheet__col-amount-digit" />
      <col span={11} className="voucher-sheet__col-amount-digit" />
    </colgroup>
  );
}

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
  onEnsureEntry,
  onRemoveEntry,
  onUpload,
  uploadStatus = null,
  onRemoveAttachment,
  onRemoveAttachments,
  attachmentPanelOpen,
  onAttachmentPanelClose,
  onAttachmentPanelToggle,
  canModifyAttachments = true,
  readOnly = false,
  redLetter = false,
  reviewedBy = '',
  showReviewedBy = false,
  businessTypeField,
  accountingPeriodLabel,
  dateReadOnly = false,
  footerActions
}) {
  const rowCount = Math.max(entries.length, MIN_ROWS);
  const period = accountingPeriodLabel || formatAccountingPeriod(voucherDate);
  const [debitHighlight, setDebitHighlight] = useState<number[]>([]);
  const [creditHighlight, setCreditHighlight] = useState<number[]>([]);
  const [summaryLibraryRow, setSummaryLibraryRow] = useState<number | null>(null);
  const [summaryDropdownRow, setSummaryDropdownRow] = useState<number | null>(null);
  const showTotalCn = totals.balanced;
  const totalAmount = showTotalCn ? Math.max(totals.debit, totals.credit) : 0;
  const totalDebitDisplay = totals.debit > 0 ? totals.debit : '';
  const totalCreditDisplay = totals.credit > 0 ? totals.credit : '';

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
            </Space>
          </div>
          <div className="voucher-sheet__meta-center">
            <div className="voucher-sheet__title">记 账 凭 证</div>
            {period && <div className="voucher-sheet__period">{period}</div>}
          </div>
          <div className="voucher-sheet__meta-right voucher-sheet__meta-right--compact">
            <div className="voucher-sheet__meta-right-stack">
              {businessTypeField}
              <VoucherAttachmentControls
                attachmentsCount={attachmentsCount}
                onToggle={onAttachmentPanelToggle}
                onUpload={onUpload}
                uploadStatus={uploadStatus}
                canModify={canModifyAttachments}
              />
            </div>
          </div>
        </div>

        <div className="voucher-sheet__table-layout">
          <div className="voucher-sheet__table-wrap">
            <div className="voucher-sheet__table-scroll">
              <table className="voucher-sheet__table">
                <VoucherTableColgroup />
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
                      <AmountGridHeader highlightIndices={debitHighlight} />
                    </th>
                    <th colSpan={11} className="voucher-sheet__th-units">
                      <AmountGridHeader highlightIndices={creditHighlight} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: rowCount }, (_, index) => {
                    const entry = entries[index];
                    const isPad = !entry;
                    const showAmount = Boolean(entry);
                    const amountValue = (side: 'debit' | 'credit') => {
                      if (!entry) return '';
                      const raw = entry[side];
                      if (raw === '' || raw === undefined || raw === null) return '';
                      const n = parseFloat(String(raw));
                      return Number.isFinite(n) && n > 0 ? raw : '';
                    };
                    const accountPreview =
                      entry && [entry.accountCode, entry.accountName].filter(Boolean).join(' ');
                    const activateRow = () => {
                      if (!readOnly && isPad) onEnsureEntry?.(index);
                    };
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
                                  disabled={!entry}
                                >
                                  <MinusCircleOutlined />
                                </button>
                              </Tooltip>
                            </div>
                          )}
                        </td>
                        <td
                          className={`voucher-sheet__td-summary${summaryLibraryRow === index ? ' voucher-sheet__td-summary--library-open' : ''
                            }${summaryDropdownRow === index ? ' voucher-sheet__td-summary--dropdown-open' : ''
                            }`}
                        >
                          {readOnly ? (
                            <span className="voucher-sheet__readonly-text">{entry?.summary || ''}</span>
                          ) : (
                            <>
                              <EllipsisText
                                className="voucher-sheet__cell-preview"
                                tooltip={entry?.summary || ''}
                              >
                                {entry?.summary || ''}
                              </EllipsisText>
                              <div className="voucher-sheet__cell-editor">
                                <VoucherPhraseAutoComplete
                                  kind="summary"
                                  variant="borderless"
                                  className="voucher-sheet__phrase-input"
                                  placeholder="摘要"
                                  value={entry?.summary ?? ''}
                                  onFocus={activateRow}
                                  onLibraryOpenChange={(open) =>
                                    setSummaryLibraryRow(open ? index : null)
                                  }
                                  onDropdownOpenChange={(open) =>
                                    setSummaryDropdownRow(open ? index : null)
                                  }
                                  onChange={(text) => {
                                    activateRow();
                                    onUpdateEntry(index, 'summary', text);
                                  }}
                                />
                              </div>
                            </>
                          )}
                        </td>
                        <td className="voucher-sheet__td-account">
                          {readOnly ? (
                            <span className="voucher-sheet__readonly-text">{accountPreview || ''}</span>
                          ) : (
                            <>
                              <EllipsisText
                                className="voucher-sheet__cell-preview"
                                tooltip={accountPreview || ''}
                              >
                                {accountPreview || ''}
                              </EllipsisText>
                              <div className="voucher-sheet__cell-editor">
                                <Select
                                  variant="borderless"
                                  showSearch
                                  placeholder="选择科目"
                                  style={{ width: '100%' }}
                                  value={entry?.accountId || undefined}
                                  optionFilterProp="label"
                                  onOpenChange={(open) => {
                                    if (open) activateRow();
                                  }}
                                  onChange={(v) => {
                                    activateRow();
                                    onUpdateEntry(index, 'accountId', v);
                                  }}
                                  options={accounts.map((a) => ({
                                    value: a.id,
                                    label: Accounts.formatAccountOption(a)
                                  }))}
                                />
                              </div>
                            </>
                          )}
                        </td>
                        <td colSpan={11} className="voucher-sheet__td-amount">
                          <div className="voucher-sheet__amount-cell">
                            {isPad && !readOnly ? (
                              <button
                                type="button"
                                className="voucher-sheet__amount-activator"
                                tabIndex={-1}
                                aria-label="录入金额"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  activateRow();
                                }}
                              />
                            ) : null}
                            <AmountGrid
                              value={showAmount ? amountValue('debit') : ''}
                              onChange={
                                showAmount && !readOnly
                                  ? (v) => onUpdateEntry(index, 'debit', v)
                                  : undefined
                              }
                              readOnly={readOnly || !showAmount}
                              redLetter={redLetter}
                              onHighlightChange={setDebitHighlight}
                            />
                          </div>
                        </td>
                        <td colSpan={11} className="voucher-sheet__td-amount">
                          <div className="voucher-sheet__amount-cell">
                            {isPad && !readOnly ? (
                              <button
                                type="button"
                                className="voucher-sheet__amount-activator"
                                tabIndex={-1}
                                aria-label="录入金额"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  activateRow();
                                }}
                              />
                            ) : null}
                            <AmountGrid
                              value={showAmount ? amountValue('credit') : ''}
                              onChange={
                                showAmount && !readOnly
                                  ? (v) => onUpdateEntry(index, 'credit', v)
                                  : undefined
                              }
                              readOnly={readOnly || !showAmount}
                              redLetter={redLetter}
                              onHighlightChange={setCreditHighlight}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="voucher-sheet__total-row">
                    <td colSpan={3} className="voucher-sheet__total-label">
                      <span className="voucher-sheet__total-text">合计：</span>
                      <span
                        className={`voucher-sheet__total-cn${redLetter ? ' voucher-sheet__total-cn--red' : ''}`}
                      >
                        {totalAmount > 0 ? amountToChineseUppercase(totalAmount, redLetter) : ''}
                      </span>
                    </td>
                    <td colSpan={11} className="voucher-sheet__td-amount">
                      <AmountGrid value={totalDebitDisplay} readOnly redLetter={redLetter} />
                    </td>
                    <td colSpan={11} className="voucher-sheet__td-amount">
                      <AmountGrid value={totalCreditDisplay} readOnly redLetter={redLetter} />
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
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

      <div className="voucher-sheet__footer">
        <div className="voucher-sheet__footer-left">
          <Space size={32} wrap>
            <Space size={4}>
              <span className="voucher-sheet__meta-label">制单人：</span>
              <span className="voucher-sheet__footer-value">{signatory || '—'}</span>
            </Space>
            {showReviewedBy ? (
              <Space size={4}>
                <span className="voucher-sheet__meta-label">审核人：</span>
                <span className="voucher-sheet__footer-value">{reviewedBy || '—'}</span>
              </Space>
            ) : null}
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
