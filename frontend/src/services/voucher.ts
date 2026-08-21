import { DB } from './db';
import { Accounts } from './accounts';
import { buildAttachmentFileName } from '../utils/attachmentName';
import {
  matchSignatory,
  matchVoucherAmount,
  parseCodeRanges,
  parseNumberRanges,
  parseVoucherNum as parseVoucherNumber
} from '../utils/voucherFilter';
import {
  CARRY_FORWARD_VOUCHER_READONLY_TIP,
  isCarryForwardVoucher
} from '../utils/carryForwardVoucher';
import { normalizeVoucherFinanceInterestEntries } from '../utils/financeExpenseEntry';
import { TaxDeclaration } from './taxDeclaration';
import {
  formatQuarterLabel,
  reportPeriodToDateRange,
  taxExemptionPeriodKey
} from '../utils/reportPeriod';
import type {
  Attachment,
  LedgerResult,
  TotalsResult,
  Voucher as VoucherRecord,
  VoucherEntry,
  VoucherFilters,
  VoucherInput,
  VoucherStatus
} from '../types';

const STATUS = { DRAFT: 'draft', APPROVED: 'approved', LOCKED: 'locked' } as const;
const STATUS_LABEL: Record<VoucherStatus, string> = { draft: '草稿', approved: '已审核', locked: '已结项' };
const ATTACHMENT_READONLY_TIP = '已结账或已审核的凭证不支持上传、删除、修改附件';

function canModifyAttachments(status: VoucherStatus) {
  return status === STATUS.DRAFT;
}

function canEditVoucher(status: VoucherStatus) {
  return status === STATUS.DRAFT;
}

type VoucherMutationOptions = {
  allowCarryForwardBypass?: boolean;
};

function assertCarryForwardMutable(
  voucher: Pick<VoucherRecord, 'isTaxExemptionCarryForward' | 'isProfitLossClosing'> | null | undefined,
  options: VoucherMutationOptions = {}
) {
  if (options.allowCarryForwardBypass) return;
  if (isCarryForwardVoucher(voucher)) {
    throw new Error(CARRY_FORWARD_VOUCHER_READONLY_TIP);
  }
}

async function assertVoucherDateMutable(dateStr: string) {
  await TaxDeclaration.assertDateNotInDeclaredQuarter(dateStr);
}

function isRedLetterVoucher(voucher: Pick<VoucherRecord, 'reversedFromId' | 'reversedFromNo' | 'remark' | 'entries'> | null | undefined) {
  if (!voucher) return false;
  if (voucher.reversedFromId || voucher.reversedFromNo) return true;
  if ((voucher.remark || '').startsWith('冲销')) return true;
  const summary = voucher.entries?.[0]?.summary || '';
  return summary.startsWith('冲销');
}

/** 凭证列表排序：日期倒序 → 字号倒序 */
function compareVouchersDesc(a, b) {
  const dateCmp = b.date.localeCompare(a.date);
  if (dateCmp !== 0) return dateCmp;

  const numA = parseVoucherNum(a.voucherNumber);
  const numB = parseVoucherNum(b.voucherNumber);
  if (numB !== numA) return numB - numA;

  return (b.voucherNo || '').localeCompare(a.voucherNo || '');
}

function parseVoucherNum(value) {
  return parseInt(value, 10) || 0;
}

function formatVoucherNum(num, pad = 3) {
  return String(num).padStart(pad, '0');
}

function getYearMonth(date) {
  return String(date || '').slice(0, 7);
}

function getNumberPad(vouchers) {
  const maxLen = vouchers.reduce(
    (max, v) => Math.max(max, String(v.voucherNumber || '').length),
    3
  );
  return Math.max(3, maxLen);
}

async function getPeriodVouchers(voucherType, yearMonth) {
  const all = await DB.getAll('vouchers');
  return all
    .filter((v) => v.voucherType === voucherType && v.date.startsWith(yearMonth))
    .sort((a, b) => parseVoucherNum(a.voucherNumber) - parseVoucherNum(b.voucherNumber));
}

async function findNumberConflict(voucherType, yearMonth, voucherNumber, excludeId = '') {
  const vouchers = await getPeriodVouchers(voucherType, yearMonth);
  return vouchers.find(
    (v) => v.id !== excludeId && parseVoucherNum(v.voucherNumber) === parseVoucherNum(voucherNumber)
  );
}

