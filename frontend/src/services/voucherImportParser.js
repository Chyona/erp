import { INVOICE_TYPE } from '../constants/invoice.js';
import * as XLSX from 'xlsx';

/** 历史表格「一级科目」→ 系统科目编码 */
const LEVEL1_ACCOUNT_CODES = {
  银行存款: '1002',
  应收账款: '1122',
  其他应收款: '1221',
  固定资产: '1601',
  累计折旧: '1602',
  应付账款: '2202',
  应付职工薪酬: '2211',
  应交税费: '2221',
  其他应付款: '2241',
  实收资本: '3001',
  本年利润: '3103',
  利润分配: '3104',
  研发支出: '4301',
  主营业务收入: '5001',
  营业外收入: '5301',
  主营业务成本: '5401',
  税金及附加: '5403',
  管理费用: '5602',
  财务费用: '5603',
  营业外支出: '5711',
  所得税费用: '5801'
};

/** 二级科目别名（历史表格写法 → 标准名） */
const LEVEL2_ALIASES = {
  公众: '公户',
  微信提取: '微信提现',
  微信收账: '微信提现'
};

/** 历史表格「二级科目」→ 系统科目编码 */
const LEVEL2_ACCOUNT_CODES = {
  公户: '1002',
  微信提现: '5001',
  办公费: '5602',
  差旅费: '5602',
  餐饮费: '5602',
  采购: '5602',
  劳务费: '5602',
  '1%增值税': '2221',
  应交增值税: '2221',
  应交专票增值税: '2221',
  销项税额: '2221',
  进项税额: '2221',
  增值税: '2221',
  企业所得税: '5801',
  附加税: '5403',
  免税收入: '5301'
};

const HEADER_ALIASES = {
  voucherNo: ['凭证号', '凭证字号', '凭证编号', '凭证号码'],
  date: ['凭证日期', '日期', '制单日期', '业务日期'],
  quarter: ['季度', '期间'],
  summary: ['摘要', '业务摘要', '分录摘要'],
  level1: ['一级科目', '总账科目', '会计科目', '科目名称', '科目'],
  level2: ['二级科目', '明细科目', '子科目', '明细'],
  debit: ['借方金额', '借方', '借方发生额', '借方本币'],
  credit: ['贷方金额', '贷方', '贷方发生额', '贷方本币'],
  counterparty: ['往来单位', '对方单位', '客户供应商', '客商', '单位名称'],
  attachmentCount: ['附件数', '附单据数', '附件张数', '单据数'],
  remark: ['备注', '说明', '附注']
};

