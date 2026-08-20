import * as XLSX from 'xlsx';
import { DB } from './db';
import { Voucher } from './voucher';
import type { Voucher as VoucherRecord } from '../types';
import { VoucherImportParser } from './voucherImportParser';
import { INVOICE_TYPE } from '../constants/invoice';

function fillMergedCells(sheet, rows) {
  const merges = sheet['!merges'] || [];
  if (!merges.length) return rows;

  const next = rows.map((row) => [...(row || [])]);

  for (const merge of merges) {
    const { s, e } = merge;
    const master = next[s.r]?.[s.c];
    if (master == null || master === '') continue;

    for (let r = s.r; r <= e.r; r++) {
      if (!next[r]) next[r] = [];
      for (let c = s.c; c <= e.c; c++) {
        if (next[r][c] == null || next[r][c] === '') {
          next[r][c] = master;
        }
      }
    }
  }

  return next;
}

function normalizeSheetRows(rows) {
  const maxCols = rows.reduce((max, row) => Math.max(max, row?.length || 0), 0);
  return rows.map((row) => {
    const next = [...(row || [])];
    while (next.length < maxCols) next.push('');
    return next.map((cell) => (cell == null ? '' : cell));
  });
}

/** 多工作表 Excel 仅读取第一个工作表（分录表），其余工作表忽略 */
function resolveImportSheet(workbook) {
  const names = workbook.SheetNames || [];
  if (!names.length) {
    throw new Error('Excel 文件中没有工作表');
  }

  const sheetName = names[0];
  return {
    sheetName,
    sheetIndex: 0,
    totalSheets: names.length,
    ignoredSheetNames: names.slice(1)
  };
}

async function readFileToRows(file) {
  const buffer = await file.arrayBuffer();
  const name = file.name.toLowerCase();

  if (name.endsWith('.csv')) {
    const text = new TextDecoder('utf-8').decode(buffer).replace(/^\uFEFF/, '');
    return {
      rows: parseCsv(text),
      sheetMeta: null
    };
  }

  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const { sheetName, sheetIndex, totalSheets, ignoredSheetNames } = resolveImportSheet(workbook);
  const sheet = workbook.Sheets[sheetName];
  // raw: false → 日期列得到 Excel 显示的「2026/5/1」文本，避免 cellDates 时区少一天
  let rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: ''
  });
  rows = fillMergedCells(sheet, rows);
  rows = normalizeSheetRows(rows);

  return {
    rows: (rows as unknown[][]).map((row) =>
      (row as unknown[]).map((cell) => (cell == null ? '' : cell))
    ),
    sheetMeta: {
      sheetName,
      sheetIndex,
      totalSheets,
      ignoredSheetNames
    }
  };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\r') {
      // ignore
    } else {
      field += ch;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

async function parseFile(file, accounts) {
  const { rows, sheetMeta } = await readFileToRows(file);
  try {
    const parsed = VoucherImportParser.rowsToVouchers(rows, accounts);
    return { ...parsed, sheetMeta };
  } catch (err) {
    if (sheetMeta && String(err.message).includes('未找到表头')) {
      const preview = rows
        .filter((row) => row.some((cell) => String(cell || '').trim()))
        .slice(0, 5)
        .map((row, i) => `第 ${i + 1} 行：${row.filter(Boolean).slice(0, 6).join(' | ')}`)
        .join('\n');

      throw new Error(
        `第 1 个工作表「${sheetMeta.sheetName}」未识别到表头行。\n` +
          `请确认「分录表」是否为 Excel 最左侧的第一个工作表，且表头含：凭证号、摘要、一级科目。\n` +
          (sheetMeta.totalSheets > 1
            ? `（已忽略其余 ${sheetMeta.totalSheets - 1} 个工作表：${sheetMeta.ignoredSheetNames.join('、')}）\n`
            : '') +
          (preview ? `\n工作表前几行内容：\n${preview}` : '')
      );
    }
    throw err;
  }
}

/** 导入去重键：同月 + 同凭证字号视为重复（不同月份可同为 记-001） */
function voucherImportKey(voucher) {
  const yearMonth = String(voucher.date || '').slice(0, 7);
  return `${yearMonth}|${voucher.voucherNo}`;
}

async function importVouchers(vouchers, { skipDuplicates = true, approve = false } = {}) {
  const existing = await Voucher.getAll();
  const existingKeys = new Set(existing.map((v) => voucherImportKey(v)));
  const result = {
    imported: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    skippedItems: [],
    warnings: []
  };

  const sorted = [...vouchers].sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    return a.voucherNo.localeCompare(b.voucherNo);
  });

  for (const raw of sorted) {
    const importKey = voucherImportKey(raw);
    if (skipDuplicates && existingKeys.has(importKey)) {
      result.skipped++;
      result.skippedItems.push({
        voucherNo: raw.voucherNo,
        date: raw.date,
        reason: '同月同凭证号已存在'
      });
      continue;
    }

    try {
      const totals = Voucher.calcTotals(raw.entries);
      if (!totals.balanced) {
        throw new Error(
          `借贷不平衡（借 ${totals.debit.toFixed(2)} / 贷 ${totals.credit.toFixed(2)}）`
        );
      }

      const voucher: VoucherRecord = {
        id: DB.generateId(),
        voucherType: raw.voucherType || '记',
        voucherNumber: raw.voucherNumber || raw.voucherNo,
        voucherNo: raw.voucherNo,
        date: raw.date,
        attachmentCount: raw.attachmentCount || 0,
        attachmentIds: [],
        businessType: raw.businessType || '其他',
        invoiceType:
          raw.businessType === '销售收入'
            ? raw.invoiceType || INVOICE_TYPE.NONE
            : INVOICE_TYPE.NONE,
        taxAmount:
          raw.businessType === '销售收入' &&
          (raw.invoiceType === INVOICE_TYPE.ORDINARY ||
            raw.invoiceType === INVOICE_TYPE.SPECIAL)
            ? raw.taxAmount || 0
            : 0,
        taxExemptionDone: false,
        taxExemptionVoucherId: '',
        isTaxExemptionCarryForward: false,
        taxExemptionPeriod: '',
        taxExemptionPeriodType: 'month',
        entries: raw.entries,
        invoiceNumbers: '',
        remark: raw.remark || '',
        preparedBy: '',
        reviewedBy: '',
        postedBy: '',
        cashierBy: '',
        totalDebit: totals.debit,
        totalCredit: totals.credit,
        status: approve ? Voucher.STATUS.APPROVED : Voucher.STATUS.DRAFT,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        approvedAt: approve ? `${raw.date}T12:00:00.000Z` : undefined,
        importedAt: new Date().toISOString(),
        importSource: 'history-file'
      };
      voucher.checksum = Voucher.generateChecksum(voucher);

      await DB.put('vouchers', voucher);
      existingKeys.add(voucherImportKey(voucher));
      result.imported++;
    } catch (err) {
      result.failed++;
      result.errors.push({ voucherNo: raw.voucherNo, message: err.message });
    }
  }

  if (result.imported > 0) {
    await DB.addAuditLog(
      '导入',
      '凭证',
      `成功 ${result.imported} 张，跳过 ${result.skipped} 张，失败 ${result.failed} 张`
    );
  }

  return result;
}

export const VoucherImport = {
  parseFile,
  importVouchers
};