async function persistVoucherNumbers(vouchers, pad) {
  for (const voucher of vouchers) {
    voucher.voucherNumber = formatVoucherNum(parseVoucherNum(voucher.voucherNumber), pad);
    voucher.voucherNo = `${voucher.voucherType}-${voucher.voucherNumber}`;
    voucher.updatedAt = new Date().toISOString();
    voucher.checksum = generateChecksum(voucher);
    await DB.put('vouchers', voucher);
  }
}

function assertVouchersUnlocked(vouchers) {
  const locked = vouchers.filter((v) => v.status === STATUS.LOCKED);
  if (locked.length) {
    throw new Error(`凭证 ${locked.map((v) => v.voucherNo).join('、')} 已结项，无法调整`);
  }
}

async function getNextNumber(type, date) {
  const vouchers = await DB.getAll('vouchers');
  const yearMonth = date.slice(0, 7);
  const sameMonth = vouchers.filter(
    (v) => v.voucherType === type && v.date.startsWith(yearMonth)
  );
  const maxNum = sameMonth.reduce((max, v) => {
    const num = parseInt(v.voucherNumber, 10) || 0;
    return num > max ? num : max;
  }, 0);
  return String(maxNum + 1).padStart(3, '0');
}

function calcTotals(entries: VoucherEntry[]): TotalsResult {
  let debit = 0;
  let credit = 0;
  for (const e of entries) {
    debit += parseFloat(String(e.debit)) || 0;
    credit += parseFloat(String(e.credit)) || 0;
  }
  return {
    debit: Math.round(debit * 100) / 100,
    credit: Math.round(credit * 100) / 100,
    balanced: Math.abs(debit - credit) < 0.005
  };
}

function generateChecksum(voucher: VoucherInput | VoucherRecord) {
  const str = JSON.stringify({
    id: voucher.id,
    date: voucher.date,
    entries: voucher.entries,
    totalDebit: voucher.totalDebit,
    totalCredit: voucher.totalCredit
  });
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return 'CHK-' + Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
}

async function save(voucherData: VoucherInput, approve = false): Promise<VoucherRecord> {
  const normalized = normalizeVoucherFinanceInterestEntries(voucherData);
  const totals = calcTotals(normalized.entries);
  if (!totals.balanced) {
    throw new Error(
      `借贷不平衡，借方 ${totals.debit.toFixed(2)}，贷方 ${totals.credit.toFixed(2)}`
    );
  }
  if (normalized.entries.length < 2) {
    throw new Error('至少需要两条分录');
  }
  for (const e of normalized.entries) {
    if (!e.accountId) throw new Error('请选择会计科目');
    if (!e.summary) throw new Error('请填写摘要');
  }

  await assertVoucherDateMutable(normalized.date);

  const isNew = !normalized.id;
  if (isNew) {
    normalized.id = DB.generateId();
    normalized.createdAt = new Date().toISOString();
    if (!normalized.voucherNumber) {
      normalized.voucherNumber = await getNextNumber(normalized.voucherType, normalized.date);
    } else {
      const conflict = await findNumberConflict(
        normalized.voucherType,
        getYearMonth(normalized.date),
        normalized.voucherNumber
      );
      if (conflict) {
        throw new Error(`凭证字号 ${normalized.voucherType}-${normalized.voucherNumber} 已存在`);
      }
    }
  } else {
    const existing = await DB.get('vouchers', normalized.id);
    assertCarryForwardMutable(existing);
    if (existing?.date && existing.date !== normalized.date) {
      await assertVoucherDateMutable(existing.date);
    }
    if (existing && existing.status === STATUS.LOCKED) {
      throw new Error('凭证已结项，不可修改');
    }
    if (existing && existing.status === STATUS.APPROVED) {
      throw new Error('凭证已审核，不可修改');
    }
  }

  normalized.voucherNo = `${normalized.voucherType}-${normalized.voucherNumber}`;
  normalized.totalDebit = totals.debit;
  normalized.totalCredit = totals.credit;
  normalized.status = (approve ? STATUS.APPROVED : STATUS.DRAFT) as VoucherStatus;
  normalized.updatedAt = new Date().toISOString();
  if (approve) normalized.approvedAt = new Date().toISOString();
  normalized.checksum = generateChecksum(normalized);

  await DB.put('vouchers', normalized as VoucherRecord);

  await DB.addAuditLog(
    isNew ? (approve ? '新建并审核' : '新建草稿') : approve ? '修改并审核' : '修改草稿',
    '凭证',
    `${normalized.voucherNo} 金额 ${totals.debit.toFixed(2)}`
  );

  return normalized as VoucherRecord;
}

