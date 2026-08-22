import { Voucher } from './voucher';
import { ErpApi } from './erpApi';
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

const VOUCHER_EXPORT_HEADERS = [
  '凭证字号',
  '日期',
  '业务类型',
  '摘要',
  '科目编码',
  '科目名称',
  '借方金额',
  '贷方金额',
  '附件数',
  '发票/单据号码',
  '校验码',
  '状态',
  '制表人',
  '审核人',
  '备注'
] as const;

/** Excel 列宽（字符宽度），避免打开后日期变成 ####、摘要被截断 */
const VOUCHER_EXPORT_COL_WIDTHS = [12, 12, 12, 28, 10, 18, 14, 14, 10, 20, 22, 10, 12, 12, 28];

function compareVouchersAsc(a, b) {
  const dateCmp = String(a?.date || '').localeCompare(String(b?.date || ''));
  if (dateCmp !== 0) return dateCmp;
  const numA = parseInt(a?.voucherNumber, 10) || 0;
  const numB = parseInt(b?.voucherNumber, 10) || 0;
  if (numA !== numB) return numA - numB;
  return String(a?.voucherNo || '').localeCompare(String(b?.voucherNo || ''), 'zh-CN');
}

function buildVoucherExportRows(vouchers) {
  const rows = [];
  const sorted = [...(vouchers || [])].sort(compareVouchersAsc);
  for (const v of sorted) {
    const attachmentCount = v.attachmentCount ?? (v.attachmentIds || []).length;
    const preparedBy = v.preparedBy || '';
    const reviewedBy = v.reviewedBy || '';
    for (const e of v.entries) {
      rows.push([
        v.voucherNo,
        v.date,
        v.businessType || '',
        e.summary || '',
        e.accountCode || '',
        e.accountName || '',
        Number(e.debit) || 0,
        Number(e.credit) || 0,
        attachmentCount,
        v.invoiceNumbers || '',
        v.checksum || '',
        Voucher.STATUS_LABEL[v.status] || v.status,
        preparedBy,
        reviewedBy,
        v.remark || ''
      ]);
    }
  }
  return rows;
}

function vouchersToCSV(vouchers) {
  const rows = [VOUCHER_EXPORT_HEADERS.join(',')];
  for (const row of buildVoucherExportRows(vouchers)) {
    rows.push(
      row
        .map((cell, i) => {
          if (typeof cell === 'number') return String(cell);
          const text = String(cell ?? '');
          if (i === 3 || i === 5 || i === 10 || i === 15) {
            return `"${text.replace(/"/g, '""')}"`;
          }
          return text.includes(',') || text.includes('"') ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join(',')
    );
  }
  return rows.join('\n');
}

const HEADER_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF2F5496' }
};
/** 竖线：浅灰实线 */
const GRID_LINE = { style: 'thin', color: { argb: 'FFBFBFBF' } };
/** 表头顶边（与深蓝底搭配） */
const HEADER_TOP = { style: 'thin', color: { argb: 'FF1F3A5F' } };
/** 不同凭证号之间：虚线（图2效果） */
const VOUCHER_GROUP_SEP = { style: 'dashed', color: { argb: 'FF595959' } };
/** 表头底 / 表格外框 / 分组竖线：黑细实线 */
const OUTER_BORDER = { style: 'thin', color: { argb: 'FF000000' } };
const HEADER_BORDER = {
  top: HEADER_TOP,
  left: GRID_LINE,
  bottom: OUTER_BORDER,
  right: GRID_LINE
};
/** 科目余额表等：普通全网格 */
const DATA_BORDER = {
  top: GRID_LINE,
  left: GRID_LINE,
  bottom: GRID_LINE,
  right: GRID_LINE
};

function resolveExportYear(vouchers) {
  const years = (vouchers || [])
    .map((v) => String(v?.date || '').slice(0, 4))
    .filter((y) => /^\d{4}$/.test(y));
  if (!years.length) return String(new Date().getFullYear());
  const unique = [...new Set(years)].sort();
  return unique.length === 1 ? unique[0] : unique[unique.length - 1];
}

function applyHeaderStyle(cell) {
  cell.fill = HEADER_FILL;
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  cell.border = HEADER_BORDER;
}

function applyDataBorder(cell) {
  cell.border = DATA_BORDER;
}

/** 分录表：仅保留竖线；同一凭证无横线，凭证切换处加虚线底边 */
function applyJournalDataBorder(cell, { isGroupEnd = false } = {}) {
  cell.border = {
    left: GRID_LINE,
    right: GRID_LINE,
    ...(isGroupEnd ? { bottom: VOUCHER_GROUP_SEP } : {})
  };
}

/** 表格主体（表头+内容）实心黑外边框 */
function applyTableOuterBorder(
  sheet,
  startRow: number,
  endRow: number,
  startCol: number,
  endCol: number
) {
  if (endRow < startRow || endCol < startCol) return;
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const cell = sheet.getCell(r, c);
      const border = { ...(cell.border || {}) };
      if (r === startRow) border.top = OUTER_BORDER;
      if (r === endRow) border.bottom = OUTER_BORDER;
      if (c === startCol) border.left = OUTER_BORDER;
      if (c === endCol) border.right = OUTER_BORDER;
      cell.border = border;
    }
  }
}