const SKIP_ROW_KEYWORDS = ['合计', '总计', '本页小计', '单位：', '单位:', '分录表'];

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .replace(/[\u200b\uFEFF]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function matchColumnHeader(cell, key) {
  const normalized = normalizeHeader(cell);
  if (!normalized) return false;

  const aliases = [...HEADER_ALIASES[key]].sort((a, b) => b.length - a.length);
  for (const alias of aliases) {
    const target = normalizeHeader(alias);
    if (!target) continue;
    if (normalized === target) return true;

    if (key === 'level1' && normalized.includes('二级')) continue;
    if (key === 'level2' && normalized.includes('一级') && !normalized.includes('二级')) continue;

    if (normalized.includes(target) || target.includes(normalized)) return true;
  }
  return false;
}

function rowHasHeader(row, key) {
  return row.some((cell) => matchColumnHeader(cell, key));
}

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeLevel2(value) {
  const text = normalizeText(value);
  return LEVEL2_ALIASES[text] || text;
}

function parseAmount(value) {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return Math.round(value * 100) / 100;
  const cleaned = String(value).replace(/[,，\s¥￥]/g, '');
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? Math.round(num * 100) / 100 : 0;
}

function parseDate(value) {
  if (value == null || value === '') return '';

  if (typeof value === 'number') {
    const parsed = xlsxDateToIso(value);
    if (parsed) return parsed;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const serial = (value.getTime() - Date.UTC(1899, 11, 30)) / 86400000;
    const fromSerial = xlsxDateToIso(Math.round(serial));
    if (fromSerial) return fromSerial;
    return formatDateParts(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  const text = normalizeText(value);
  if (!text) return '';

  const slashMatch = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (slashMatch) {
    return formatDateParts(+slashMatch[1], +slashMatch[2], +slashMatch[3]);
  }

  const cnMatch = text.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日?$/);
  if (cnMatch) {
    return formatDateParts(+cnMatch[1], +cnMatch[2], +cnMatch[3]);
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return formatDateParts(
      parsed.getFullYear(),
      parsed.getMonth() + 1,
      parsed.getDate()
    );
  }

  return '';
}

function formatDateParts(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function xlsxDateToIso(serial) {
  if (!Number.isFinite(serial)) return '';
  const parts = XLSX.SSF.parse_date_code(serial);
  if (!parts?.y) return '';
  return formatDateParts(parts.y, parts.m, parts.d);
}

function buildColumnIndex(headerRow) {
  const index = {};
  headerRow.forEach((cell, col) => {
    for (const key of Object.keys(HEADER_ALIASES)) {
      if (index[key] != null) continue;
      if (matchColumnHeader(cell, key)) {
        index[key] = col;
      }
    }
  });
  return index;
}

function cell(row, colIndex, key) {
  if (colIndex[key] == null) return '';
  return row[colIndex[key]];
}

function isEmptyRow(row) {
  return !row || row.every((cell) => normalizeText(cell) === '');
}

function shouldSkipRow(summary, level1, voucherNoRaw) {
  const text = `${summary}${level1}${voucherNoRaw}`;
  if (SKIP_ROW_KEYWORDS.some((kw) => text.includes(kw))) return true;
  if (normalizeText(summary) === '合计') return true;
  return false;
}

function rowHasEntryData(row, colIndex) {
  return (
    normalizeText(cell(row, colIndex, 'summary')) ||
    normalizeText(cell(row, colIndex, 'level1')) ||
    normalizeText(cell(row, colIndex, 'level2')) ||
    parseAmount(cell(row, colIndex, 'debit')) > 0 ||
    parseAmount(cell(row, colIndex, 'credit')) > 0
  );
}

/** 续行日期为空时向下填充；凭证号为空不填充（无凭证号的分录行不录入） */
function forwardFillImportColumns(rows, headerRowIndex, colIndex) {
  const next = rows.map((row) => [...(row || [])]);
  let lastDateIso = '';

  for (let i = headerRowIndex + 1; i < next.length; i++) {
    const row = next[i];
    if (isEmptyRow(row)) continue;
    if (!rowHasEntryData(row, colIndex)) continue;

    if (colIndex.date != null) {
      const parsedDate = parseDate(row[colIndex.date]);
      if (parsedDate) {
        lastDateIso = parsedDate;
        row[colIndex.date] = parsedDate;
      } else if (lastDateIso) {
        row[colIndex.date] = lastDateIso;
      }
    }
  }

  return next;
}

function findHeaderRowIndex(rows) {
  const limit = Math.min(rows.length, 80);

  for (let i = 0; i < limit; i++) {
    const row = rows[i];
    if (isEmptyRow(row)) continue;

    const hasVoucherNo = rowHasHeader(row, 'voucherNo');
    const hasSummary = rowHasHeader(row, 'summary');
    const hasLevel1 = rowHasHeader(row, 'level1');
    const hasDebit = rowHasHeader(row, 'debit');
    const hasCredit = rowHasHeader(row, 'credit');

    if (hasVoucherNo && hasSummary && hasLevel1) return i;
    if (hasVoucherNo && hasSummary && (hasDebit || hasCredit)) return i;
  }

  return -1;
}

function resolveAccount(accounts, level1, level2) {
  const l1 = normalizeText(level1);
  const l2 = normalizeLevel2(level2);
  const byCode = new Map(accounts.map((acc) => [acc.code, acc]));
  const byName = new Map(accounts.map((acc) => [acc.name, acc]));

  const tryCode = (code) => (code ? byCode.get(code) : null);

  if (l1 && byName.has(l1)) return { account: byName.get(l1), level2: l2 };

  if (l1 && LEVEL1_ACCOUNT_CODES[l1]) {
    const account = tryCode(LEVEL1_ACCOUNT_CODES[l1]);
    if (account) return { account, level2: l2 };
  }

  if (l2 && LEVEL2_ACCOUNT_CODES[l2]) {
    const account = tryCode(LEVEL2_ACCOUNT_CODES[l2]);
    if (account) return { account, level2: l2 };
  }

  if (l2 && byName.has(l2)) return { account: byName.get(l2), level2: l2 };

  const fuzzy = accounts.find(
    (acc) =>
      (l1 && (acc.name.includes(l1) || l1.includes(acc.name))) ||
      (l2 && (acc.name.includes(l2) || l2.includes(acc.name)))
  );
  if (fuzzy) return { account: fuzzy, level2: l2 };

  return {
    account: null,
    level2: l2,
    warning: `未匹配科目：${[l1, l2].filter(Boolean).join(' / ') || '（空）'}`
  };
}

/** 历史导入凭证号：去掉数字部分前的 YYYYMM（如 202605001 → 001） */
function stripYearMonthPrefix(voucherNumber) {
  const num = String(voucherNumber || '').trim();
  const match = num.match(/^(\d{4})(\d{2})(\d+)$/);
  if (!match) return num;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  if (year < 2000 || year > 2099 || month < 1 || month > 12) return num;

  const seq = match[3];
  return seq.padStart(Math.max(3, seq.length), '0');
}

function parseVoucherNo(raw) {
  const text = normalizeText(raw);
  if (!text) return { voucherNo: '', voucherType: '记', voucherNumber: '' };

  const match = text.match(/^([^\d-]+)-(.+)$/);
  if (match) {
    const voucherType = match[1] || '记';
    const voucherNumber = stripYearMonthPrefix(match[2]);
    return {
      voucherNo: `${voucherType}-${voucherNumber}`,
      voucherType,
      voucherNumber
    };
  }

  const voucherNumber = stripYearMonthPrefix(text);
  return {
    voucherNo: `记-${voucherNumber}`,
    voucherType: '记',
    voucherNumber
  };
}

function buildSummary(summary, counterparty) {
  const base = normalizeText(summary);
  const party = normalizeText(counterparty);
  if (!party || base.includes(party)) return base;
  return base ? `${base}（${party}）` : party;
}

function inferVoucherMeta(voucher) {
  const level2Hints = voucher._level2Hints || [];
  const level2Text = level2Hints.join(' ');
  const codes = new Set(voucher.entries.map((e) => e.accountCode));
  const hasIncome = codes.has('5001');
  const taxCreditEntry = voucher.entries.find(
    (e) => e.accountCode === '2221' && parseFloat(e.credit) > 0
  );

  if (hasIncome) {
    voucher.businessType = '销售收入';
    if (
      level2Text.includes('专票') ||
      level2Hints.includes('应交专票增值税')
    ) {
      voucher.invoiceType = INVOICE_TYPE.SPECIAL;
    } else if (taxCreditEntry) {
      voucher.invoiceType = INVOICE_TYPE.ORDINARY;
    } else {
      voucher.invoiceType = INVOICE_TYPE.NONE;
    }
    if (taxCreditEntry) {
      voucher.taxAmount = parseFloat(taxCreditEntry.credit) || 0;
    }
  } else if (codes.has('2211')) {
    voucher.businessType = '工资薪酬';
  } else if (codes.has('5301') && codes.has('2221')) {
    voucher.businessType = '税费缴纳';
  } else if (codes.has('5801') || codes.has('5403')) {
    voucher.businessType = '税费缴纳';
  } else if (codes.has('5602') || codes.has('2241')) {
    voucher.businessType = '日常费用';
  } else {
    voucher.businessType = '其他';
  }

  if (voucher._quarter && voucher.remark && !voucher.remark.includes(voucher._quarter)) {
    voucher.remark = `${voucher._quarter}；${voucher.remark}`;
  } else if (voucher._quarter && !voucher.remark) {
    voucher.remark = voucher._quarter;
  }

  delete voucher._level2Hints;
  delete voucher._quarter;
}

function rowsToVouchers(rows, accounts) {
  if (!rows.length) {
    throw new Error('文件中没有可读取的数据');
  }

  const headerRowIndex = findHeaderRowIndex(rows);
  if (headerRowIndex < 0) {
    throw new Error(
      '未找到表头行。完整历史分录表应包含标题行 + 表头（凭证号、凭证日期、摘要、一级科目、借方金额、贷方金额等）'
    );
  }

  const colIndex = buildColumnIndex(rows[headerRowIndex]);
  const required = ['voucherNo', 'date', 'summary'];
  const missing = required.filter((key) => colIndex[key] == null);
  if (colIndex.level1 == null && colIndex.level2 == null) {
    missing.push('level1');
  }
  if (missing.length) {
    const labels = {
      voucherNo: '凭证号',
      date: '凭证日期',
      summary: '摘要',
      level1: '一级科目'
    };
    throw new Error(`缺少必要列：${missing.map((key) => labels[key]).join('、')}`);
  }

  const dataRows = forwardFillImportColumns(rows, headerRowIndex, colIndex);
  const grouped = new Map();
  const warnings = [];
  let currentDate = '';

  for (let i = headerRowIndex + 1; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (isEmptyRow(row)) continue;

    const voucherNoRaw = normalizeText(cell(row, colIndex, 'voucherNo'));
    const summary = normalizeText(cell(row, colIndex, 'summary'));
    const level1 = normalizeText(cell(row, colIndex, 'level1'));
    const level2 = normalizeText(cell(row, colIndex, 'level2'));
    const debit = parseAmount(cell(row, colIndex, 'debit'));
    const credit = parseAmount(cell(row, colIndex, 'credit'));

    if (shouldSkipRow(summary, level1, voucherNoRaw)) continue;

    if (!voucherNoRaw) {
      if (rowHasEntryData(row, colIndex)) {
        warnings.push(`第 ${i + 1} 行凭证号为空，已跳过`);
      }
      continue;
    }

    let date = parseDate(cell(row, colIndex, 'date'));
    if (!date && grouped.has(voucherNoRaw)) {
      date = grouped.get(voucherNoRaw).date;
    }
    if (!date && currentDate) {
      date = currentDate;
    }
    if (!date) {
      warnings.push(`${voucherNoRaw} 第 ${i + 1} 行日期无效，已跳过`);
      continue;
    }
    currentDate = date;

    if (!summary && debit === 0 && credit === 0) continue;

    const quarter = normalizeText(cell(row, colIndex, 'quarter'));
    const { account, warning, level2: resolvedLevel2 } = resolveAccount(accounts, level1, level2);
    if (!account) {
      warnings.push(`${voucherNoRaw} 第 ${i + 1} 行：${warning}`);
      continue;
    }

    const counterparty = normalizeText(cell(row, colIndex, 'counterparty'));
    const attachmentCount = parseInt(cell(row, colIndex, 'attachmentCount'), 10) || 0;
    const remark = normalizeText(cell(row, colIndex, 'remark'));
    const parsedNo = parseVoucherNo(voucherNoRaw);

    if (!grouped.has(voucherNoRaw)) {
      grouped.set(voucherNoRaw, {
        ...parsedNo,
        date,
        attachmentCount: 0,
        remark: '',
        businessType: '其他',
        invoiceType: INVOICE_TYPE.NONE,
        taxAmount: 0,
        _quarter: quarter,
        _level2Hints: [],
        entries: []
      });
    }

    const voucher = grouped.get(voucherNoRaw);
    if (voucher.date !== date) {
      warnings.push(`${voucherNoRaw} 存在多个日期，以首行 ${voucher.date} 为准`);
    }
    if (quarter && !voucher._quarter) voucher._quarter = quarter;
    if (resolvedLevel2) voucher._level2Hints.push(resolvedLevel2);

    voucher.attachmentCount = Math.max(voucher.attachmentCount, attachmentCount);
    if (remark && !voucher.remark.includes(remark)) {
      voucher.remark = voucher.remark ? `${voucher.remark}；${remark}` : remark;
    }

    voucher.entries.push({
      summary: buildSummary(summary, counterparty),
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
      debit: debit || '',
      credit: credit || ''
    });
  }

  const vouchers = [];
  for (const voucher of grouped.values()) {
    if (voucher.entries.length < 2) {
      warnings.push(`${voucher.voucherNo} 分录不足 2 条，已跳过`);
      continue;
    }
    inferVoucherMeta(voucher);
    vouchers.push(voucher);
  }

  if (!vouchers.length) {
    throw new Error('未能解析出有效凭证，请检查文件格式与科目名称');
  }

  return { vouchers, warnings, headerRowIndex: headerRowIndex + 1 };
}

export const VoucherImportParser = {
  rowsToVouchers,
  parseAmount,
  parseDate,
  normalizeText
};