async function lock(id) {
  const voucher = await DB.get('vouchers', id);
  if (!voucher) throw new Error('凭证不存在');
  if (voucher.status === STATUS.DRAFT) throw new Error('草稿凭证需先审核才能结项');
  voucher.status = STATUS.LOCKED;
  voucher.lockedAt = new Date().toISOString();
  await DB.put('vouchers', voucher);
  await DB.addAuditLog('结项', '凭证', voucher.voucherNo);
  return voucher;
}

/** 季度结项：将该季所有已审核凭证标记为已结项 */
async function lockManyInQuarter(period: { type: 'quarter'; year: number; quarter: number }) {
  const [start, end] = reportPeriodToDateRange(period);
  const startDate = start.format('YYYY-MM-DD');
  const endDate = end.format('YYYY-MM-DD');
  const periodKey = taxExemptionPeriodKey(period);
  const vouchers = await DB.getAll('vouchers');
  const inQuarter = vouchers.filter((v) => v.date >= startDate && v.date <= endDate);

  const drafts = inQuarter.filter((v) => v.status === STATUS.DRAFT);
  if (drafts.length) {
    throw new Error(`该季度还有 ${drafts.length} 张草稿凭证，请先审核后再结项`);
  }

  let locked = 0;
  for (const voucher of inQuarter) {
    if (voucher.status === STATUS.LOCKED) {
      if (!voucher.quarterDeclaredKey) {
        voucher.quarterDeclaredKey = periodKey;
        await DB.put('vouchers', voucher);
      }
      continue;
    }
    if (voucher.status !== STATUS.APPROVED) continue;
    voucher.status = STATUS.LOCKED;
    voucher.lockedAt = new Date().toISOString();
    voucher.quarterDeclaredKey = periodKey;
    await DB.put('vouchers', voucher);
    locked++;
  }

  if (locked > 0) {
    await DB.addAuditLog(
      '批量结项',
      '凭证',
      `${formatQuarterLabel(period.year, period.quarter)} ${locked} 张`
    );
  }

  return { locked, total: inQuarter.length };
}

/** 取消季度结项：恢复该季因结项标记而结项的凭证为已审核 */
async function unlockManyInQuarter(period: { type: 'quarter'; year: number; quarter: number }) {
  const [start, end] = reportPeriodToDateRange(period);
  const startDate = start.format('YYYY-MM-DD');
  const endDate = end.format('YYYY-MM-DD');
  const periodKey = taxExemptionPeriodKey(period);
  const vouchers = await DB.getAll('vouchers');
  const inQuarter = vouchers.filter((v) => v.date >= startDate && v.date <= endDate);

  let unlocked = 0;
  for (const voucher of inQuarter) {
    if (voucher.status !== STATUS.LOCKED) continue;
    if (voucher.quarterDeclaredKey !== periodKey) continue;
    voucher.status = STATUS.APPROVED;
    voucher.lockedAt = undefined;
    voucher.quarterDeclaredKey = undefined;
    await DB.put('vouchers', voucher);
    unlocked++;
  }

  if (unlocked > 0) {
    await DB.addAuditLog(
      '取消结项',
      '凭证',
      `${formatQuarterLabel(period.year, period.quarter)} ${unlocked} 张恢复为已审核`
    );
  }

  return { unlocked };
}