/** 指定列左侧加黑细竖线（分组分隔） */
function applyVerticalSectionBorders(
  sheet,
  startRow: number,
  endRow: number,
  sectionStartCols: number[]
) {
  if (endRow < startRow || !sectionStartCols?.length) return;
  for (let r = startRow; r <= endRow; r++) {
    for (const c of sectionStartCols) {
      const cell = sheet.getCell(r, c);
      const border = { ...(cell.border || {}) };
      border.left = OUTER_BORDER;
      cell.border = border;
    }
  }
}

/** ExcelJS row.values 为 0 下标写入第 1 列，不要再前置 undefined，否则表头会右偏一列 */
function setHeaderValues(row, headers) {
  row.values = [...headers];
  for (let c = 1; c <= headers.length; c++) {
    applyHeaderStyle(row.getCell(c));
  }
}

/**
 * 第 1 行标题，第 2 行「单位：元」，表头从第 3 行起
 * @returns 表头行号 3
 */
function writeTitleAndUnitRows(
  sheet,
  {
    title,
    colCount,
    titleFontSize = 14
  }: { title: string; colCount: number; titleFontSize?: number }
) {
  sheet.mergeCells(1, 1, 1, colCount);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: titleFontSize, color: { argb: 'FF1F1F1F' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = titleFontSize >= 16 ? 28 : 24;

  const unitRow = sheet.getRow(2);
  unitRow.height = 20;
  const unitCell = sheet.getCell(2, colCount);
  unitCell.value = '单位：元';
  unitCell.font = { size: 11, color: { argb: 'FF333333' } };
  unitCell.alignment = { horizontal: 'right', vertical: 'middle' };

  return 3;
}

async function createWorkbook() {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ERP';
  return workbook;
}

/** cm → inch，保留 4 位小数，避免长浮点导致部分 Office 忽略页边距 */
function cmToInch(cm: number) {
  return Math.round((cm / 2.54) * 10000) / 10000;
}

function buildPrintPageSetup() {
  return {
    paperSize: 9, // A4
    orientation: 'portrait' as const,
    fitToPage: false,
    scale: 100,
    fitToWidth: undefined as number | undefined,
    fitToHeight: undefined as number | undefined,
    horizontalDpi: 4294967295,
    verticalDpi: 4294967295,
    pageOrder: 'downThenOver' as const,
    blackAndWhite: false,
    draft: false,
    cellComments: 'None' as const,
    errors: 'displayed' as const,
    showRowColHeaders: false,
    showGridLines: false,
    // 上 1cm，其余 0；水平居中
    margins: {
      top: cmToInch(1),
      bottom: cmToInch(0),
      left: cmToInch(0),
      right: cmToInch(0),
      header: cmToInch(0),
      footer: cmToInch(0)
    },
    horizontalCentered: true,
    verticalCentered: false
  };
}

function sheetCreateOptions(views?: { state: 'frozen'; ySplit: number }[]) {
  return {
    ...(views ? { views } : {}),
    pageSetup: buildPrintPageSetup()
  };
}

/** 打印页边距与居中（须在写完表格后再次确认，避免被覆盖） */
function applyPrintPageSetup(sheet) {
  const next = buildPrintPageSetup();
  sheet.pageSetup.paperSize = next.paperSize;
  sheet.pageSetup.orientation = next.orientation;
  sheet.pageSetup.fitToPage = false;
  sheet.pageSetup.scale = 100;
  sheet.pageSetup.fitToWidth = undefined;
  sheet.pageSetup.fitToHeight = undefined;
  sheet.pageSetup.margins = { ...next.margins };
  sheet.pageSetup.horizontalCentered = true;
  sheet.pageSetup.verticalCentered = false;
  sheet.pageSetup.showRowColHeaders = false;
  sheet.pageSetup.showGridLines = false;
}

async function workbookToBlob(workbook) {
  // 写出前再刷一遍每个工作表的页面设置
  workbook.eachSheet((sheet) => {
    applyPrintPageSetup(sheet);
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}

function addVoucherJournalSheet(workbook, vouchers, companyName, year) {
  const colCount = VOUCHER_EXPORT_HEADERS.length;
  const sheet = workbook.addWorksheet(
    '凭证分录表',
    sheetCreateOptions([{ state: 'frozen', ySplit: 3 }])
  );

  sheet.columns = VOUCHER_EXPORT_HEADERS.map((_, i) => ({
    key: `c${i}`,
    width: VOUCHER_EXPORT_COL_WIDTHS[i]
  }));

  const headerRowIndex = writeTitleAndUnitRows(sheet, {
    title: `${companyName} ${year}年 分录表`,
    colCount,
    titleFontSize: 16
  });

  const headerRow = sheet.getRow(headerRowIndex);
  headerRow.height = 22;
  setHeaderValues(headerRow, VOUCHER_EXPORT_HEADERS);

  const dataRows = buildVoucherExportRows(vouchers);
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const voucherNo = String(row[0] ?? '');
    const nextNo = i + 1 < dataRows.length ? String(dataRows[i + 1][0] ?? '') : null;
    const isGroupEnd = nextNo === null || nextNo !== voucherNo;
    const excelRow = sheet.addRow(row);
    excelRow.height = 18;
    excelRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      applyJournalDataBorder(cell, { isGroupEnd });
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber === 7 || colNumber === 8 || colNumber === 9 ? 'right' : 'left',
        wrapText: colNumber === 4 || colNumber === 16
      };
      if (colNumber === 7 || colNumber === 8) {
        cell.numFmt = '#,##0.00';
      }
    });
  }

  applyTableOuterBorder(
    sheet,
    headerRowIndex,
    Math.max(headerRowIndex, sheet.rowCount),
    1,
    colCount
  );
  applyPrintPageSetup(sheet);

  return sheet;
}

