import { Voucher } from './voucher';
import { DB } from './db';
import { INVOICE_TYPE_LABEL } from '../constants/invoice';
import { mergeBalanceSheetRows } from '../utils/balanceSheetRows';
import { formatStoredTaxExemptionPeriod } from '../utils/reportPeriod';

function downloadBlob(content, filename, type = 'text/plain;charset=utf-8') {
  const blob = new Blob(['\ufeff' + content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function vouchersToCSV(vouchers) {
  const headers = [
    '凭证字号',
    '日期',
    '附单据数',
    '业务类型',
    '开票类型',
    '增值税额',
    '摘要',
    '科目编码',
    '科目名称',
    '借方金额',
    '贷方金额',
    '发票/单据号码',
    '校验码',
    '状态',
    '备注',
    '经办人'
  ];
  const rows = [headers.join(',')];
  for (const v of vouchers) {
    const attachmentCount = v.attachmentCount ?? (v.attachmentIds || []).length;
    const signatory = resolveSignatory(v);
    const invoiceTypeLabel =
      v.businessType === '销售收入'
        ? INVOICE_TYPE_LABEL[v.invoiceType] || INVOICE_TYPE_LABEL['']
        : '';
    const taxAmount =
      v.businessType === '销售收入' && v.taxAmount != null && v.taxAmount !== ''
        ? parseFloat(v.taxAmount)
        : '';
    for (const e of v.entries) {
      rows.push(
        [
          v.voucherNo,
          v.date,
          attachmentCount,
          v.businessType || '',
          invoiceTypeLabel,
          taxAmount,
          `"${(e.summary || '').replace(/"/g, '""')}"`,
          e.accountCode || '',
          `"${(e.accountName || '').replace(/"/g, '""')}"`,
          e.debit || 0,
          e.credit || 0,
          `"${(v.invoiceNumbers || '').replace(/"/g, '""')}"`,
          v.checksum || '',
          Voucher.STATUS_LABEL[v.status] || v.status,
          `"${(v.remark || '').replace(/"/g, '""')}"`,
          signatory
        ].join(',')
      );
    }
  }
  return rows.join('\n');
}

function ledgerToCSV(ledger) {
  const headers = ['日期', '凭证号', '摘要', '借方', '贷方', '余额'];
  const rows = [headers.join(',')];
  for (const r of ledger.rows) {
    rows.push(
      [r.date, r.voucherNo, `"${r.summary.replace(/"/g, '""')}"`, r.debit, r.credit, r.balance].join(
        ','
      )
    );
  }
  return rows.join('\n');
}

function fmtAmount(v) {
  if (v == null || Math.abs(Number(v)) < 0.005) return '';
  return Number(v).toFixed(2);
}

function trialBalanceToCSV(data) {
  const headers = [
    '科目编码',
    '科目名称',
    '科目大类',
    '期初借方',
    '期初贷方',
    '本期借方',
    '本期贷方',
    '本年累计借方',
    '本年累计贷方',
    '期末借方',
    '期末贷方'
  ];
  const rows = [headers.join(',')];
  for (const r of data.rows) {
    rows.push(
      [
        r.code,
        `"${r.name.replace(/"/g, '""')}"`,
        r.categoryLabel,
        fmtAmount(r.openingDebit),
        fmtAmount(r.openingCredit),
        fmtAmount(r.periodDebit),
        fmtAmount(r.periodCredit),
        fmtAmount(r.ytdDebit),
        fmtAmount(r.ytdCredit),
        fmtAmount(r.endingDebit),
        fmtAmount(r.endingCredit)
      ].join(',')
    );
  }
  const t = data.totals;
  rows.push(
    [
      '',
      '合计',
      '',
      fmtAmount(t.openingDebit),
      fmtAmount(t.openingCredit),
      fmtAmount(t.periodDebit),
      fmtAmount(t.periodCredit),
      fmtAmount(t.ytdDebit),
      fmtAmount(t.ytdCredit),
      fmtAmount(t.endingDebit),
      fmtAmount(t.endingCredit)
    ].join(',')
  );
  return rows.join('\n');
}

function incomeStatementToCSV(data) {
  const rows = [`利润表,${data.startDate} 至 ${data.endDate}`, '项目,行次,本年累计金额,本期金额'];
  for (const line of data.rows) {
    rows.push(
      [
        `"${line.label}"`,
        line.row ?? '',
        fmtAmount(line.ytdAmount),
        fmtAmount(line.periodAmount)
      ].join(',')
    );
  }
  return rows.join('\n');
}

function balanceSheetToCSV(data) {
  const rows = [
    `资产负债表,${data.startDate} 至 ${data.endDate}`,
    '资产,行次,期末余额,年初余额,负债和所有者权益（或股东权益）,行次,期末余额,年初余额'
  ];
  const merged = mergeBalanceSheetRows(data.assets.rows, data.liabilities.rows);
  for (const row of merged) {
    const assetLabel =
      row.assetType && row.assetType !== 'spacer'
        ? `"${row.assetLabel.replace(/"/g, '""')}"`
        : '';
    const liabilityLabel =
      row.liabilityType && row.liabilityType !== 'spacer'
        ? `"${row.liabilityLabel.replace(/"/g, '""')}"`
        : '';
    rows.push(
      [
        assetLabel,
        row.assetType && row.assetType !== 'section' && row.assetType !== 'spacer'
          ? (row.assetRow ?? '')
          : '',
        row.assetType && row.assetType !== 'section' && row.assetType !== 'spacer'
          ? fmtAmount(row.assetEnding)
          : '',
        row.assetType && row.assetType !== 'section' && row.assetType !== 'spacer'
          ? fmtAmount(row.assetOpening)
          : '',
        liabilityLabel,
        row.liabilityType &&
        row.liabilityType !== 'section' &&
        row.liabilityType !== 'spacer'
          ? (row.liabilityRow ?? '')
          : '',
        row.liabilityType &&
        row.liabilityType !== 'section' &&
        row.liabilityType !== 'spacer'
          ? fmtAmount(row.liabilityEnding)
          : '',
        row.liabilityType &&
        row.liabilityType !== 'section' &&
        row.liabilityType !== 'spacer'
          ? fmtAmount(row.liabilityOpening)
          : ''
      ].join(',')
    );
  }
  return rows.join('\n');
}

function resolveSignatory(voucher) {
  return (
    voucher.preparedBy ||
    voucher.reviewedBy ||
    voucher.postedBy ||
    voucher.cashierBy ||
    ''
  );
}

function renderPrintVoucher(voucher, company, attachments) {
  const INVOICE_LABELS = { ordinary: '普票', special: '专票' };
  const invoiceMeta =
    voucher.businessType === '销售收入' && voucher.invoiceType
      ? `<div style="margin-top:8px;font-size:12px">开票类型：${INVOICE_LABELS[voucher.invoiceType] || voucher.invoiceType}${
          voucher.taxAmount ? `，增值税额：${parseFloat(voucher.taxAmount).toFixed(2)}` : ''
        }${voucher.taxExemptionDone ? '（已减免结转）' : ''}</div>`
      : voucher.isTaxExemptionCarryForward
        ? `<div style="margin-top:8px;font-size:12px">普票增值税减免结转 · ${formatStoredTaxExemptionPeriod(voucher)}</div>`
        : '';

  const entriesHtml = voucher.entries
    .map(
      (e) => `
      <tr>
        <td>${e.summary}</td>
        <td>${e.accountCode} ${e.accountName}</td>
        <td class="amount">${e.debit ? parseFloat(e.debit).toFixed(2) : ''}</td>
        <td class="amount">${e.credit ? parseFloat(e.credit).toFixed(2) : ''}</td>
      </tr>
    `
    )
    .join('');

  const attachHtml = attachments.length
    ? `<div class="pv-attachments">附件：${attachments.map((a) => a.name).join('、')}</div>`
    : '';

  const signatory = resolveSignatory(voucher);

  return `
      <div class="print-voucher print-area">
        <div class="pv-header">
          <div class="pv-title">记 账 凭 证</div>
          <div class="pv-company">${company.name || ''}</div>
          ${company.taxId ? `<div style="font-size:12px;color:#666">统一社会信用代码：${company.taxId}</div>` : ''}
        </div>
        <div class="pv-meta">
          <span>凭证字号：${voucher.voucherNo}</span>
          <span>日期：${voucher.date}</span>
          <span>附单据数：${voucher.attachmentCount || 0}</span>
          <span>校验码：${voucher.checksum || ''}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width:30%">摘要</th>
              <th style="width:35%">会计科目</th>
              <th style="width:17%">借方金额</th>
              <th style="width:18%">贷方金额</th>
            </tr>
          </thead>
          <tbody>${entriesHtml}</tbody>
          <tfoot>
            <tr>
              <td colspan="2"><strong>合　计</strong></td>
              <td class="amount">${voucher.totalDebit.toFixed(2)}</td>
              <td class="amount">${voucher.totalCredit.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
        ${voucher.invoiceNumbers ? `<div style="margin-top:8px;font-size:12px">发票号码：${voucher.invoiceNumbers}</div>` : ''}
        ${invoiceMeta}
        ${voucher.remark ? `<div style="margin-top:4px;font-size:12px">备注：${voucher.remark}</div>` : ''}
        ${attachHtml}
        <div class="pv-signatures">
          <span>经办人：${signatory || '______'}</span>
          <span class="pv-signatures__roles">兼任制单、审核、记账、出纳</span>
        </div>
      </div>
    `;
}

function printVoucher(html) {
  const win = window.open('', '_blank');
  win.document.write(`
      <!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>打印凭证</title>
      <style>
        body { margin: 0; padding: 20px; font-family: SimSun, serif; }
        .print-voucher { max-width: 800px; margin: 0 auto; }
        .pv-header { text-align: center; margin-bottom: 16px; }
        .pv-title { font-size: 22px; font-weight: bold; letter-spacing: 8px; }
        .pv-meta { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #000; padding: 6px 8px; font-size: 13px; }
        .amount { text-align: right; }
        .pv-signatures { display: flex; align-items: baseline; gap: 12px; margin-top: 20px; font-size: 13px; flex-wrap: wrap; }
        .pv-signatures__roles { color: #666; font-size: 12px; }
        .pv-attachments { margin-top: 12px; font-size: 12px; }
        @page { margin: 15mm; }
      </style></head><body>${html}</body></html>
    `);
  win.document.close();
  win.onload = () => {
    win.print();
  };
}

export const ExportUtil = {
  downloadBlob,
  vouchersToCSV,
  ledgerToCSV,
  trialBalanceToCSV,
  incomeStatementToCSV,
  balanceSheetToCSV,
  renderPrintVoucher,
  printVoucher
};

export async function getCompanyInfo() {
  return {
    name: await DB.getSetting('companyName'),
    taxId: await DB.getSetting('companyTaxId')
  };
}