/** 批量审核草稿凭证 */
async function approveMany(ids: string[]) {
  const uniqueIds = [...new Set(ids)];
  const result = { approved: 0, skipped: 0, failed: [] };

  for (const id of uniqueIds) {
    const voucher = await DB.get('vouchers', id);
    if (!voucher) {
      result.skipped++;
      continue;
    }
    if (voucher.status !== STATUS.DRAFT) {
      result.skipped++;
      continue;
    }
    try {
      await assertVoucherDateMutable(voucher.date);
      await save(voucher, true);
      result.approved++;
    } catch (err) {
      result.failed.push({
        id,
        voucherNo: voucher.voucherNo,
        message: err.message || '审核失败'
      });
    }
  }

  if (result.approved > 0) {
    await DB.addAuditLog('批量审核', '凭证', `成功审核 ${result.approved} 张凭证`);
  }
  return result;
}

/** 批量反审核：已审核 → 草稿（已结项不可反审核） */
async function unapproveMany(ids: string[]) {
  const uniqueIds = [...new Set(ids)];
  const result = { unapproved: 0, skipped: 0, failed: [] };

  for (const id of uniqueIds) {
    const voucher = await DB.get('vouchers', id);
    if (!voucher) {
      result.skipped++;
      continue;
    }
    if (voucher.status === STATUS.LOCKED) {
      result.failed.push({
        id,
        voucherNo: voucher.voucherNo,
        message: '已结项，不可反审核'
      });
      continue;
    }
    if (voucher.status !== STATUS.APPROVED) {
      result.skipped++;
      continue;
    }
    if (isCarryForwardVoucher(voucher)) {
      result.failed.push({
        id,
        voucherNo: voucher.voucherNo,
        message: '系统结转凭证不可反审核'
      });
      continue;
    }
    try {
      await assertVoucherDateMutable(voucher.date);
      voucher.status = STATUS.DRAFT;
      voucher.approvedAt = undefined;
      voucher.updatedAt = new Date().toISOString();
      await DB.put('vouchers', voucher);
      result.unapproved++;
    } catch (err) {
      result.failed.push({
        id,
        voucherNo: voucher.voucherNo,
        message: err.message || '反审核失败'
      });
    }
  }

  if (result.unapproved > 0) {
    await DB.addAuditLog('批量反审核', '凭证', `成功反审核 ${result.unapproved} 张凭证`);
  }
  return result;
}

/** 单张反审核：已审核 → 草稿 */
async function unapprove(id) {
  const voucher = await DB.get('vouchers', id);
  if (!voucher) throw new Error('凭证不存在');
  assertCarryForwardMutable(voucher);
  await assertVoucherDateMutable(voucher.date);
  if (voucher.status === STATUS.LOCKED) {
    throw new Error('已结项的凭证不可反审核');
  }
  if (voucher.status !== STATUS.APPROVED) {
    throw new Error('仅已审核凭证可反审核');
  }

  voucher.status = STATUS.DRAFT;
  voucher.approvedAt = undefined;
  voucher.updatedAt = new Date().toISOString();
  await DB.put('vouchers', voucher);
  await DB.addAuditLog('反审核', '凭证', voucher.voucherNo);
  return voucher;
}

async function clearTaxExemptionLinksForCarryForward(carryForwardId) {
  const vouchers = await DB.getAll('vouchers');
  for (const voucher of vouchers) {
    if (voucher.taxExemptionVoucherId !== carryForwardId) continue;
    voucher.taxExemptionDone = false;
    voucher.taxExemptionVoucherId = '';
    await DB.put('vouchers', voucher);
  }
}

async function removeVoucherData(voucher) {
  if (voucher.isTaxExemptionCarryForward) {
    await clearTaxExemptionLinksForCarryForward(voucher.id);
  }
  if (voucher.attachmentIds) {
    for (const attId of voucher.attachmentIds) {
      await DB.remove('attachments', attId);
    }
  }
  await DB.remove('vouchers', voucher.id);
}

async function remove(id, options: VoucherMutationOptions = {}) {
  const voucher = await DB.get('vouchers', id);
  if (!voucher) return;
  assertCarryForwardMutable(voucher, options);
  await assertVoucherDateMutable(voucher.date);
  if (voucher.status === STATUS.LOCKED) {
    throw new Error('已结项的凭证不可删除');
  }
  await removeVoucherData(voucher);
  await DB.addAuditLog('删除', '凭证', voucher.voucherNo);
}

async function forceRemove(id, options: VoucherMutationOptions = {}) {
  const voucher = await DB.get('vouchers', id);
  if (!voucher) return;
  assertCarryForwardMutable(voucher, options);
  await assertVoucherDateMutable(voucher.date);
  await removeVoucherData(voucher);
  await DB.addAuditLog('强制删除', '凭证', voucher.voucherNo);
}