function addTrialBalanceSheet(workbook, data, meta: { companyName: string; periodLabel: string }) {
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
  const widths = [12, 18, 12, 12, 12, 12, 12, 14, 14, 12, 12];
  const sheet = workbook.addWorksheet(
    '科目余额表',
    sheetCreateOptions([{ state: 'frozen', ySplit: 3 }])
  );
  sheet.columns = headers.map((_, i) => ({ width: widths[i] }));

  const headerRowIndex = writeTitleAndUnitRows(sheet, {
    title: `${meta.companyName} ${meta.periodLabel} 科目余额表`,
    colCount: headers.length
  });

  const headerRow = sheet.getRow(headerRowIndex);
  headerRow.height = 22;
  setHeaderValues(headerRow, headers);

  const amountCols = new Set([4, 5, 6, 7, 8, 9, 10, 11]);
  const pushRow = (values: unknown[], bold = false) => {
    const excelRow = sheet.addRow(values);
    excelRow.height = 18;
    excelRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      applyDataBorder(cell);
      if (bold) cell.font = { bold: true };
      cell.alignment = {
        vertical: 'middle',
        horizontal: amountCols.has(colNumber) ? 'right' : 'left'
      };
      if (amountCols.has(colNumber) && typeof cell.value === 'number') {
        cell.numFmt = '#,##0.00';
      }
    });
  };

  for (const r of data?.rows || []) {
    pushRow([
      r.code,
      r.name,
      r.categoryLabel,
      Number(r.openingDebit) || 0,
      Number(r.openingCredit) || 0,
      Number(r.periodDebit) || 0,
      Number(r.periodCredit) || 0,
      Number(r.ytdDebit) || 0,
      Number(r.ytdCredit) || 0,
      Number(r.endingDebit) || 0,
      Number(r.endingCredit) || 0
    ]);
  }

  if (data?.totals) {
    const t = data.totals;
    pushRow(
      [
        '',
        '合计',
        '',
        Number(t.openingDebit) || 0,
        Number(t.openingCredit) || 0,
        Number(t.periodDebit) || 0,
        Number(t.periodCredit) || 0,
        Number(t.ytdDebit) || 0,
        Number(t.ytdCredit) || 0,
        Number(t.endingDebit) || 0,
        Number(t.endingCredit) || 0
      ],
      true
    );
  }

  const endRow = Math.max(headerRowIndex, sheet.rowCount);
  applyTableOuterBorder(sheet, headerRowIndex, endRow, 1, headers.length);
  // 科目信息 | 期初 | 本期 | 本年累计 | 期末
  applyVerticalSectionBorders(sheet, headerRowIndex, endRow, [4, 6, 8, 10]);
  applyPrintPageSetup(sheet);
}