async function removeByVoucherNo(voucherNo) {
  const vouchers = await DB.getAll('vouchers');
  const voucher = vouchers.find((v) => v.voucherNo === voucherNo);
  if (!voucher) {
    throw new Error(`未找到凭证 ${voucherNo}`);
  }
  await forceRemove(voucher.id);
}

/** 批量删除未结项凭证（草稿、已审核） */
async function removeMany(ids: string[]) {
  const uniqueIds = [...new Set(ids)];
  const result = { deleted: 0, skipped: 0, failed: [] };

  for (const id of uniqueIds) {
    const voucher = await DB.get('vouchers', id);
    if (!voucher) {
      result.skipped++;
      continue;
    }
    if (voucher.status === STATUS.LOCKED) {
      result.failed.push({
        id,
        voucherNo: voucher.voucherNo,
        message: '已结项，不可删除'
      });
      continue;
    }
    if (isCarryForwardVoucher(voucher)) {
      result.failed.push({
        id,
        voucherNo: voucher.voucherNo,
        message: '系统结转凭证不可删除'
      });
      continue;
    }
    try {
      await assertVoucherDateMutable(voucher.date);
      await removeVoucherData(voucher);
      result.deleted++;
    } catch (err) {
      result.failed.push({
        id,
        voucherNo: voucher.voucherNo,
        message: err.message || '删除失败'
      });
    }
  }

  if (result.deleted > 0) {
    await DB.addAuditLog('批量删除', '凭证', `成功删除 ${result.deleted} 张凭证`);
  }
  return result;
}

/** 批量删除所有未结项凭证（草稿、已审核） */
async function removeAllUnlocked() {
  const vouchers = await DB.getAll('vouchers');
  const targets = [];
  let lockedCount = 0;
  let declaredCount = 0;

  for (const voucher of vouchers) {
    if (voucher.status === STATUS.LOCKED) {
      lockedCount++;
      continue;
    }
    if (await TaxDeclaration.isDateInDeclaredQuarter(voucher.date)) {
      declaredCount++;
      continue;
    }
    targets.push(voucher);
  }

  if (!targets.length) {
    return { deleted: 0, locked: lockedCount, declared: declaredCount };
  }

  for (const voucher of targets) {
    await removeVoucherData(voucher);
  }

  await DB.addAuditLog('批量删除', '凭证', `删除 ${targets.length} 张未结项凭证`);
  return { deleted: targets.length, locked: lockedCount, declared: declaredCount };
}

async function getAll(filters: VoucherFilters = {}) {
  let vouchers = await DB.getAll('vouchers');
  vouchers.sort(compareVouchersDesc);

  if (filters.startDate) vouchers = vouchers.filter((v) => v.date >= filters.startDate!);
  if (filters.endDate) vouchers = vouchers.filter((v) => v.date <= filters.endDate!);
  if (filters.status) vouchers = vouchers.filter((v) => v.status === filters.status);
  if (filters.voucherType) {
    vouchers = vouchers.filter((v) => v.voucherType === filters.voucherType);
  }

  const numberRanges = parseNumberRanges(filters.voucherNumber || '');
  if (numberRanges) {
    vouchers = vouchers.filter((v) => numberRanges.includes(parseVoucherNumber(v.voucherNumber)));
  }

  const summaryKw = (filters.summary || '').trim().toLowerCase();
  if (summaryKw) {
    vouchers = vouchers.filter((v) =>
      v.entries.some((e) => (e.summary || '').toLowerCase().includes(summaryKw))
    );
  }

  const codeRanges = parseCodeRanges(filters.accountCode || '');
  if (codeRanges) {
    vouchers = vouchers.filter((v) =>
      v.entries.some((e) => {
        const code = String(e.accountCode || '').trim();
        return code && codeRanges.includes(code);
      })
    );
  }

  if (filters.amountMin || filters.amountMax) {
    vouchers = vouchers.filter((v) => matchVoucherAmount(v, filters.amountMin, filters.amountMax));
  }

  if (filters.businessType) {
    vouchers = vouchers.filter((v) => v.businessType === filters.businessType);
  }

  if (filters.signatory) {
    vouchers = vouchers.filter((v) => matchSignatory(v, filters.signatory!));
  }

  const remarkKw = (filters.remark || '').trim().toLowerCase();
  if (remarkKw) {
    vouchers = vouchers.filter((v) => (v.remark || '').toLowerCase().includes(remarkKw));
  }

  if (filters.keyword) {
    const kw = filters.keyword.toLowerCase();
    vouchers = vouchers.filter(
      (v) =>
        v.voucherNo.toLowerCase().includes(kw) ||
        (v.remark && v.remark.toLowerCase().includes(kw)) ||
        v.entries.some(
          (e) =>
            e.summary.toLowerCase().includes(kw) ||
            (e.accountName && e.accountName.toLowerCase().includes(kw))
        )
    );
  }
  return vouchers;
}

async function getById(id) {
  return DB.get('vouchers', id);
}

/** 按列表顺序（日期新→旧）取相邻凭证；direction: older | newer */
async function getAdjacentVoucher(currentId, direction) {
  const vouchers = await DB.getAll('vouchers');
  vouchers.sort(compareVouchersDesc);
  const index = vouchers.findIndex((v) => v.id === currentId);
  if (index < 0) return null;
  const offset = direction === 'older' ? 1 : -1;
  return vouchers[index + offset] || null;
}

/** 按凭证字号查找（支持 记-032、032、32）；可选限定年月 */
async function findByVoucherNo(
  raw: string,
  { voucherType = '记', yearMonth }: { voucherType?: string; yearMonth?: string } = {}
) {
  const text = String(raw || '').trim();
  if (!text) return null;

  let vouchers = await DB.getAll('vouchers');
  if (yearMonth) {
    vouchers = vouchers.filter((v) => v.date.startsWith(yearMonth));
  }

  const fullMatch = vouchers.find((v) => v.voucherNo === text);
  if (fullMatch) return fullMatch;

  const withType = text.includes('-') ? text : `${voucherType}-${text}`;
  const typedMatch = vouchers.find((v) => v.voucherNo === withType);
  if (typedMatch) return typedMatch;

  const num = parseVoucherNum(text.replace(/^[^\d-]+-?/, ''));
  if (!num) return null;

  return (
    vouchers.find(
      (v) =>
        v.voucherType === voucherType &&
        parseVoucherNum(v.voucherNumber) === num
    ) || null
  );
}

async function saveAttachment(file: File, customName?: string): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const attachment: Attachment = {
        id: DB.generateId(),
        name: customName || file.name,
        type: file.type,
        size: file.size,
        data: reader.result as string,
        uploadedAt: new Date().toISOString()
      };
      await DB.put('attachments', attachment);
      resolve(attachment);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function updateAttachment(attachment) {
  await DB.put('attachments', attachment);
  return attachment;
}

async function getAttachment(id) {
  return DB.get('attachments', id);
}

async function addAttachmentToVoucher(voucherId, file) {
  const voucher = await DB.get('vouchers', voucherId);
  if (!voucher) throw new Error('凭证不存在');
  if (!canModifyAttachments(voucher.status)) {
    throw new Error(ATTACHMENT_READONLY_TIP);
  }
  await assertVoucherDateMutable(voucher.date);
  if (file.size > 5 * 1024 * 1024) {
    throw new Error(`${file.name} 超过 5MB 限制`);
  }

  const totals = calcTotals(voucher.entries || []);
  const index = (voucher.attachmentIds || []).length;
  const fileName = buildAttachmentFileName({
    voucherNo: voucher.voucherNo,
    entries: voucher.entries,
    totals,
    originalName: file.name,
    index
  });

  const att = await saveAttachment(file, fileName);
  voucher.attachmentIds = [...(voucher.attachmentIds || []), att.id];
  voucher.attachmentCount = voucher.attachmentIds.length;
  voucher.updatedAt = new Date().toISOString();
  await DB.put('vouchers', voucher);
  await DB.addAuditLog('上传附件', '凭证', `${voucher.voucherNo} ${fileName}`);
  return voucher;
}