function addIncomeStatementSheet(
  workbook,
  data,
  meta: { companyName: string; periodLabel: string }
) {
  const headers = ['项目', '行次', '本期金额', '本年累计金额'];
  const widths = [36, 8, 14, 14];
  const sheet = workbook.addWorksheet(
    '利润表',
    sheetCreateOptions([{ state: 'frozen', ySplit: 3 }])
  );
  sheet.columns = headers.map((_, i) => ({ width: widths[i] }));

  const headerRowIndex = writeTitleAndUnitRows(sheet, {
    title: `${meta.companyName} ${meta.periodLabel} 利润表`,
    colCount: headers.length
  });

  const headerRow = sheet.getRow(headerRowIndex);
  headerRow.height = 22;
  setHeaderValues(headerRow, headers);

  for (const line of data?.rows || []) {
    const excelRow = sheet.addRow([
      line.label,
      line.row ?? '',
      line.periodAmount == null ? '' : Number(line.periodAmount) || 0,
      line.ytdAmount == null ? '' : Number(line.ytdAmount) || 0
    ]);
    excelRow.height = 18;
    excelRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      applyDataBorder(cell);
      if (line.bold) cell.font = { bold: true };
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber === 3 || colNumber === 4 ? 'right' : colNumber === 2 ? 'center' : 'left'
      };
      if ((colNumber === 3 || colNumber === 4) && typeof cell.value === 'number') {
        cell.numFmt = '#,##0.00';
      }
    });
  }

  applyTableOuterBorder(
    sheet,
    headerRowIndex,
    Math.max(headerRowIndex, sheet.rowCount),
    1,
    headers.length
  );
  applyPrintPageSetup(sheet);
}

function addBalanceSheetSheet(
  workbook,
  data,
  meta: { companyName: string; periodLabel: string }
) {
  const headers = [
    '资产',
    '行次',
    '期末余额',
    '年初余额',
    '负债和所有者权益（或股东权益）',
    '行次',
    '期末余额',
    '年初余额'
  ];
  const widths = [28, 8, 14, 14, 32, 8, 14, 14];
  const sheet = workbook.addWorksheet(
    '负债表',
    sheetCreateOptions([{ state: 'frozen', ySplit: 3 }])
  );
  sheet.columns = headers.map((_, i) => ({ width: widths[i] }));

  const headerRowIndex = writeTitleAndUnitRows(sheet, {
    title: `${meta.companyName} ${meta.periodLabel} 资产负债表`,
    colCount: headers.length
  });

  const headerRow = sheet.getRow(headerRowIndex);
  headerRow.height = 22;
  setHeaderValues(headerRow, headers);

  const merged = mergeBalanceSheetRows(data?.assets?.rows, data?.liabilities?.rows);
  for (const row of merged) {
    const assetOk = row.assetType && row.assetType !== 'spacer';
    const liabilityOk = row.liabilityType && row.liabilityType !== 'spacer';
    const assetItem =
      assetOk && row.assetType !== 'section' && row.assetType !== 'spacer';
    const liabilityItem =
      liabilityOk && row.liabilityType !== 'section' && row.liabilityType !== 'spacer';

    const excelRow = sheet.addRow([
      assetOk ? row.assetLabel : '',
      assetItem ? (row.assetRow ?? '') : '',
      assetItem ? Number(row.assetEnding) || 0 : '',
      assetItem ? Number(row.assetOpening) || 0 : '',
      liabilityOk ? row.liabilityLabel : '',
      liabilityItem ? (row.liabilityRow ?? '') : '',
      liabilityItem ? Number(row.liabilityEnding) || 0 : '',
      liabilityItem ? Number(row.liabilityOpening) || 0 : ''
    ]);
    excelRow.height = 18;
    const bold =
      row.assetType === 'total' ||
      row.assetType === 'section' ||
      row.liabilityType === 'total' ||
      row.liabilityType === 'section';
    excelRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      applyDataBorder(cell);
      if (bold) cell.font = { bold: true };
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber === 2 || colNumber === 6 ? 'center' : colNumber === 3 || colNumber === 4 || colNumber === 7 || colNumber === 8 ? 'right' : 'left'
      };
      if (
        (colNumber === 3 || colNumber === 4 || colNumber === 7 || colNumber === 8) &&
        typeof cell.value === 'number'
      ) {
        cell.numFmt = '#,##0.00';
      }
    });
  }

  const endRow = Math.max(headerRowIndex, sheet.rowCount);
  applyTableOuterBorder(sheet, headerRowIndex, endRow, 1, headers.length);
  // 资产侧 | 负债和所有者权益侧
  applyVerticalSectionBorders(sheet, headerRowIndex, endRow, [5]);
  applyPrintPageSetup(sheet);
}