/** 冲销：生成借贷相反的新草稿凭证 */
async function reverse(id) {
  const source = await DB.get('vouchers', id);
  if (!source) throw new Error('凭证不存在');
  assertCarryForwardMutable(source);
  await assertVoucherDateMutable(source.date);
  if (source.status === STATUS.LOCKED) {
    throw new Error('已结项的凭证不可冲销');
  }

  const entries = (source.entries || []).map((entry) => ({
    accountId: entry.accountId,
    accountCode: entry.accountCode,
    accountName: entry.accountName,
    summary: entry.summary?.startsWith('冲销')
      ? entry.summary
      : `冲销${source.voucherNo} ${entry.summary || ''}`.trim(),
    debit: entry.credit || '',
    credit: entry.debit || ''
  }));

  const remarkTail = source.remark ? `；${source.remark}` : '';
  const voucherData = {
    voucherType: source.voucherType || '记',
    date: source.date,
    entries,
    businessType: source.businessType || '其他',
    invoiceType: source.invoiceType,
    taxAmount: source.taxAmount || 0,
    invoiceNumbers: source.invoiceNumbers || '',
    remark: `冲销 ${source.voucherNo}${remarkTail}`,
    reversedFromId: source.id,
    reversedFromNo: source.voucherNo,
    attachmentIds: [],
    attachmentCount: 0,
    preparedBy: source.preparedBy || '',
    reviewedBy: source.reviewedBy || '',
    postedBy: source.postedBy || '',
    cashierBy: source.cashierBy || ''
  };

  const saved = await save(voucherData, false);
  await DB.addAuditLog('冲销', '凭证', `${source.voucherNo} → ${saved.voucherNo}`);
  return saved;
}

/** 调整顺序：将凭证移动到指定字号之前，同期凭证重新编号 */
async function reorder(voucherId, beforeNumber) {
  const source = await DB.get('vouchers', voucherId);
  if (!source) throw new Error('凭证不存在');
  assertCarryForwardMutable(source);
  await assertVoucherDateMutable(source.date);
  if (source.status === STATUS.LOCKED) {
    throw new Error('已结项的凭证不可调整顺序');
  }

  const targetNum = parseVoucherNum(beforeNumber);
  if (!targetNum) throw new Error('请输入有效的目标凭证号');

  const yearMonth = getYearMonth(source.date);
  const periodVouchers = await getPeriodVouchers(source.voucherType, yearMonth);
  if (!periodVouchers.length) throw new Error('未找到同期凭证');

  const sourceNum = parseVoucherNum(source.voucherNumber);
  if (sourceNum === targetNum) {
    return { changed: false, voucher: source };
  }

  assertVouchersUnlocked(periodVouchers);

  const moving = periodVouchers.find((v) => v.id === voucherId);
  if (!moving) throw new Error('凭证不在当前会计期间内');

  const rest = periodVouchers.filter((v) => v.id !== voucherId);
  let insertIndex = rest.findIndex((v) => parseVoucherNum(v.voucherNumber) >= targetNum);
  if (insertIndex < 0) insertIndex = rest.length;

  const reordered = [...rest.slice(0, insertIndex), moving, ...rest.slice(insertIndex)];
  const pad = getNumberPad(periodVouchers);
  reordered.forEach((voucher, index) => {
    voucher.voucherNumber = formatVoucherNum(index + 1, pad);
  });

  await persistVoucherNumbers(reordered, pad);
  const updated = reordered.find((v) => v.id === voucherId);
  await DB.addAuditLog(
    '调整顺序',
    '凭证',
    `${source.voucherType}-${formatVoucherNum(sourceNum, pad)} → ${updated.voucherNo} 前移至 ${targetNum} 号`
  );
  return { changed: true, voucher: updated };
}

/** 插入凭证：在指定字号前腾出空位（其后凭证顺次后移）
 * 规则：已审核/草稿前可插入；已申报结项（locked）凭证前不可插入，且其后结项凭证不可被后移。
 */
async function prepareInsertSlot(voucherType, date, beforeNumber) {
  const targetNum = parseVoucherNum(beforeNumber);
  if (!targetNum) throw new Error('请输入有效的凭证号');

  await assertVoucherDateMutable(date);

  const yearMonth = getYearMonth(date);
  const periodVouchers = await getPeriodVouchers(voucherType, yearMonth);

  const pad = getNumberPad(periodVouchers);
  const anchor = periodVouchers.find((v) => parseVoucherNum(v.voucherNumber) === targetNum);
  // 锚点为已结项（含已申报结项）时禁止在其前插入；已审核允许
  if (anchor && anchor.status === STATUS.LOCKED) {
    throw new Error(
      `凭证 ${anchor.voucherNo} 已申报结项，不能在其前面插入新凭证；已审核凭证前可以插入`
    );
  }

  const toShift = periodVouchers
    .filter((v) => parseVoucherNum(v.voucherNumber) >= targetNum)
    .sort((a, b) => parseVoucherNum(b.voucherNumber) - parseVoucherNum(a.voucherNumber));

  const lockedShift = toShift.filter((v) => v.status === STATUS.LOCKED);
  if (lockedShift.length) {
    throw new Error(
      `其后凭证 ${lockedShift.map((v) => v.voucherNo).join('、')} 已申报结项，无法顺次后移，不能在此插入`
    );
  }

  for (const voucher of toShift) {
    voucher.voucherNumber = formatVoucherNum(parseVoucherNum(voucher.voucherNumber) + 1, pad);
    voucher.voucherNo = `${voucher.voucherType}-${voucher.voucherNumber}`;
    voucher.updatedAt = new Date().toISOString();
    voucher.checksum = generateChecksum(voucher);
    await DB.put('vouchers', voucher);
  }

  const reservedNumber = formatVoucherNum(targetNum, pad);
  await DB.addAuditLog(
    '插入凭证',
    '凭证',
    `${voucherType}-${reservedNumber} 前插入空位（${yearMonth}）`
  );
  return reservedNumber;
}

async function getStats() {
  const vouchers = await DB.getAll('vouchers');
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthVouchers = vouchers.filter((v) => v.date.startsWith(yearMonth));
  let totalDebit = 0;
  let totalAttachments = 0;
  for (const v of vouchers) {
    totalDebit += v.totalDebit || 0;
    totalAttachments += (v.attachmentIds || []).length;
  }
  return {
    total: vouchers.length,
    month: monthVouchers.length,
    totalDebit,
    totalAttachments
  };
}

async function getLedger(accountId, startDate, endDate) {
  const vouchers = await getAll({ startDate, endDate, status: '' });
  const approved = vouchers.filter((v) => v.status !== STATUS.DRAFT);
  const rows = [];
  let balance = 0;
  const account = await Accounts.getById(accountId);
  const isDebit = account ? account.direction === 'debit' : true;

  for (const v of approved.sort((a, b) => a.date.localeCompare(b.date))) {
    for (const e of v.entries) {
      if (e.accountId !== accountId) continue;
      const debit = parseFloat(String(e.debit)) || 0;
      const credit = parseFloat(String(e.credit)) || 0;
      balance += isDebit ? debit - credit : credit - debit;
      rows.push({
        date: v.date,
        voucherNo: v.voucherNo,
        summary: e.summary,
        debit,
        credit,
        balance: Math.round(balance * 100) / 100
      });
    }
  }
  return { account, rows, endingBalance: balance };
}

function formatMoney(n) {
  return (
    '¥' +
    (parseFloat(n) || 0).toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  );
}

export const Voucher = {
  STATUS,
  STATUS_LABEL,
  ATTACHMENT_READONLY_TIP,
  CARRY_FORWARD_VOUCHER_READONLY_TIP,
  DECLARED_QUARTER_READONLY_TIP: TaxDeclaration.DECLARED_QUARTER_READONLY_TIP,
  canModifyAttachments,
  canEditVoucher,
  isRedLetterVoucher,
  save,
  lock,
  lockManyInQuarter,
  unlockManyInQuarter,
  approveMany,
  unapprove,
  unapproveMany,
  remove,
  forceRemove,
  removeByVoucherNo,
  removeMany,
  removeAllUnlocked,
  getAll,
  getById,
  getAdjacentVoucher,
  findByVoucherNo,
  saveAttachment,
  addAttachmentToVoucher,
  reverse,
  reorder,
  prepareInsertSlot,
  updateAttachment,
  getAttachment,
  getStats,
  getLedger,
  calcTotals,
  getNextNumber,
  formatMoney,
  generateChecksum
};