async function vouchersToExcelBlob(vouchers) {
  const workbook = await createWorkbook();
  const company = await getCompanyInfo();
  const companyName = String(company?.name || '').trim() || '未设置公司名称';
  const year = resolveExportYear(vouchers);
  addVoucherJournalSheet(workbook, vouchers, companyName, year);
  return workbookToBlob(workbook);
}

/**
 * 财务报表一键导出：
 * 1 凭证分录表 / 2 科目余额表 / 3 利润表 / 4 负债表（资产负债表）
 * withAttachments 时打包 ZIP（Excel + attachments/年/月）
 */
async function exportFinancialReportsWorkbook({
  vouchers,
  trialBalance,
  incomeStatement,
  balanceSheet,
  periodLabel,
  year,
  withAttachments = false,
  onProgress
}: {
  vouchers: unknown[];
  trialBalance: unknown;
  incomeStatement: unknown;
  balanceSheet: unknown;
  periodLabel: string;
  year?: string | number;
  withAttachments?: boolean;
  onProgress?: (done: number, total: number) => void;
}) {
  const workbook = await createWorkbook();
  const company = await getCompanyInfo();
  const companyName = String(company?.name || '').trim() || '未设置公司名称';
  const exportYear = year || resolveExportYear(vouchers);
  const meta = { companyName, periodLabel: periodLabel || String(exportYear) };

  addVoucherJournalSheet(workbook, vouchers, companyName, exportYear);
  addTrialBalanceSheet(workbook, trialBalance, meta);
  addIncomeStatementSheet(workbook, incomeStatement, meta);
  addBalanceSheetSheet(workbook, balanceSheet, meta);

  const stamp = new Date().toISOString().slice(0, 10);
  const safePeriod = String(periodLabel || exportYear).replace(/[\\/:*?"<>|]/g, '_');
  const excelName = `财务报表_${safePeriod}_${stamp}.xlsx`;
  const excelBlob = await workbookToBlob(workbook);
  const voucherCount = Array.isArray(vouchers) ? vouchers.length : 0;

  if (!withAttachments) {
    downloadBinaryBlob(excelBlob, excelName);
    return { voucherCount, attachmentCount: 0, failed: 0 };
  }

  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  zip.file(excelName, excelBlob);
  const { attachmentCount, failed } = await appendPeriodAttachmentsToZip(
    zip,
    vouchers as { date?: string; attachmentIds?: string[] }[],
    onProgress
  );
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  downloadBinaryBlob(zipBlob, `财务报表_${safePeriod}_${stamp}.zip`);
  return { voucherCount, attachmentCount, failed };
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
  const rows = [`利润表,${data.startDate} 至 ${data.endDate}`, '项目,行次,本期金额,本年累计金额'];
  for (const line of data.rows) {
    rows.push(
      [
        `"${line.label}"`,
        line.row ?? '',
        fmtAmount(line.periodAmount),
        fmtAmount(line.ytdAmount)
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

function renderPrintVoucher(voucher, company, attachments) {
  const invoiceMeta = voucher.isTaxExemptionCarryForward
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

  const preparedBy = (voucher.preparedBy || '').trim() || '______';
  const reviewedBy = (voucher.reviewedBy || '').trim() || '______';

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
          <span>制单人：${preparedBy}</span>
          <span>审核人：${reviewedBy}</span>
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
        .pv-signatures { display: flex; align-items: baseline; gap: 48px; margin-top: 20px; font-size: 13px; flex-wrap: wrap; }
        .pv-attachments { margin-top: 12px; font-size: 12px; }
        @page { margin: 15mm; }
      </style></head><body>${html}</body></html>
    `);
  win.document.close();
  win.onload = () => {
    win.print();
  };
}

function downloadBinaryBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** 从附件 URL 解析对象存储相对路径 attachments/YYYY/MM/filename */
function attachmentObjectPath(att, voucherDate = '') {
  const rawUrl = String(att?.url || '').trim();
  if (rawUrl && !rawUrl.startsWith('data:')) {
    try {
      const u = new URL(rawUrl);
      const path = decodeURIComponent(u.pathname.replace(/^\/+/, ''));
      const idx = path.indexOf('attachments/');
      if (idx >= 0) {
        return path.slice(idx);
      }
    } catch {
      // ignore
    }
  }
  const date = String(voucherDate || '').slice(0, 10);
  const year = date.slice(0, 4) || 'unknown';
  const month = date.slice(5, 7) || '00';
  const name = String(att?.name || att?.id || 'file').replace(/[\\/:*?"<>|]/g, '_');
  return `attachments/${year}/${month}/${name}`;
}

function uniqueZipPath(used: Set<string>, path: string) {
  if (!used.has(path)) {
    used.add(path);
    return path;
  }
  const dot = path.lastIndexOf('.');
  const base = dot > 0 ? path.slice(0, dot) : path;
  const ext = dot > 0 ? path.slice(dot) : '';
  let i = 2;
  let next = `${base}_${i}${ext}`;
  while (used.has(next)) {
    i += 1;
    next = `${base}_${i}${ext}`;
  }
  used.add(next);
  return next;
}

async function appendPeriodAttachmentsToZip(
  zip,
  vouchers: { date?: string; attachmentIds?: string[] }[],
  onProgress?: (done: number, total: number) => void
) {
  const usedPaths = new Set<string>();
  let attachmentCount = 0;
  let failed = 0;
  const tasks: { voucher: { date?: string; attachmentIds?: string[] }; id: string }[] = [];

  for (const voucher of vouchers || []) {
    for (const id of voucher.attachmentIds || []) {
      tasks.push({ voucher, id });
    }
  }

  const total = tasks.length;
  onProgress?.(0, total);

  for (let i = 0; i < tasks.length; i++) {
    const { voucher, id } = tasks[i];
    try {
      const att = await Voucher.getAttachment(id);
      if (!att?.url || String(att.url).startsWith('data:')) {
        failed += 1;
        onProgress?.(i + 1, total);
        continue;
      }
      const res = await fetch(att.url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const buf = await res.arrayBuffer();
      const path = uniqueZipPath(usedPaths, attachmentObjectPath(att, voucher.date));
      zip.file(path, buf);
      attachmentCount += 1;
    } catch {
      failed += 1;
    }
    onProgress?.(i + 1, total);
  }

  return { attachmentCount, failed };
}

/**
 * 导出当前列表 Excel；withAttachments 时打包 ZIP：
 * - 凭证导出.xlsx（列宽 + 表头样式）
 * - attachments/YYYY/MM/...（与对象存储目录一致）
 */
async function exportVouchersPackage(
  vouchers,
  options: {
    withAttachments?: boolean;
    onProgress?: (done: number, total: number) => void;
  } = {}
) {
  const { withAttachments = false, onProgress } = options;
  const list = vouchers || [];
  if (!list.length) {
    throw new Error('无数据可导出');
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const excelBlob = await vouchersToExcelBlob(list);
  const excelName = `凭证导出_${stamp}.xlsx`;

  if (!withAttachments) {
    downloadBinaryBlob(excelBlob, excelName);
    return { voucherCount: list.length, attachmentCount: 0, failed: 0 };
  }

  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  zip.file(excelName, excelBlob);
  const { attachmentCount, failed } = await appendPeriodAttachmentsToZip(zip, list, onProgress);
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBinaryBlob(blob, `凭证导出_${stamp}.zip`);
  return { voucherCount: list.length, attachmentCount, failed };
}

export const ExportUtil = {
  downloadBlob,
  downloadBinaryBlob,
  vouchersToCSV,
  vouchersToExcelBlob,
  ledgerToCSV,
  trialBalanceToCSV,
  incomeStatementToCSV,
  balanceSheetToCSV,
  exportVouchersPackage,
  exportFinancialReportsWorkbook,
  attachmentObjectPath,
  renderPrintVoucher,
  printVoucher
};

export async function getCompanyInfo() {
  return {
    name: await ErpApi.getSetting('companyName'),
    taxId: await ErpApi.getSetting('companyTaxId')
  };
}
